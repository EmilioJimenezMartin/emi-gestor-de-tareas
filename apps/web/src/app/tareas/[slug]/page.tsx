import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskBySlug, getTasks } from "@/lib/tasks";
import {
  Rocket,
  TrendingUp,
  Zap,
  Target,
  Clock,
  Layers,
  ShieldCheck,
  Cpu,
  Globe,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return getTasks().map((t) => ({ slug: t.slug }));
}

function MiniStatCard({ icon, label, value, gradient, prefix = "" }: {
  icon: React.ReactNode,
  label: string,
  value: number | string,
  gradient: string,
  prefix?: string
}) {
  return (
    <Card variant="outline" className="relative group overflow-hidden p-5 hover:border-white/20 transition-all duration-500 bg-white/[0.02] border-white/5">
      <div className={`absolute -right-6 -top-6 w-20 h-20 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />
      <div className="relative space-y-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} w-fit text-white shadow-lg shadow-black/20`}>
          {icon}
        </div>
        <div>
          <p className="text-[7px] sm:text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">{label}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xs font-black text-neutral-600">{prefix}</span>
            <p className={`text-xl sm:text-2xl font-black tracking-tighter bg-gradient-to-br ${gradient} bg-clip-text text-transparent tabular-nums italic`}>
              {value}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function TareaDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const task = getTaskBySlug((await params).slug);
  if (!task) notFound();

  // Simple Radar Chart Points for Viability
  const metrics = [
    { label: 'ROI', val: task.viability_metrics.roi_potential },
    { label: 'Éxito', val: task.viability_metrics.success_probability },
    { label: 'Facilidad', val: task.viability_metrics.implementation_ease },
    { label: 'Recursos', val: 10 - task.viability_metrics.resource_intensity },
    { label: 'Velocidad', val: 10 - task.viability_metrics.time_to_mvp }
  ];

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col gap-6">
        <Link href="/tareas" className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors w-fit">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Volver al Explorador
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative">
          {/* Background Heading Glow */}
          <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />

          <div className="relative space-y-4 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant={task.priority === 'critical' ? 'error' : (task.priority === 'high' ? 'warning' : 'neutral')} className="text-[8px] font-black uppercase tracking-[0.2em]">
                {task.priority || "NORMAL"}
              </Badge>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-1.5 text-primary">
                <Sparkles size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest">{task.status}</span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter italic">
              {task.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {(task.categories || []).map(cat => (
                <Badge key={cat} variant="neutral" className="bg-white/5 border-white/5 text-[9px] font-black uppercase tracking-widest px-3">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-3xl backdrop-blur-xl">
            <div className="text-right">
              <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Identificador</p>
              <p className="text-xs font-mono text-neutral-300 font-bold">{task.id.substring(0, 8)}</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Rocket size={20} />
            </div>
          </div>
        </div>
      </header>

      {/* Primary Metrics Dashboard */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <MiniStatCard
            icon={<TrendingUp size={18} />}
            label="ROI Estimado"
            value={task.viability_metrics.roi_potential}
            gradient="from-emerald-600 to-teal-500"
            prefix="x"
          />
          <MiniStatCard
            icon={<ShieldCheck size={18} />}
            label="Confidence"
            value={task.viability_metrics.success_probability * 10}
            gradient="from-blue-600 to-cyan-500"
            prefix="%"
          />
          <MiniStatCard
            icon={<Zap size={18} />}
            label="Facilidad"
            value={task.viability_metrics.implementation_ease}
            gradient="from-amber-500 to-orange-500"
          />
          <MiniStatCard
            icon={<Clock size={18} />}
            label="Time To MVP"
            value={task.viability_metrics.time_to_mvp}
            gradient="from-purple-600 to-pink-500"
            prefix="v"
          />
          <MiniStatCard
            icon={<Layers size={18} />}
            label="Intensidad"
            value={task.viability_metrics.resource_intensity}
            gradient="from-rose-500 to-red-600"
          />
          <MiniStatCard
            icon={<Target size={18} />}
            label="Escalabilidad"
            value={8}
            gradient="from-indigo-600 to-violet-500"
          />
        </div>

        <div className="lg:col-span-4 h-full">
          <Card variant="glass" className="h-full p-6 flex flex-col justify-between border-white/5 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Balance de Viabilidad</h3>
              <Badge variant="neutral" className="text-[8px] font-black">ALPHA CORE</Badge>
            </div>
            {/* Simple Polar Radar Chart SVG */}
            <div className="flex-1 flex items-center justify-center relative min-h-[180px]">
              <svg viewBox="0 0 100 100" className="w-48 h-48 overflow-visible">
                <circle cx="50" cy="50" r="45" className="fill-none stroke-white/[0.03] stroke-[0.5]" />
                <circle cx="50" cy="50" r="30" className="fill-none stroke-white/[0.03] stroke-[0.5]" />
                <circle cx="50" cy="50" r="15" className="fill-none stroke-white/[0.03] stroke-[0.5]" />

                {/* Polygon */}
                {(() => {
                  const points = metrics.map((m, i) => {
                    const angle = (i / metrics.length) * 2 * Math.PI - Math.PI / 2;
                    const r = (m.val / 10) * 45;
                    const x = 50 + r * Math.cos(angle);
                    const y = 50 + r * Math.sin(angle);
                    return `${x},${y}`;
                  }).join(' ');
                  return <polygon points={points} className="fill-primary/20 stroke-primary stroke-[1.5] transition-all duration-1000 animate-in fade-in" />;
                })()}
              </svg>
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-full h-full">
                  {metrics.map((m, i) => {
                    const angle = (i / metrics.length) * 2 * Math.PI - Math.PI / 2;
                    const x = 50 + 52 * Math.cos(angle);
                    const y = 50 + 52 * Math.sin(angle);
                    return (
                      <span key={m.label} className="absolute text-[6px] font-black uppercase text-neutral-600 tracking-tighter" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
                        {m.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Content Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Business & Logic */}
        <div className="lg:col-span-8 space-y-8 min-w-0">
          <Card variant="outline" className="p-5 sm:p-8 space-y-6 border-white/5 bg-white/[0.02] max-w-full overflow-hidden">
            <div className="space-y-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Rocket className="text-primary" size={20} />
                Visión Estratégica
              </h2>
              <div className="h-1 w-20 bg-gradient-to-r from-primary to-transparent rounded-full" />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Desafío Identificado</h4>
                  <p className="text-sm italic leading-relaxed text-neutral-400">"{task.business_logic.problem}"</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Solución Propuesta</h4>
                  <p className="text-sm leading-relaxed text-neutral-200">{task.business_logic.solution}</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Pipeline de Implementación</h4>
              <div className="space-y-4 relative ml-2 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                {task.execution_pipeline.sort((a, b) => a.step - b.step).map((step) => (
                  <div key={step.step} className="relative pl-6">
                    <div className="absolute left-[-4px] top-2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(25,113,255,0.4)]" />
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="text-[8px] font-black text-primary uppercase shrink-0">Paso {step.step}</span>
                      <h5 className="text-sm font-bold text-white leading-snug">{step.task}</h5>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed">{step.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0">
              <Card variant="outline" className="p-5 sm:p-6 border-white/5 bg-white/[0.01] h-full max-w-full overflow-hidden">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Monetización</h3>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full">
                  {task.business_logic.monetization.map(m => (
                    <div key={m} className="flex items-start gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5 text-[10px] font-bold text-neutral-300 transition-colors hover:border-primary/30 w-full sm:w-auto break-words">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                      <span className="leading-relaxed whitespace-normal break-words min-w-0">{m}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="min-w-0">
              <Card variant="outline" className="p-5 sm:p-6 border-white/5 bg-white/[0.01] h-full max-w-full overflow-hidden">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Esquema de Datos</h3>
                <div className="rounded-xl bg-black/40 p-4 border border-white/5 max-h-[150px] overflow-auto font-mono text-[9px] text-blue-400/70 scrollbar-thin scrollbar-thumb-white/10 w-full">
                  <pre className="whitespace-pre-wrap break-all min-w-0">{JSON.stringify(task.data_schema_preview, null, 2)}</pre>
                </div>
              </Card>
            </div>
          </section>
        </div>

        {/* Right Column: Stack & Automation */}
        <div className="lg:col-span-4 space-y-8">
          <Card variant="outline" className="p-6 space-y-6 border-white/5 bg-white/[0.02]">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Cpu size={16} className="text-primary" />
              Arquitectura de Ejecución
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3 shrink-0">
                  <Layers size={14} className="text-neutral-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-neutral-400">Core</span>
                </div>
                <span className="text-xs font-black text-white text-right truncate">{task.technical_stack.framework}</span>
              </div>
              <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3 shrink-0">
                  <Clock size={14} className="text-neutral-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-neutral-400">Schedule</span>
                </div>
                <span className="text-xs font-mono font-bold text-primary text-right truncate">{task.automation_config.cron_schedule}</span>
              </div>
              <div className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3 shrink-0">
                  <Globe size={14} className="text-neutral-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-neutral-400">Database</span>
                </div>
                <span className="text-xs font-black text-neutral-300 text-right truncate">{task.technical_stack.database}</span>
              </div>
            </div>

            <div>
              <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mb-3 ml-1">Protocolos de Red (APIs)</h4>
              <div className="flex flex-col gap-2">
                {task.technical_stack.apis_required.map(api => (
                  <div key={api} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5 group hover:border-primary/20 transition-colors">
                    <span className="text-[10px] font-bold text-neutral-400">{api}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] group-hover:animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-6 border-primary/10 bg-primary/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
              <Zap size={14} />
              Estado del Motor
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-neutral-500 uppercase">Notificaciones</span>
                <Badge variant={task.automation_config.auto_notify_telegram ? "success" : "neutral"} className="text-[8px] font-black">
                  {task.automation_config.auto_notify_telegram ? "ESTABLECIDO" : "NO ACTIVO"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-neutral-500 uppercase">Distribución Marketplace</span>
                <Badge variant={task.automation_config.auto_publish_to_marketplace ? "success" : "neutral"} className="text-[8px] font-black">
                  {task.automation_config.auto_publish_to_marketplace ? "ACTIVO" : "PENDIENTE"}
                </Badge>
              </div>
              <div className="h-px bg-white/5 my-2" />
              <Button variant="secondary" className="w-full text-[10px] font-black uppercase tracking-widest h-10 shadow-lg shadow-primary/10">
                Ejecutar Motor Manualmente
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}