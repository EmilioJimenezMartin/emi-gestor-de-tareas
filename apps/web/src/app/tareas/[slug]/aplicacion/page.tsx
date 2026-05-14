import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskBySlug } from "@/lib/tasks";
import { getTaskAppConfig } from "@/config/task-apps-config";
import {
    ArrowLeft,
    Cpu,
    Wand2,
    Settings
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function TaskApplicationPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const task = await getTaskBySlug(slug);

    if (!task) notFound();

    // Get specialized config for this task
    const appConfig = getTaskAppConfig(slug);

    return (
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
            {/* 
          Common Header Logic 
          This remains consistent across all task-specific apps
      */}
            <header className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Link href={`/tareas/${slug}`} className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors w-fit">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Volver al Detalle
                    </Link>
                    <div className="h-4 w-px bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">Módulo de Aplicación</span>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative">
                    <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />

                    <div className="relative space-y-4 max-w-3xl">
                        <div className="flex items-center gap-3">
                            <Badge variant={appConfig ? "success" : "neutral"} className={`${appConfig ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-neutral-500"} text-[8px] font-black uppercase tracking-widest px-3`}>
                                {appConfig ? "Sistema Activo" : "Próximamente"}
                            </Badge>
                            <div className={`h-1 w-8 bg-gradient-to-r ${appConfig ? "from-emerald-500" : "from-white/10"} to-transparent rounded-full`} />
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter italic flex items-center gap-4">
                            <span className="bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent underline decoration-primary/20">
                                {appConfig?.title || task.title}
                            </span>
                            <span className="text-neutral-700 font-thin not-italic">|</span>
                            <span className="text-2xl sm:text-3xl text-neutral-400 font-bold tracking-normal opacity-80">
                                {appConfig ? "Automation Console" : "App Module"}
                            </span>
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium max-w-2xl leading-relaxed">
                            {appConfig?.description || task.description || "Este módulo de aplicación está siendo desarrollado específicamente para este motor estratégico."}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-3xl backdrop-blur-xl">
                        <div className="text-right">
                            <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Engine Status</p>
                            <p className={`text-xs font-mono font-bold tracking-tighter ${appConfig ? "text-emerald-400" : "text-neutral-500"}`}>
                                {appConfig?.engineStatus || "OFFLINE_PENDING"}
                            </p>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${appConfig ? "from-indigo-600 via-blue-600 to-cyan-500" : "from-neutral-800 to-neutral-900"} flex items-center justify-center text-white shadow-lg shadow-blue-500/20 relative group overflow-hidden`}>
                            <div className="absolute inset-0 bg-white/20 translate-y-12 group-hover:translate-y-0 transition-transform duration-500" />
                            <Cpu size={24} className="relative z-10" />
                        </div>
                    </div>
                </div>
            </header>

            {/* 
          Dynamic Content Area 
          Renders the specialized app if it exists, or a fallback UI
      */}
            {appConfig ? (
                appConfig.component
            ) : (
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8">
                        <Card variant="outline" className="min-h-[400px] border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center p-12 space-y-8 group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-[60px]" />
                                <div className="relative w-24 h-24 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center text-neutral-500">
                                    <Settings size={40} className="animate-spin-slow" />
                                </div>
                            </div>
                            <div className="space-y-3 relative">
                                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Módulo en Desarrollo</h3>
                                <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed font-medium">
                                    La aplicación personalizada para <strong>{task.title}</strong> está siendo configurada. Vuelve pronto para ver las herramientas específicas.
                                </p>
                            </div>
                            <div className="flex items-center gap-4 relative">
                                <Button variant="outline" className="h-12 px-10 rounded-2xl border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
                                    Solicitar Acceso Early Alpha
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <Card variant="glass" className="p-6 border-white/5 bg-white/[0.02] space-y-8 relative overflow-hidden group">
                            <p className="text-[11px] text-neutral-500 leading-relaxed italic text-center">
                                Este motor requiere una lógica personalizada que todavía no ha sido desplegada en el entorno de producción.
                            </p>
                        </Card>
                    </div>
                </section>
            )}
        </div>
    );
}
