import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query, getDocs, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, AlertCircle, LayoutDashboard, Table as TableIcon, Wallet, Search, Info, Settings, Database, RefreshCcw, Eye } from 'lucide-react';

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
  const [rawDoc, setRawDoc] = useState(null); // Para ver qué hay dentro de un doc real
  const [debugInfo, setDebugInfo] = useState({
    projectId: firebaseConfig.projectId,
    collection: "presupuesto_2025",
    status: "Iniciando..."
  });

  useEffect(() => {
    if (!firebaseConfig.apiKey || !db) {
      setError("Configuración incompleta.");
      setLoading(false);
      return;
    }

    const collectionName = "presupuesto_2025"; 
    const colRef = collection(db, collectionName);
    
    // 1. Intentar obtener un documento de muestra para depuración
    getDocs(query(colRef, limit(1))).then(snap => {
      if (!snap.empty) {
        setRawDoc(snap.docs[0].data());
      }
    }).catch(e => console.log("Error de escaneo:", e));

    // 2. Listener principal
    const unsubscribe = onSnapshot(query(colRef), (snapshot) => {
      if (snapshot.empty) {
        setDebugInfo(prev => ({ ...prev, status: "Vacio: No se encontraron documentos en esta ruta." }));
        setData([]);
        setLoading(false);
        return;
      }

      const items = snapshot.docs.map(doc => {
        const raw = doc.data();
        // Función ultra-flexible para encontrar campos (ignora espacios y mayúsculas)
        const findField = (target) => {
          const key = Object.keys(raw).find(k => k.trim().replace(/\s/g, '_').toUpperCase() === target.toUpperCase());
          return key ? raw[key] : null;
        };

        return {
          id: doc.id,
          DESC_RAMO: findField('DESC_RAMO') || findField('RAMO') || "Sin Nombre",
          aprobado: Number(findField('MONTO_APROBADO')) || Number(findField('APROBADO')) || 0,
          pagado: Number(findField('MONTO_PAGADO')) || Number(findField('PAGADO')) || 0
        };
      });

      setDebugInfo(prev => ({ ...prev, status: "Conexión exitosa" }));
      setData(items);
      setLoading(false);
    }, (err) => {
      setError(`Error: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>
  );

  // PANTALLA DE ERROR / VACÍO CON INSPECTOR DE DATOS
  if (error || data.length === 0) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Anomalía Detectada</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Depuración en tiempo real</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Proyecto</span>
            <p className="text-sm font-mono font-bold mt-1 text-blue-600">{debugInfo.projectId}</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</span>
            <p className="text-sm font-bold mt-1 text-slate-700">{debugInfo.status}</p>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-8 text-white mb-8 overflow-hidden relative">
          <div className="absolute top-6 right-8 opacity-10"><Eye size={60} /></div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 text-blue-400">Contenido del primer documento:</h3>
          {rawDoc ? (
            <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto bg-black/30 p-4 rounded-xl">
              {JSON.stringify(rawDoc, null, 2)}
            </pre>
          ) : (
            <div className="py-10 text-center border border-dashed border-white/20 rounded-xl">
              <p className="text-sm text-slate-500 font-medium italic">No se pudo leer ni un solo documento. La colección está realmente vacía o el nombre es incorrecto.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-900">Posible Solución:</span> Verifica si el nombre de la colección en Firebase tiene un espacio accidental (ej: <code className="bg-slate-100 px-1 italic">"presupuesto_2025 "</code>). Si ves campos en el cuadro negro de arriba pero los gráficos siguen vacíos, el problema es el nombre de los campos (ej: <code className="bg-slate-100 px-1 italic">"Monto Aprobado"</code> vs <code className="bg-slate-100 px-1 italic">"MONTO_APROBADO"</code>).
          </p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all">
            Re-escanear Base de Datos
          </button>
        </div>
      </div>
    </div>
  );

  // Dashboard normal... (resto del código igual que la versión anterior)
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

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans">
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
            <button onClick={() => setView('dashboard')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-500'}`}>
              <LayoutDashboard size={14} /> PANEL
            </button>
            <button onClick={() => setView('table')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${view === 'table' ? 'bg-white shadow-lg text-blue-600 scale-105' : 'text-slate-500'}`}>
              <TableIcon size={14} /> LISTADO
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <MetricCard label="Presupuesto Inicial" value={totalApproved} icon={<TrendingUp className="text-blue-600" />} />
          <MetricCard label="Monto Pagado" value={totalPaid} icon={<Wallet className="text-emerald-500" />} color="text-emerald-600" />
          <MetricCard label="Avance Ejecución" value={`${executionRate}%`} icon={<div className="font-black text-blue-600 text-xs">%</div>} color="text-blue-700" />
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 text-center">Top 8 Ramos</h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 12, 12, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
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
                    <th className="p-8">Ramo</th>
                    <th className="p-8 text-right">Aprobado</th>
                    <th className="p-8 text-right">Pagado</th>
                    <th className="p-8 text-center">Avance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-8 text-sm font-bold text-slate-700">{item.DESC_RAMO}</td>
                      <td className="p-8 text-sm text-right font-mono text-slate-400">${item.aprobado.toLocaleString()}</td>
                      <td className="p-8 text-sm text-right font-mono font-black text-slate-900">${item.pagado.toLocaleString()}</td>
                      <td className="p-8 text-center">
                        <span className="bg-blue-50 px-3 py-1.5 rounded-full text-[10px] font-black text-blue-600">
                          {item.aprobado > 0 ? ((item.pagado / item.aprobado) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
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
