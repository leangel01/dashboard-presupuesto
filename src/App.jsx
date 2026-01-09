import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon, Wallet, Database, Search } from 'lucide-react';

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

  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setError("Faltan los Secrets de GitHub (API Key).");
      setLoading(false);
      return;
    }

    if (!db) {
      setError("Error en la conexión con la base de datos.");
      setLoading(false);
      return;
    }

    const collectionName = "presupuesto_2025";
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        console.warn("⚠️ La colección 'presupuesto_2025' existe pero no tiene documentos.");
        setData([]);
        setLoading(false);
        return;
      }

      const items = snapshot.docs.map(doc => {
        const rawData = doc.data();
        
        // Función para buscar un valor ignorando mayúsculas/minúsculas y espacios
        const getValue = (targetKey) => {
          const key = Object.keys(rawData).find(k => k.trim().toUpperCase() === targetKey.toUpperCase());
          return key ? rawData[key] : null;
        };

        return {
          id: doc.id,
          DESC_RAMO: getValue('DESC_RAMO') || "Sin Clasificar",
          aprobado: Number(getValue('MONTO_APROBADO')) || 0,
          pagado: Number(getValue('MONTO_PAGADO')) || 0
        };
      });

      console.log("✅ Datos recibidos y procesados:", items);
      setData(items);
      setLoading(false);
    }, (err) => {
      console.error("❌ Error Firestore:", err);
      setError(`Error de Firestore: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalApproved = data.reduce((acc, curr) => acc + curr.aprobado, 0);
  const totalPaid = data.reduce((acc, curr) => acc + curr.pagado, 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(2) : 0;

  const chartData = data.reduce((acc, curr) => {
    const ramo = curr.DESC_RAMO;
    const existing = acc.find(item => item.name === ramo);
    if (existing) {
      existing.aprobado += curr.aprobado;
      existing.pagado += curr.pagado;
    } else {
      acc.push({ name: ramo, aprobado: curr.aprobado, pagado: curr.pagado });
    }
    return acc;
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-tighter">Cargando Presupuesto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-gray-900 mb-2">Error de Conexión</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">{error}</p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all">Reintentar</button>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-blue-100 text-center">
          <Search className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-gray-900 mb-2">Colección Vacía</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Firebase respondió correctamente, pero no encontró documentos en la colección <span className="font-mono bg-gray-100 px-1 rounded">presupuesto_2025</span>. 
            Verifica que el nombre coincida exactamente en tu consola de Firebase.
          </p>
          <div className="bg-blue-50 p-4 rounded-xl text-left border border-blue-100 mb-6">
            <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Sugerencia:</p>
            <p className="text-xs text-blue-800 leading-tight">Asegúrate de que los documentos no estén dentro de una subcolección accidentalmente.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header Minimalista */}
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Landmark className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-none tracking-tight">VISOR FISCAL</h1>
              <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">Presupuesto 2025</p>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setView('dashboard')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <LayoutDashboard size={14} /> DASHBOARD
            </button>
            <button 
              onClick={() => setView('table')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <TableIcon size={14} /> EXPLORADOR
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* KPIs Modernos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {[
            { label: 'Aprobado Anual', value: totalApproved, color: 'text-slate-900', icon: <TrendingUp className="text-blue-600" /> },
            { label: 'Ejecutado (Pagado)', value: totalPaid, color: 'text-emerald-600', icon: <Wallet className="text-emerald-600" /> },
            { label: 'Porcentaje Ejecución', value: `${executionRate}%`, color: 'text-blue-700', icon: <div className="text-blue-700 font-black">%</div> }
          ].map((kpi, i) => (
            <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl">{kpi.icon}</div>
                <div className="h-2 w-12 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: i === 2 ? executionRate : '100%' }}></div>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className={`text-3xl font-black ${kpi.color}`}>
                  {typeof kpi.value === 'number' ? `$${kpi.value.toLocaleString()}` : kpi.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Gráfico Barras */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                <h3 className="text-xl font-black tracking-tight">Top Ramos por Asignación</h3>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 10, 10, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico Pie */}
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                <h3 className="text-xl font-black tracking-tight">Distribución del Pagado</h3>
              </div>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="pagado" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={8}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '11px', fontWeight: 'bold'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <h3 className="font-black text-slate-400 text-[11px] uppercase tracking-[0.2em]">Listado Maestro de Ejecución</h3>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-3 py-1 rounded-full">{data.length} REGISTROS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                    <th className="p-8">Ramo Institucional</th>
                    <th className="p-8 text-right">Presupuesto Aprobado</th>
                    <th className="p-8 text-right">Monto Pagado</th>
                    <th className="p-8 text-center">Eficiencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map(item => {
                    const perc = item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-8 text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{item.DESC_RAMO}</td>
                        <td className="p-8 text-sm text-right font-mono font-medium text-slate-500">${item.aprobado.toLocaleString()}</td>
                        <td className="p-6 text-sm text-right font-mono font-black text-emerald-600">${item.pagado.toLocaleString()}</td>
                        <td className="p-8 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[11px] font-black text-slate-600">{perc}%</span>
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

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Plataforma de Transparencia 2025</p>
        <div className="flex gap-6">
          <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Open Data Initiative</span>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v2.1.0</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
