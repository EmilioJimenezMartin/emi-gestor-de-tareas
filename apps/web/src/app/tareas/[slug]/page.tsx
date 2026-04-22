import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskBySlug, getTasks } from "@/lib/tasks";

export function generateStaticParams() {
  return getTasks().map((t) => ({ slug: t.slug }));
}

// Componente pequeño para las barras de progreso de métricas
function MetricBar({ label, value, colorClass, gradientFrom, gradientTo }: {
  label: string,
  value: number,
  colorClass: string,
  gradientFrom: string,
  gradientTo: string
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
        <span className="text-sm font-black text-white tabular-nums">{value}/10</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/[0.03] border border-white/[0.05] overflow-hidden">
        {/* Glow effect background */}
        <div
          className={`absolute inset-0 opacity-20 blur-sm ${colorClass}`}
          style={{ width: `${value * 10}%` }}
        />
        {/* Main bar */}
        <div
          className={`relative h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.1)]`}
          style={{
            width: `${value * 10}%`,
            background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`
          }}
        />
      </div>
    </div>
  );
}

export default async function TareaDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const task = getTaskBySlug((await params).slug);
  if (!task) notFound();

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-slate-300">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3">
          <Link href="/tareas" className="text-sm text-slate-500 hover:text-white transition-colors">
            ← Volver a tareas
          </Link>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {(task.categories || []).map(cat => (
                <span key={cat} className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  {cat}
                </span>
              ))}
              <span className="text-slate-700 hidden sm:inline">|</span>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{task.status}</span>
              <span className="text-slate-700 hidden sm:inline">|</span>
              <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md text-slate-300 uppercase tracking-widest border border-white/10">
                prioridad {task.priority}
              </span>
            </div>
          </div>
        </header>

        {/* MÉTRICAS DE VIABILIDAD - NUEVA SECCIÓN */}
        <section className="grid gap-6 md:grid-cols-1">
          <div className="rounded-3xl border border-white/5 bg-secondary/30 p-8 shadow-2xl shadow-blue-500/5">
            <h2 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Métricas de Viabilidad
            </h2>
            <div className="grid gap-x-16 gap-y-8 md:grid-cols-2">
              <MetricBar
                label="Facilidad de Implementación"
                value={task.viability_metrics.implementation_ease}
                colorClass="bg-blue-500"
                gradientFrom="#3b82f6"
                gradientTo="#60a5fa"
              />
              <MetricBar
                label="Probabilidad de Éxito"
                value={task.viability_metrics.success_probability}
                colorClass="bg-emerald-500"
                gradientFrom="#10b981"
                gradientTo="#34d399"
              />
              <MetricBar
                label="Intensidad de Recursos"
                value={task.viability_metrics.resource_intensity}
                colorClass="bg-amber-500"
                gradientFrom="#f59e0b"
                gradientTo="#fbbf24"
              />
              <MetricBar
                label="Tiempo para MVP"
                value={task.viability_metrics.time_to_mvp}
                colorClass="bg-purple-500"
                gradientFrom="#8b5cf6"
                gradientTo="#a78bfa"
              />
              <MetricBar
                label="Potencial de ROI"
                value={task.viability_metrics.roi_potential}
                colorClass="bg-cyan-500"
                gradientFrom="#06b6d4"
                gradientTo="#22d3ee"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-secondary/50 p-6">
          <h2 className="text-sm font-semibold text-white">Descripción</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">{task.description}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-secondary/50 p-6">
            <h2 className="text-sm font-semibold text-white">Stack Técnico</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-2">
                <dt className="text-slate-400">Framework</dt>
                <dd className="text-blue-400 font-medium">{task.technical_stack.framework}</dd>
              </div>
              <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-2">
                <dt className="text-slate-400">Database</dt>
                <dd className="text-slate-200">{task.technical_stack.database}</dd>
              </div>

              {/* MEJORA: Añadir Visualization si existe */}
              {"visualization" in task.technical_stack && (
                <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-2">
                  <dt className="text-slate-400">Visualización</dt>
                  <dd className="text-slate-200">{(task.technical_stack as any).visualization}</dd>
                </div>
              )}

              {"nlp_engine" in task.technical_stack ? (
                <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-2">
                  <dt className="text-slate-400">NLP Engine</dt>
                  <dd className="text-slate-200">
                    {(task.technical_stack as { nlp_engine?: string }).nlp_engine ?? "-"}
                  </dd>
                </div>
              ) : null}
            </dl>

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Data Sourcing (APIs)
            </h3>
            <ul className="mt-3 grid gap-2 text-sm">
              {task.technical_stack.apis_required.map((api) => (
                <li key={api} className="rounded-xl bg-white/5 px-4 py-2 text-slate-300 border border-white/5">
                  {api}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/5 bg-secondary/50 p-6">
            <h2 className="text-sm font-semibold text-white">Estrategia de Negocio</h2>

            <h3 className="mt-5 text-[10px] font-bold uppercase tracking-widest text-blue-500">
              El Problema
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400 italic">
              "{task.business_logic.problem}"
            </p>

            <h3 className="mt-6 text-[10px] font-bold uppercase tracking-widest text-green-500">
              La Solución
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {task.business_logic.solution}
            </p>

            <h3 className="mt-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Modelos de Monetización
            </h3>
            <ul className="mt-3 grid gap-2 text-sm text-slate-300">
              {task.business_logic.monetization.map((m) => (
                <li key={m} className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2">
                  <span className="h-1 w-1 rounded-full bg-slate-500" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-secondary/50 p-8">
          <h2 className="text-sm font-semibold text-white mb-6">Workflow de Implementación</h2>
          <ol className="relative border-l border-white/10 ml-3 grid gap-8">
            {task.execution_pipeline
              .slice()
              .sort((a, b) => a.step - b.step)
              .map((s) => (
                <li key={s.step} className="pl-6 relative">
                  <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-[#0a0a0a] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Paso {s.step}</span>
                    <h4 className="text-base font-semibold text-white">{s.task}</h4>
                    <p className="text-sm leading-6 text-slate-400 mt-1">
                      {s.details}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-secondary/50 p-6">
            <h2 className="text-sm font-semibold text-white">Data Architecture (JSON Preview)</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner">
              <pre className="overflow-auto p-5 text-[11px] font-mono text-blue-300/80 leading-relaxed">
                {JSON.stringify(task.data_schema_preview, null, 2)}
              </pre>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-secondary/50 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Configuración de Engine</h2>
              <dl className="mt-6 grid gap-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <dt className="text-slate-500 italic">Planificador (Cron)</dt>
                  <dd className="font-mono text-blue-400 bg-blue-500/5 px-2 py-1 rounded">
                    {task.automation_config.cron_schedule}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <dt className="text-slate-500 italic">Alertas Telegram</dt>
                  <dd className="text-slate-200">
                    {task.automation_config.auto_notify_telegram ? "ENABLED" : "DISABLED"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 italic">Auto-Marketplace</dt>
                  <dd className="text-slate-200">
                    {task.automation_config.auto_publish_to_marketplace ? "YES" : "NO"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-8 p-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] text-slate-500 uppercase tracking-widest text-center font-bold">
              ID: {task.id}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}