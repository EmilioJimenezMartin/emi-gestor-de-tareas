import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskBySlug } from "@/lib/tasks";
import { getTaskAppMeta, TASK_APPS_REGISTRY } from "@/config/task-apps-config";
import { TaskAppRenderer } from "@/components/tasks/task-app-renderer";
import { ArrowLeft, Cpu, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TaskApplicationPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const task = await getTaskBySlug(slug);

    if (!task) notFound();

    const appConfig = getTaskAppMeta(slug);

    return (
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-in fade-in duration-700">

            <header className="flex flex-col gap-6">
                {/* Breadcrumb + app switcher */}
                <div className="flex items-center justify-between gap-4">
                    <Link href={`/tareas/${slug}`} className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                        Volver
                    </Link>

                    <div className="flex items-center gap-1">
                        {Object.entries(TASK_APPS_REGISTRY).map(([appSlug, meta]) => {
                            const isActive = appSlug === slug;
                            return (
                                <Link
                                    key={appSlug}
                                    href={`/tareas/${appSlug}/aplicacion`}
                                    className={`relative px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                        isActive
                                            ? "text-white"
                                            : "text-neutral-600 hover:text-neutral-400"
                                    }`}
                                >
                                    {meta.title}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Title row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative">
                    <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />

                    <h1 className="relative text-3xl sm:text-4xl font-black text-white tracking-tighter">
                        <span className="bg-gradient-to-br from-indigo-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            {appConfig?.title || task.title}
                        </span>
                    </h1>

                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-2xl">
                        <div className={`w-1.5 h-1.5 rounded-full ${appConfig ? "bg-emerald-400" : "bg-neutral-600"}`} />
                        <p className={`text-[10px] font-mono font-bold tracking-tight ${appConfig ? "text-emerald-400" : "text-neutral-500"}`}>
                            {appConfig?.engineStatus || "OFFLINE_PENDING"}
                        </p>
                        <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${appConfig ? "from-indigo-600 to-cyan-600" : "from-neutral-800 to-neutral-900"} flex items-center justify-center`}>
                            <Cpu size={14} className="text-white" />
                        </div>
                    </div>
                </div>
            </header>

            {appConfig ? (
                <TaskAppRenderer slug={slug} />
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
                                    La aplicación personalizada para <strong>{task.title}</strong> está siendo configurada.
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
                                Este motor requiere una lógica personalizada que todavía no ha sido desplegada.
                            </p>
                        </Card>
                    </div>
                </section>
            )}
        </div>
    );
}
