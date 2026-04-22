import Link from "next/link";
import { getTasks } from "@/lib/tasks";

function badgeVariantForPriority(priority?: string) {
  switch (priority?.toLowerCase()) {
    case "critical":
      return "bg-red-500/10 text-red-400 border border-red-500/20";
    case "high":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
  }
}

export default function TareasPage() {
  const tasks = getTasks();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Gestor de Tareas <span className="text-blue-500">.</span>
          </h1>
          <p className="text-slate-400 max-w-2xl">
            Motores de arbitraje activos. Pipeline de ejecución cargado desde el núcleo de datos.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/tareas/${t.slug}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-blue-500/30 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-blue-500/5"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {t.title}
                    </h2>
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mt-1">
                      {t.category}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-tighter ${badgeVariantForPriority(
                      t.priority
                    )}`}
                  >
                    {t.priority || "Normal"}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-400 line-clamp-2">
                  {t.description}
                </p>

                {/* NUEVO: Mini métricas de viabilidad */}
                <div className="mt-5 flex gap-4 border-t border-white/5 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">ROI</span>
                    <span className="text-sm font-semibold text-green-400">{t.viability_metrics?.roi_potential}/10</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Éxito</span>
                    <span className="text-sm font-semibold text-blue-400">{t.viability_metrics?.success_probability}/10</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Dificultad</span>
                    <span className="text-sm font-semibold text-slate-300">{10 - (t.viability_metrics?.implementation_ease || 0)}/10</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 border border-white/5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-slate-400">STATUS:</span>
                    <span className="text-slate-200">{t.status?.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 border border-white/5">
                    <span className="text-slate-400">STACK:</span>
                    <span className="text-blue-400">
                      {t.technical_stack?.framework || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}