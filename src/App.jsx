import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Landmark, TrendingUp, Wallet, ShieldAlert, ArrowUpRight, Activity, Database, ChevronDown, ChevronUp, ArrowUpDown, Filter, PieChart as PieIcon } from 'lucide-react';

/**
 * Firebase Config
 */
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'dashboard-presupuesto-2025';

let db = null;
let auth = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
}

const App = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('dashboard');
  const [user, setUser] = useState(null);

  const [selectedRamo, setSelectedRamo] = useState('all');
  const [selectedUR, setSelectedUR] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'pagado', direction: 'desc' });

  // 1. Autenticación
  useEffect(() => {
    if (!auth) {
      setError("Configuración de Firebase no encontrada.");
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
        setError("Error de conexión con el servicio de seguridad.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. Carga de Datos
  useEffect(() => {
    if (!user || !db) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'presupuesto_2025');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const result = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ramo: d.DESC_RAMO || "Sin clasificar",
            ur: d.DESC_UR || "N/A",
            capitulo: d.DESC_CAPITULO || "Otros",
            aprobado: Number(d.MONTO_APROBADO) || 0,
            pagado: Number(d.MONTO_PAGADO) || 0,
          };
        });
        setRawData(result);
        setLoading(false);
      }, 
      (err) => {
        setError(`Error de Firestore: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // 3. Lógica de Agrupación por UR y Filtrado
  const processedData = useMemo(() => {
    // Primero filtramos los datos crudos por Ramo (para que la agrupación sea coherente)
    const filteredRaw = rawData.filter(d => selectedRamo === 'all' || d.ramo === selectedRamo);

    // Agrupamos por UR sumando montos
    const groups = filteredRaw.reduce((acc, curr) => {
      const key = curr.ur;
      if (!acc[key]) {
        acc[key] = { 
          ur: key, 
          ramo: curr.ramo, 
          aprobado: 0, 
          pagado: 0, 
          registros: 0 
        };
      }
      acc[key].aprobado += curr.aprobado;
      acc[key].pagado += curr.pagado;
      acc[key].registros += 1;
      return acc;
    }, {});

    // Convertimos a array y calculamos avance
    let result = Object.values(groups).map(g => ({
      ...g,
      avance: g.aprobado > 0 ? (g.pagado / g.aprobado) * 100 : 0
    }));

    // Filtro secundario por UR (si aplica)
    if (selectedUR !== 'all') {
      result = result.filter(d => d.ur === selectedUR);
    }

    // Ordenamiento
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawData, selectedRamo, selectedUR, sortConfig]);

  // 4. Analítica para Gráficos
  const analytics = useMemo(() => {
    const totalAprobado = processedData.reduce((acc, curr) => acc + curr.aprobado, 0);
    const totalPagado = processedData.reduce((acc, curr) => acc + curr.pagado, 0);
    
    // Gráfico de Top Ramos (Basado en datos procesados)
    const topRamos = Object.values(processedData.reduce((acc, curr) => {
      if (!acc[curr.ramo]) acc[curr.ramo] = { name: curr.ramo, aprobado: 0 };
      acc[curr.ramo].aprobado += curr.aprobado;
      return acc;
    }, {})).sort((a, b) => b.aprobado - a.aprobado).slice(0, 5);

    // Gráfico de Capítulos (Calculado sobre los datos filtrados pero no agrupados por UR)
    const filterForCap = rawData.filter(d => {
        const matchRamo = selectedRamo === 'all' || d.ramo === selectedRamo;
        const matchUR = selectedUR === 'all' || d.ur === selectedUR;
        return matchRamo && matchUR;
    });
    
    const capGroups = filterForCap.reduce((acc, curr) => {
      const key = curr.capitulo;
      if (!acc[key]) acc[key] = { name: key, value: 0 };
      acc[key].value += curr.pagado;
      return acc;
    }, {});

    return { 
      totalAprobado, 
      totalPagado, 
      porcentaje: totalAprobado > 0 ? ((totalPagado / totalAprobado) * 100).toFixed(1) : "0.0",
      topRamos,
      capitulos: Object.values(capGroups).sort((a, b) => b.value - a.value)
    };
  }, [processedData, rawData, selectedRamo, selectedUR]);

  // Opciones de filtros
  const filterOptions = useMemo(() => ({
    ramos: ['all', ...new Set(rawData.map(d => d.ramo))].sort(),
    urs: ['all', ...new Set(rawData.filter(d => selectedRamo === 'all' || d.ramo === selectedRamo).map(d => d.ur))].sort()
  }), [rawData, selectedRamo]);

  if (loading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-900 font-sans">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 px-8 h-20 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Landmark size={20} />
          </div>
          <div>
            <h1 className="font-black text-lg leading-none tracking-tight">CONSOLIDADO FISCAL</h1>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Gasto Agrupado por Institución</p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} label="MÉTRICAS" />
          <NavButton active={view === 'table'} onClick={() => setView('table')} label="LISTADO UR" />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {error ? <ErrorState message={error} /> : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-end">
              <div className="lg:col-span-6">
                <h2 className="text-4xl font-black text-slate-900 leading-tight uppercase tracking-tighter">
                  {selectedUR !== 'all' ? selectedUR : selectedRamo !== 'all' ? selectedRamo : "Ejecución Presupuestal"}
                </h2>
                <div className="flex items-center gap-3 mt-2 text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded">URs Activas: {processedData.length}</span>
                </div>
              </div>
              <div className="lg:col-span-3">
                <FilterSelect label="Ramo" value={selectedRamo} onChange={(v) => { setSelectedRamo(v); setSelectedUR('all'); }} options={filterOptions.ramos} />
              </div>
              <div className="lg:col-span-3">
                <FilterSelect label="Institución (UR)" value={selectedUR} onChange={setSelectedUR} options={filterOptions.urs} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <MetricCard label="Aprobado Consolidado" value={analytics.totalAprobado} icon={<TrendingUp size={20} />} />
              <MetricCard label="Pagado Consolidado" value={analytics.totalPagado} icon={<Wallet size={20} />} accent="emerald" />
              <MetricCard label="Avance de Gestión" value={`${analytics.porcentaje}%`} icon={<Activity size={20} />} accent="blue" isRaw />
            </div>

            {view === 'dashboard' ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <ChartContainer title="Gasto por Capítulo (Pagado)">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={analytics.capitulos} dataKey="value" innerRadius={60} outerRadius={85} paddingAngle={5}>
                          {analytics.capitulos.map((_, i) => <Cell key={i} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][i % 6]} />)}
                        </Pie>
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', fontSize: '12px'}} formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>

                  <ChartContainer title="Presupuesto por Ramo (Aprobado)">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.topRamos} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 8, fontWeight: 800}} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                        <Bar dataKey="aprobado" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={15} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>

                  <ChartContainer title="Resumen de Distribución">
                    <div className="space-y-4 pt-4">
                      {analytics.capitulos.slice(0, 4).map((cap, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-3">
                          <span className="text-[10px] font-bold text-slate-500 truncate w-32 uppercase">{cap.name}</span>
                          <span className="text-xs font-black text-slate-900">${cap.value.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="pt-2 text-center">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Gráfico de Capítulos Actualizado</span>
                      </div>
                    </div>
                  </ChartContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <SortTh label="Unidad Responsable (UR)" sortKey="ur" config={sortConfig} onSort={(k) => setSortConfig(p => ({key:k, direction: p.key===k&&p.direction==='asc'?'desc':'asc'}))} />
                        <SortTh label="Suma Aprobado" sortKey="aprobado" config={sortConfig} onSort={(k) => setSortConfig(p => ({key:k, direction: p.key===k&&p.direction==='asc'?'desc':'asc'}))} align="text-right" />
                        <SortTh label="Suma Pagado" sortKey="pagado" config={sortConfig} onSort={(k) => setSortConfig(p => ({key:k, direction: p.key===k&&p.direction==='asc'?'desc':'asc'}))} align="text-right" />
                        <SortTh label="Avance Promedio" sortKey="avance" config={sortConfig} onSort={(k) => setSortConfig(p => ({key:k, direction: p.key===k&&p.direction==='asc'?'desc':'asc'}))} align="text-center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {processedData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                {item.registros}
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter block">{item.ramo}</span>
                                <span className="text-sm font-bold text-slate-700 leading-tight block">{item.ur}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-right font-mono text-xs text-slate-400">${item.aprobado.toLocaleString()}</td>
                          <td className="p-6 text-right font-mono text-sm font-black text-slate-900">${item.pagado.toLocaleString()}</td>
                          <td className="p-6 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-100 px-3 py-1.5 rounded-full text-[10px] font-black text-blue-600 shadow-sm">
                              {item.avance.toFixed(1)}% <ArrowUpRight size={10} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// Componentes Auxiliares
const NavButton = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${active ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
    {label}
  </button>
);

const MetricCard = ({ label, value, icon, accent = "blue", isRaw = false }) => (
  <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-xl bg-${accent}-50 text-${accent}-600`}>{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
    <h2 className={`text-3xl font-black tracking-tight text-slate-900`}>{isRaw ? value : `$${value.toLocaleString()}`}</h2>
  </div>
);

const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-1"><Filter size={10} /> {label}</label>
    <div className="relative group">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none bg-white border border-slate-200 px-4 py-3 pr-10 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer">
        <option value="all">Ver todo</option>
        {options.filter(o => o !== 'all').map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
    </div>
  </div>
);

const ChartContainer = ({ title, children }) => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
      <PieIcon size={12} className="text-blue-500" /> {title}
    </h3>
    {children}
  </div>
);

const SortTh = ({ label, sortKey, config, onSort, align = "text-left" }) => {
  const active = config.key === sortKey;
  return (
    <th onClick={() => onSort(sortKey)} className={`p-6 cursor-pointer hover:bg-slate-100/50 transition-colors group ${align}`}>
      <div className={`flex items-center gap-2 ${align === 'text-right' ? 'justify-end' : align === 'text-center' ? 'justify-center' : ''}`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
        {active ? (config.direction === 'asc' ? <ChevronUp size={12} className="text-blue-600" /> : <ChevronDown size={12} className="text-blue-600" />) : <ArrowUpDown size={10} className="text-slate-300" />}
      </div>
    </th>
  );
};

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-white">
    <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Consolidando registros...</p>
  </div>
);

const ErrorState = ({ message }) => (
  <div className="bg-red-50 p-12 text-center max-w-2xl mx-auto mt-20 rounded-[3rem]">
    <ShieldAlert className="mx-auto text-red-500 mb-6" size={48} />
    <h3 className="text-xl font-black text-red-900 uppercase">Error de Sincronización</h3>
    <p className="text-red-700/70 text-sm mt-2">{message}</p>
  </div>
);

export default App;
