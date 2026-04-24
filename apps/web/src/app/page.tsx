import { getTasks } from "@/lib/tasks";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  BarChart3,
  Cpu,
  Zap,
  LayoutGrid,
  TrendingUp,
  Sparkles,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const tasks = getTasks();

  const highPriority = tasks.filter(t => t.priority === "high" || t.priority === "critical").length;
  const categoriesCount = Array.from(new Set(tasks.flatMap(t => t.categories || []))).length;
  const activeTasks = tasks.filter(t => t.status === "active").length;
  const avgROI = tasks.reduce((acc, t) => acc + (t.viability_metrics?.roi_potential || 0), 0) / tasks.length;

  // Aggregate Data for Charts
  const tasksByCategory = Array.from(new Set(tasks.flatMap(t => t.categories || []))).map(cat => ({
    name: cat,
    count: tasks.filter(t => (t.categories || []).includes(cat)).length,
    avgROI: tasks.filter(t => (t.categories || []).includes(cat)).reduce((acc, t) => acc + (t.viability_metrics?.roi_potential || 0), 0) /
      tasks.filter(t => (t.categories || []).includes(cat)).length || 0
  })).sort((a, b) => b.count - a.count);

  const techEcosystem = Array.from(new Set(tasks.map(t => t.technical_stack.framework))).map(tech => ({
    name: tech,
    count: tasks.filter(t => t.technical_stack.framework === tech).length
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles size={16} className="sm:size-5" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Dashboard de Control</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
          Bienvenido, <span className="text-primary">Emilio</span>
        </h1>
        <p className="text-sm sm:text-base text-neutral-500 max-w-2xl">
          Gestiona tus motores de inversión y las métricas de rendimiento en tiempo real.
        </p>
      </header>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Rocket size={20} />}
          label="Motores Totales"
          value={tasks.length}
          trend="+2"
          gradient="from-blue-600 to-cyan-500"
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          label="Retorno Medio"
          value={avgROI.toFixed(1)}
          trend="high alpha"
          gradient="from-emerald-600 to-teal-500"
        />
        <StatCard
          icon={<Cpu size={20} />}
          label="Categorías"
          value={categoriesCount}
          gradient="from-purple-600 to-pink-500"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="En Ejecución"
          value={activeTasks}
          gradient="from-amber-500 to-orange-500"
        />
      </section>

      {/* New Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-12 flex flex-col gap-6">
          <h2 className="text-xl font-bold tracking-tight">Análisis de Rendimiento</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card variant="glass" className="p-6 h-[400px] flex flex-col gap-6 border-white/5 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Distribución por Categoría</h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Motores cargados</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <LayoutGrid size={16} />
                </div>
              </div>
              <BarChart data={tasksByCategory} />
            </Card>

            <Card variant="glass" className="p-6 h-[400px] flex flex-col gap-6 border-white/5 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Análisis de Alpha (ROI)</h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Probabilidad de retorno</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp size={16} />
                </div>
              </div>
              <AreaChart data={tasksByCategory} />
            </Card>

            <Card variant="glass" className="p-6 h-[400px] flex flex-col gap-6 border-white/5 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Ecosistema Tecnológico</h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Frameworks predominantes</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Cpu size={16} />
                </div>
              </div>
              <TechChart data={techEcosystem} />
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: any[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const gradients = [
    "from-blue-600 to-cyan-400",
    "from-emerald-600 to-teal-400",
    "from-purple-600 to-pink-400",
    "from-amber-500 to-orange-400",
    "from-rose-600 to-red-400",
    "from-indigo-600 to-violet-400",
    "from-cyan-600 to-blue-400"
  ];

  return (
    <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-6 min-h-0">
      {data.slice(0, 6).map((d, i) => (
        <div key={d.name} className="flex-1 flex flex-col items-center gap-3 group h-full">
          <div className="flex-1 w-full flex items-end">
            <div
              className={`w-full bg-gradient-to-t ${gradients[i % gradients.length]} rounded-t-lg transition-all duration-1000 ease-out relative`}
              style={{ height: `${(d.count / max) * 100}%`, animation: `chart-grow 1s ease-out ${i * 0.1}s forwards` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-[9px] font-black px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                {d.count} MOTORES
              </div>
            </div>
          </div>
          <span className="text-[8px] font-black text-neutral-500 uppercase tracking-tighter truncate w-full text-center">
            {d.name.substring(0, 6)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TechChart({ data }: { data: any[] }) {
  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
      {data.map((d, i) => (
        <div key={d.name} className="space-y-2 group">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span className="text-neutral-400 group-hover:text-white transition-colors">{d.name}</span>
            <span className="text-primary italic">{d.count}</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-1000"
              style={{ width: `${(d.count / max) * 100}%`, animation: `fade-in 1s ease-out ${i * 0.1}s forwards` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AreaChart({ data }: { data: any[] }) {
  // Simple SVG Area Chart
  const filteredData = data.filter(d => d.avgROI > 0).slice(0, 8);
  const maxROI = 10;
  const width = 400;
  const height = 200;

  const points = filteredData.map((d, i) => {
    const x = (i / (filteredData.length - 1)) * width;
    const y = height - (d.avgROI / maxROI) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex-1 relative min-h-0">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <polyline
            points={areaPoints}
            fill="url(#areaGradient)"
            className="animate-in fade-in duration-1000"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-in slide-in-from-bottom duration-1000 stroke-dasharray-[1000] stroke-dashoffset-[1000] animate-[draw_2s_ease-out_forwards]"
          />

          {/* Dots */}
          {filteredData.map((d, i) => {
            const x = (i / (filteredData.length - 1)) * width;
            const y = height - (d.avgROI / maxROI) * height;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="#10b981"
                className="hover:r-6 transition-all cursor-pointer opacity-0 animate-[fade-in_0.5s_ease-out_forwards]"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex justify-between items-center gap-2">
        {filteredData.map((d, i) => (
          <span key={i} className="text-[7px] font-bold text-neutral-600 uppercase tracking-tighter truncate">
            {d.name.substring(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, gradient }: {
  icon: React.ReactNode,
  label: string,
  value: number | string,
  trend?: string,
  gradient: string
}) {
  return (
    <Card variant="outline" className="relative group overflow-hidden p-6 hover:border-white/20 transition-all duration-500 bg-white/[0.02] border-white/5">
      {/* Background Glow */}
      <div className={`absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-500`} />

      <div className="relative space-y-4">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient} w-fit text-white shadow-lg shadow-black/20`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className={`text-4xl font-black tracking-tighter bg-gradient-to-br ${gradient} bg-clip-text text-transparent italic tabular-nums`}>
              {value}
            </p>
            {trend && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-neutral-400 uppercase tracking-tighter`}>
                {trend}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
