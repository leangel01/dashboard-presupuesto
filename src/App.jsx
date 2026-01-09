import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon, Wallet, Search, Info, Settings, Database, RefreshCcw } from 'lucide-react';

const getEnv = (key) => {
  try {
    return import.meta.env[key] || "";
  } catch (e) {
    return "";
  }
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: `${getEnv('VITE_FIREBASE_PROJECT_ID')}.firebaseapp.com`,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: `${getEnv('VITE_FIREBASE_PROJECT_ID')}.appspot.com`,
  messagingSenderId: "123456789",
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

let db;
try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Error al inicializar Firebase:", e);
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [debugInfo, setDebugInfo] = useState({
    projectId: firebaseConfig.projectId,
    collection: "presupuesto_2025",
    status: "Iniciando..."
  });

  useEffect(() => {
    if (!firebaseConfig.apiKey || !db) {
      setError("Configuración de Firebase incompleta. Verifica tus Secrets en GitHub.");
      setLoading(false);
      return;
    }

    const collectionName = "presupuesto_2025"; 
    const colRef = collection(db, collectionName);
    
    // Listener en tiempo real
    const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
      if (snapshot.empty) {
        setDebugInfo(prev => ({ ...prev, status: "Conectado pero colección vacía" }));
        setData([]);
        setLoading(false);
        return;
      }

      const items = snapshot.docs.map(doc => {
        const raw = doc.data();
        const findField = (target) => {
          const key = Object.keys(raw).find(k => k.trim().toUpperCase() === target.toUpperCase());
          return key ? raw[key] : null;
        };

        return {
          id: doc.id,
          DESC_RAMO: findField('DESC_RAMO') || "Sin Clasificar",
          aprobado: Number(findField('MONTO_APROBADO')) || 0,
          pagado: Number(findField('MONTO_PAGADO')) || 0
        };
      });

      setDebugInfo(prev => ({ ...prev, status: "Datos cargados correctamente" }));
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setError(`Error de acceso: ${err.message}. Verifica las Reglas de Seguridad en Firebase.`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cálculos globales
  const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
  const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(1) : 0;

  const chartData = data.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.DESC_RAMO);
    if (existing) {
      existing.aprobado += curr.aprobado;
      existing.pagado += curr.pagado;
    } else {
      acc.push({ name: curr.DESC_RAMO, aprobado: curr.aprobado, pagado: curr.pagado });
    }
    return acc;
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white font-sans">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Nube...</p>
      </div>
    </div>
  );

  // Pantalla de Diagnóstico si no hay datos
  if (error || data.length === 0) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-2xl w-full bg-white p-12 rounded-[3rem] shadow-2xl shadow-blue-100 border border-blue-50">
        <div className="flex justify-between items-center mb-10">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Database className="text-blue-600 w-7 h-7" />
          </div>
          <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full uppercase">Diagnóstico Activo</span>
        </div>

        <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">Sin datos en el Proyecto</h2>
        <p className="text-slate-500 text-sm mb-10 leading-relaxed">
          Firebase respondió correctamente pero la colección <span className="font-mono font-bold text-blue-600">presupuesto_2025</span> parece no tener documentos en el entorno actual.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Project ID Detectado</p>
            <p className="text-sm font-bold text-slate-800 break-all">{debugInfo.projectId || "No definido"}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Colección Destino</p>
            <p className="text-sm font-bold text-slate-800">{debugInfo.collection}</p>
          </div>
        </div>

        <div className="bg-blue-600 p-8 rounded-[2rem] text-white mb-10 shadow-xl shadow-blue-200">
          <h4 className="font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
            <Settings size={16} /> Verificación Final
          </h4>
          <ul className="space-y-4 text-sm opacity-90 font-medium">
            <li className="flex gap-3 items-start">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</div>
              <p>Entra a Firebase Console y confirma que el ID arriba sea el mismo que ves en "Configuración del Proyecto".</p>
            </li>
            <li className="flex gap-3 items-start">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</div>
              <p>Si los IDs coinciden, verifica las **Reglas de Seguridad**. Deben permitir lectura pública (allow read: if true;).</p>
            </li>
          </ul>
        </div>

        <button onClick={() => window.location.reload()} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3">
          <RefreshCcw size={16} /> Reintentar Sincronización
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-blue-100">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
              <Landmark className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl leading-none tracking-tighter">FINANZAS 2025</h1>
              <p className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase mt-1">Visor de Ejecución</p>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutDashboard size={14} /> PANEL
            </button>
            <button 
              onClick={() => setView('table')} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${view === 'table' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <TableIcon size={14} /> LISTADO
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <MetricCard label="Presupuesto Inicial" value={totalApproved} icon={<TrendingUp className="text-blue-600" />} />
          <MetricCard label="Monto Pagado" value={totalPaid} icon={<Wallet className="text-emerald-500" />} color="text-emerald-600" />
          <MetricCard label="Porcentaje Avance" value={`${executionRate}%`} icon={<div className="font-black text-blue-600 text-xs">%</div>} color="text-blue-700" />
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Gráfico Barras */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">Top 8 Ramos por Presupuesto</h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 12, 12, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico Torta */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 text-center">Distribución de Pagos</h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="pagado" cx="50%" cy="50%" innerRadius={90} outerRadius={130} paddingAngle={8}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{paddingTop: '30px', fontSize: '10px', fontWeight: 'bold'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-50">
                    <th className="p-8">Entidad / Ramo</th>
                    <th className="p-8 text-right">Aprobado</th>
                    <th className="p-8 text-right">Pagado</th>
                    <th className="p-8 text-center">Ejecución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map(item => {
                    const perc = item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-8 text-sm font-bold text-slate-700">{item.DESC_RAMO}</td>
                        <td className="p-8 text-sm text-right font-mono text-slate-400">${item.aprobado.toLocaleString()}</td>
                        <td className="p-8 text-sm text-right font-mono font-black text-slate-900">${item.pagado.toLocaleString()}</td>
                        <td className="p-8 text-center">
                          <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-black text-blue-600">{perc}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900" }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-100 transition-all">
    <div className="flex justify-between items-start mb-6">
      <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
      <div className="w-10 h-1 bg-slate-100 rounded-full"></div>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-3xl font-black tracking-tight ${color}`}>
      {typeof value === 'number' ? `$${value.toLocaleString()}` : value}
    </p>
  </div>
);

export default App;
