import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, PieChart as PieIcon, ShieldAlert, Key, ArrowUpRight, Activity } from 'lucide-react';

/**
 * Función para obtener la configuración de Firebase de forma segura.
 * Se añade validación para evitar errores si import.meta no existe.
 */
const getFirebaseConfig = () => {
  try {
    // Verificación segura de import.meta y env
    const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) 
      ? import.meta.env.VITE_FIREBASE_CONFIG 
      : null;

    if (viteEnv) {
      return typeof viteEnv === 'string' ? JSON.parse(viteEnv) : viteEnv;
    }
    
    // Respaldo para el entorno de desarrollo local o previsualización de Canvas
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
  } catch (error) {
    console.error("Error al parsear la configuración de Firebase:", error);
  }
  return null;
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dashboard-presupuesto-2025';

let db = null;
let auth = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Si no hay configuración, intentamos esperar un poco por si se carga dinámicamente
    if (!firebaseConfig || !auth) {
      const timer = setTimeout(() => {
        if (!auth) {
          setError("Configuración de Firebase no detectada. Verifica los Secrets de GitHub o la configuración local.");
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    const performAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError(`Error de autenticación: ${err.message}`);
        setLoading(false);
      }
    };

    performAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // Ruta de Firestore siguiendo la estructura de la plataforma
    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(collectionPath, 
      (snapshot) => {
        const result = snapshot.docs.map(doc => ({
          id: doc.id,
          ramo: doc.data().DESC_RAMO || "Sin clasificar",
          aprobado: Number(doc.data().MONTO_APROBADO) || 0,
          pagado: Number(doc.data().MONTO_PAGADO) || 0,
          ur: doc.data().DESC_UR || "N/A"
        }));
        setData(result);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error al obtener datos: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const analytics = useMemo(() => {
    const totalAprobado = data.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPagado = data.reduce((acc, curr) => acc + curr.pagado, 0);
    const porcentaje = totalAprobado > 0 ? ((totalPagado / totalAprobado) * 100).toFixed(1) : "0.0";
    
    const agrupado = data.reduce((acc, curr) => {
      const clave = curr.ramo;
      if (!acc[clave]) acc[clave] = { name: clave, aprobado: 0, pagado: 0 };
      acc[clave].aprobado += curr.aprobado;
      acc[clave].pagado += curr.pagado;
      return acc;
    }, {});

    const topRamos = Object.values(agrupado).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);
    return { totalAprobado, totalPagado, porcentaje, topRamos };
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando con el servidor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-12 font-sans">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-8 h-20 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Landmark size={24} />
          </div>
          <div>
            <h1 className="font-black text-xl uppercase leading-none tracking-tight">Analítica Fiscal</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-1">Presupuesto Público 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>
            DASHBOARD
          </button>
          <button onClick={() => setView('table')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'table' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500'}`}>
            LISTADO
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-10">
        {error ? (
          <div className="bg-white border-2 border-slate-200 rounded-[3rem] p-12 text-center shadow-2xl shadow-slate-200/50">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Fallo de Conexión</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">{error}</p>
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 inline-block text-left">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Key size={14} /> Diagnóstico Técnico
              </h3>
              <ul className="space-y-2 text-xs font-mono text-slate-500">
                <li className="flex justify-between gap-10">
                  <span>Secret/Env Detectado:</span> 
                  <span className={firebaseConfig ? "text-emerald-500 font-bold" : "text-red-400"}>
                    {firebaseConfig ? "SÍ" : "NO"}
                  </span>
                </li>
                <li className="flex justify-between gap-10">
                  <span>Firebase Auth:</span> 
                  <span className={auth ? "text-emerald-500 font-bold" : "text-red-400"}>
                    {auth ? "ACTIVO" : "INACTIVO"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <MetricCard label="Monto Aprobado" value={analytics.totalAprobado} icon={<TrendingUp size={20} />} />
              <MetricCard label="Monto Pagado" value={analytics.totalPagado} icon={<Wallet size={20} />} color="text-emerald-600" />
              <MetricCard label="Ejecución Presupuestal" value={`${analytics.porcentaje}%`} icon={<Activity size={20} />} color="text-amber-600" isPercent />
            </div>

            {view === 'dashboard' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <ChartBox title="Presupuesto por Ramo Administrativo">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analytics.topRamos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>

                <ChartBox title="Distribución de Gasto Real">
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie data={analytics.topRamos} dataKey="pagado" innerRadius={70} outerRadius={100} paddingAngle={8}>
                        {analytics.topRamos.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" wrapperStyle={{fontSize: '9px', fontWeight: '800', textTransform: 'uppercase'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden mb-10">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad Ejecutora / Ramo</th>
                      <th className="p-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobado</th>
                      <th className="p-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado</th>
                      <th className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-8">
                          <p className="text-[10px] font-bold text-blue-500 mb-1">{item.ur}</p>
                          <p className="text-sm font-black text-slate-700">{item.ramo}</p>
                        </td>
                        <td className="p-8 text-right font-mono text-xs text-slate-400">${item.aprobado.toLocaleString('es-MX')}</td>
                        <td className="p-8 text-right font-mono text-sm font-black text-slate-900">${item.pagado.toLocaleString('es-MX')}</td>
                        <td className="p-8 text-center">
                          <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl text-[11px] font-black text-blue-600">
                            {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                            <ArrowUpRight size={12} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900", isPercent = false }) => (
  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">{icon}</div>
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <h2 className={`text-3xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
  </div>
);

const ChartBox = ({ title, children }) => (
  <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">
    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 flex items-center gap-3">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
      {title}
    </h3>
    {children}
  </div>
);

export default App;
