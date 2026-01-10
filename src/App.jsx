import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, ShieldAlert, Key, ArrowUpRight, Activity, Database, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

/**
 * Firebase Configuration Loader
 */
const getFirebaseConfig = () => {
  try {
    let rawConfig = null;
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      rawConfig = __firebase_config;
    } 
    else if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_CONFIG) {
      rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    }
    if (!rawConfig) return null;
    if (typeof rawConfig === 'object') return rawConfig;

    try {
      let cleanJson = rawConfig.trim().replace(/\\n/g, '').replace(/\\/g, '');
      const parsed = JSON.parse(cleanJson);
      return (parsed.apiKey && parsed.projectId) ? parsed : null;
    } catch (jsonErr) {
      return null;
    }
  } catch (error) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dashboard-presupuesto-2025';

let db = null;
let auth = null;

if (firebaseConfig) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase init error:", e.message);
  }
}

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);

  // Estados de Filtros
  const [selectedRamo, setSelectedRamo] = useState('all');
  const [selectedUR, setSelectedUR] = useState('all');

  // Estado de Ordenamiento de Tabla
  const [sortConfig, setSortConfig] = useState({ key: 'ramo', direction: 'asc' });

  useEffect(() => {
    if (!firebaseConfig || !auth) {
      const timer = setTimeout(() => {
        if (!auth) {
          setError("Configuración no detectada. Verifica los Secrets de GitHub.");
          setLoading(false);
        }
      }, 3000);
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
        setError(`Fallo de conexión: Verifica el inicio anónimo en Firebase.`);
        setLoading(false);
      }
    };

    performAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(collectionPath, 
      (snapshot) => {
        const result = snapshot.docs.map(doc => {
          const d = doc.data();
          const aprobado = Number(d.MONTO_APROBADO) || 0;
          const pagado = Number(d.MONTO_PAGADO) || 0;
          return {
            id: doc.id,
            ramo: d.DESC_RAMO || "Sin clasificar",
            aprobado,
            pagado,
            avance: aprobado > 0 ? (pagado / aprobado) * 100 : 0,
            ur: d.DESC_UR || "N/A"
          };
        });
        setData(result);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error de acceso: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Lógica de Filtros y Ordenamiento
  const uniqueRamos = useMemo(() => ['all', ...new Set(data.map(d => d.ramo))].sort(), [data]);
  const uniqueURs = useMemo(() => {
    const filtered = selectedRamo === 'all' ? data : data.filter(d => d.ramo === selectedRamo);
    return ['all', ...new Set(filtered.map(d => d.ur))].sort();
  }, [data, selectedRamo]);

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter(d => {
      const matchRamo = selectedRamo === 'all' || d.ramo === selectedRamo;
      const matchUR = selectedUR === 'all' || d.ur === selectedUR;
      return matchRamo && matchUR;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, selectedRamo, selectedUR, sortConfig]);

  // Función para cambiar el orden
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Analítica basada en datos filtrados
  const analytics = useMemo(() => {
    const totalAprobado = filteredAndSortedData.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPagado = filteredAndSortedData.reduce((acc, curr) => acc + curr.pagado, 0);
    const porcentaje = totalAprobado > 0 ? ((totalPagado / totalAprobado) * 100).toFixed(1) : "0.0";
    
    const agrupado = filteredAndSortedData.reduce((acc, curr) => {
      const clave = curr.ramo;
      if (!acc[clave]) acc[clave] = { name: clave, aprobado: 0, pagado: 0 };
      acc[clave].aprobado += curr.aprobado;
      acc[clave].pagado += curr.pagado;
      return acc;
    }, {});

    const topRamos = Object.values(agrupado).sort((a, b) => b.aprobado - a.aprobado).slice(0, 8);
    return { totalAprobado, totalPagado, porcentaje, topRamos };
  }, [filteredAndSortedData]);

  // Título Dinámico
  const dynamicTitle = useMemo(() => {
    if (selectedUR !== 'all') return selectedUR;
    if (selectedRamo !== 'all') return selectedRamo;
    return "Consolidado Nacional";
  }, [selectedRamo, selectedUR]);

  if (loading && !error) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Sincronizando visor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-12 font-sans">
      <nav className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 px-8 h-20 flex justify-between items-center shadow-sm">
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
          <button onClick={() => setView('dashboard')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'dashboard' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            DASHBOARD
          </button>
          <button onClick={() => setView('table')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${view === 'table' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            EXPLORADOR
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-10">
        {error ? (
          <div className="bg-white border border-slate-200 rounded-[3rem] p-12 text-center shadow-xl">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Error de Configuración</h2>
            <p className="text-slate-500 max-w-2xl mx-auto mb-8 font-medium">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="max-w-2xl">
                  <h2 className="text-4xl font-black text-slate-900 leading-tight tracking-tight mb-2 uppercase">
                    {dynamicTitle}
                  </h2>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Activity size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">Estado de Ejecución Presupuestal 2025</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="relative">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Filtrar por Ramo</label>
                    <div className="relative">
                      <select 
                        value={selectedRamo}
                        onChange={(e) => { setSelectedRamo(e.target.value); setSelectedUR('all'); }}
                        className="appearance-none bg-white border border-slate-200 px-5 py-3 pr-12 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      >
                        <option value="all">Todos los Ramos</option>
                        {uniqueRamos.filter(r => r !== 'all').map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Filtrar por Institución</label>
                    <div className="relative">
                      <select 
                        value={selectedUR}
                        onChange={(e) => setSelectedUR(e.target.value)}
                        className="appearance-none bg-white border border-slate-200 px-5 py-3 pr-12 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      >
                        <option value="all">Todas las Instituciones (UR)</option>
                        {uniqueURs.filter(u => u !== 'all').map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <MetricCard label="Monto Aprobado" value={analytics.totalAprobado} icon={<TrendingUp size={20} />} />
              <MetricCard label="Monto Pagado" value={analytics.totalPagado} icon={<Wallet size={20} />} color="text-emerald-600" />
              
              <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-center items-center">
                 <div className="absolute top-6 left-8 flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                      <Activity size={16} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance</span>
                 </div>
                 
                 <div className="w-full h-40 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: Number(analytics.porcentaje) },
                            { value: 100 - Math.min(Number(analytics.porcentaje), 100) }
                          ]}
                          cx="50%"
                          cy="85%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={0}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#f59e0b" />
                          <Cell fill="#f1f5f9" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-6 w-full text-center left-0">
                      <span className="text-4xl font-black text-slate-900 tracking-tighter">{analytics.porcentaje}%</span>
                    </div>
                 </div>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-[3.5rem] p-24 text-center">
                <Database className="mx-auto mb-6 text-blue-300" size={48} />
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Base de datos vacía</h3>
                <p className="text-slate-500 text-sm mt-2">Sincroniza registros en la colección <code className="bg-blue-100 px-2 py-1 rounded text-blue-700 font-bold">presupuesto_2025</code>.</p>
              </div>
            ) : (
              view === 'dashboard' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <ChartBox title="Gasto por Ramo Administrativo (Top)">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={analytics.topRamos} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', fontWeight: 'bold'}} />
                        <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartBox>

                  <ChartBox title="Distribución de Pagos Realizados">
                    <ResponsiveContainer width="100%" height={380}>
                      <PieChart>
                        <Pie data={analytics.topRamos} dataKey="pagado" innerRadius={80} outerRadius={110} paddingAngle={8}>
                          {analytics.topRamos.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '20px', border: 'none', fontWeight: 'bold'}} />
                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', paddingTop: '20px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartBox>
                </div>
              ) : (
                <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-sm overflow-hidden mb-10">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Registros Detallados ({filteredAndSortedData.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <SortHeader label="Clasificación / Institución" sortKey="ramo" currentSort={sortConfig} onSort={requestSort} />
                          <SortHeader label="Aprobado" sortKey="aprobado" currentSort={sortConfig} onSort={requestSort} align="text-right" />
                          <SortHeader label="Pagado" sortKey="pagado" currentSort={sortConfig} onSort={requestSort} align="text-right" />
                          <SortHeader label="Avance" sortKey="avance" currentSort={sortConfig} onSort={requestSort} align="text-center" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAndSortedData.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-8">
                              <p className="text-[10px] font-bold text-blue-500 mb-1">{item.ur}</p>
                              <p className="text-sm font-black text-slate-700 leading-tight">{item.ramo}</p>
                            </td>
                            <td className="p-8 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                              ${item.aprobado.toLocaleString('es-MX')}
                            </td>
                            <td className="p-8 text-right font-mono text-sm font-black text-slate-900 whitespace-nowrap">
                              ${item.pagado.toLocaleString('es-MX')}
                            </td>
                            <td className="p-8 text-center">
                              <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl text-[11px] font-black text-blue-600 border border-blue-100">
                                {item.avance.toFixed(1)}%
                                <ArrowUpRight size={12} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
};

// Componente para Encabezados Ordenables
const SortHeader = ({ label, sortKey, currentSort, onSort, align = "text-left" }) => {
  const isActive = currentSort.key === sortKey;
  
  return (
    <th 
      onClick={() => onSort(sortKey)} 
      className={`p-8 cursor-pointer select-none group hover:bg-slate-100 transition-colors ${align}`}
    >
      <div className={`flex items-center gap-2 ${align === 'text-right' ? 'justify-end' : align === 'text-center' ? 'justify-center' : 'justify-start'}`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
          {label}
        </span>
        <div className={`transition-colors ${isActive ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {!isActive ? <ArrowUpDown size={12} /> : currentSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
    </th>
  );
};

const MetricCard = ({ label, value, icon, color = "text-slate-900" }) => (
  <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm hover:border-blue-400 transition-all group overflow-hidden h-full flex flex-col justify-center">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
    </div>
    <h2 className={`text-4xl font-black tracking-tight ${color}`}>
      ${typeof value === 'number' ? value.toLocaleString('es-MX') : value}
    </h2>
  </div>
);

const ChartBox = ({ title, children }) => (
  <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">
    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12 flex items-center gap-3">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
      {title}
    </h3>
    {children}
  </div>
);

export default App;
