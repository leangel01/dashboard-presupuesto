import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
// Corrección de la importación: de 'lucide-center' a 'lucide-react'
import { Landmark, TrendingUp, Wallet, LayoutDashboard, Table as TableIcon, PieChart as PieIcon, AlertCircle, ArrowUpRight, ShieldAlert } from 'lucide-react';

/**
 * Lógica de configuración de Firebase compatible con diversos entornos
 */
const getSafeConfig = () => {
  try {
    // Intento 1: Variable global de plataforma
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
    
    // Intento 2: Proceso de entorno (Node/CI)
    if (typeof process !== 'undefined' && process.env && process.env.VITE_FIREBASE_CONFIG) {
      return JSON.parse(process.env.VITE_FIREBASE_CONFIG);
    }
  } catch (e) {
    return null;
  }
  return null;
};

const config = getSafeConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'budget-analytics-2025';

let db = null;
let auth = null;

if (config && config.apiKey) {
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
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
    if (!config || !auth) {
      setError("Configuración de servicios no detectada. Por favor, verifica tus secretos de GitHub o variables de entorno.");
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError(`Fallo de Autenticación: ${err.message}`);
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    // Ruta de colección según reglas de plataforma
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ramo: doc.data().DESC_RAMO || "Otros Ramos",
          aprobado: Number(doc.data().MONTO_APROBADO) || 0,
          pagado: Number(doc.data().MONTO_PAGADO) || 0,
          ur: doc.data().DESC_UR || "N/A"
        }));
        setData(items);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error de Firestore: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
    const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(1) : "0.0";
    
    const grouped = data.reduce((acc, curr) => {
      const name = curr.ramo;
      if (!acc[name]) acc[name] = { name, aprobado: 0, pagado: 0 };
      acc[name].aprobado += curr.aprobado;
      acc[name].pagado += curr.pagado;
      return acc;
    }, {});

    const chartData = Object.values(grouped).sort((a, b) => b.aprobado - a.aprobado).slice(0, 7);
    return { totalApproved, totalPaid, executionRate, chartData };
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando analítica...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-10 font-sans">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Landmark size={20} />
          </div>
          <div>
            <h1 className="font-black text-lg uppercase leading-none">Analítica Fiscal</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Plataforma Hacienda 2025</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setView('dashboard')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            RESUMEN
          </button>
          <button onClick={() => setView('table')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            DETALLE
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        {error && (
          <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] text-red-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert size={20} />
              <p className="font-black text-xs uppercase tracking-widest">Estado de Conexión</p>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard label="Aprobado Total" value={stats.totalApproved} icon={<TrendingUp size={20} />} />
          <MetricCard label="Pagado Total" value={stats.totalPaid} icon={<Wallet size={20} />} color="text-emerald-600" />
          <MetricCard label="Avance Presupuestal" value={`${stats.executionRate}%`} icon={<PieIcon size={20} />} color="text-amber-600" isPercent />
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Top Ramos (Presupuesto)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 9, fontWeight: 800}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                  <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Ejecución del Gasto</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={stats.chartData} dataKey="pagado" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {stats.chartData.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entidad / Ramo</th>
                  <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobado</th>
                  <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado</th>
                  <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-6">
                      <p className="text-[9px] font-bold text-blue-500 uppercase">{item.ur}</p>
                      <p className="text-sm font-bold text-slate-700">{item.ramo}</p>
                    </td>
                    <td className="p-6 text-right font-mono text-sm text-slate-400">${item.aprobado.toLocaleString('es-MX')}</td>
                    <td className="p-6 text-right font-mono text-sm font-black text-slate-900">${item.pagado.toLocaleString('es-MX')}</td>
                    <td className="p-6 text-center">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black">
                        {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900", isPercent = false }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
    <div className="flex items-center gap-3 mb-3">
      <div className="text-blue-600">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-2xl font-black tracking-tight ${color}`}>
      {!isPercent && "$"}
      {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
  </div>
);

export default App;
