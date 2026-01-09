import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, query } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Wallet, Landmark, TrendingUp, Table as TableIcon, LayoutDashboard } from 'lucide-react';

/**
 * CONFIGURACIÓN DE FIREBASE
 * Se ha ajustado para evitar el error de 'import.meta' en entornos de compatibilidad es2015.
 * Para producción en GitHub Pages, estas variables se inyectan correctamente, 
 * pero aquí usamos un acceso seguro o valores por defecto para la previsualización.
 */
const getFirebaseConfig = () => {
  // Intento de lectura compatible con múltiples entornos
  const env = typeof process !== 'undefined' ? process.env : {};
  
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || "", 
    authDomain: `${env.VITE_FIREBASE_PROJECT_ID || "proyecto"}.firebaseapp.com`,
    projectId: env.VITE_FIREBASE_PROJECT_ID || "proyecto",
    storageBucket: `${env.VITE_FIREBASE_PROJECT_ID || "proyecto"}.appspot.com`,
    messagingSenderId: "123456789", 
    appId: env.VITE_FIREBASE_APP_ID || ""
  };
};

const firebaseConfig = getFirebaseConfig();

// Inicializar Firebase con validación básica
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard' o 'table'

  useEffect(() => {
    // Referencia a la colección 'presupuesto_2025'
    const q = query(collection(db, "presupuesto_2025"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(items);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener datos: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cálculos de métricas globales
  const totalApproved = data.reduce((acc, curr) => acc + (Number(curr[" MONTO_APROBADO"]) || 0), 0);
  const totalPaid = data.reduce((acc, curr) => acc + (Number(curr[" MONTO_PAGADO"]) || 0), 0);
  const executionRate = totalApproved > 0 ? ((totalPaid / totalApproved) * 100).toFixed(2) : 0;

  // Procesamiento de datos para los gráficos (Top 5 Ramos por monto aprobado)
  const chartData = data.reduce((acc, curr) => {
    const ramo = curr.DESC_RAMO || "Otros";
    const existing = acc.find(item => item.name === ramo);
    if (existing) {
      existing.aprobado += (Number(curr[" MONTO_APROBADO"]) || 0);
      existing.pagado += (Number(curr[" MONTO_PAGADO"]) || 0);
    } else {
      acc.push({ 
        name: ramo, 
        aprobado: (Number(curr[" MONTO_APROBADO"]) || 0), 
        pagado: (Number(curr[" MONTO_PAGADO"]) || 0) 
      });
    }
    return acc;
  }, []).sort((a, b) => b.aprobado - a.aprobado).slice(0, 5);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium italic">Sincronizando con Firebase Firestore...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Barra de Navegación */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Landmark className="text-blue-600 w-8 h-8" />
              <span className="font-bold text-xl tracking-tight hidden md:block">Presupuesto Público 2025</span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutDashboard size={18} /> Panel
              </button>
              <button 
                onClick={() => setView('table')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <TableIcon size={18} /> Tabla
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tarjetas de KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-2 text-slate-500">
              <Wallet size={20} />
              <span className="text-xs font-bold uppercase">Monto Aprobado</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">
              ${totalApproved.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-2 text-slate-500">
              <TrendingUp size={20} />
              <span className="text-xs font-bold uppercase">Monto Pagado</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-2 text-slate-500">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">%</div>
              <span className="text-xs font-bold uppercase">Ejecución del Gasto</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{executionRate}%</div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${executionRate}%` }}></div>
            </div>
          </div>
        </div>

        {view === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico de Barras */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-6 text-slate-700">Top 5 Ramos (Aprobado vs Pagado)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      formatter={(value) => `$${value.toLocaleString()}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar name="Aprobado" dataKey="aprobado" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar name="Pagado" dataKey="pagado" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Pastel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-6 text-slate-700">Distribución de Gasto Pagado</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="pagado"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          /* Vista de Tabla Detallada */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ciclo</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción Ramo</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aprobado</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm text-slate-500">{item.CICLO}</td>
                      <td className="p-4">
                        <div className="text-sm font-semibold text-slate-800">{item.DESC_RAMO}</div>
                        <div className="text-[10px] text-slate-400">UR: {item.DESC_UR}</div>
                      </td>
                      <td className="p-4 text-sm text-right font-mono">
                        ${(Number(item[" MONTO_APROBADO"]) || 0).toLocaleString()}
                      </td>
                      <td className="p-4 text-sm text-right font-mono font-bold text-emerald-600">
                        ${(Number(item[" MONTO_PAGADO"]) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-400 text-[10px] uppercase tracking-widest">
        Dashboard conectado a Google Firebase Firestore • 2025
      </footer>
    </div>
  );
};

export default App;
