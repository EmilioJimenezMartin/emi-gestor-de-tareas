import {
    Cpu,
    Sparkles,
    Wand2,
    Zap,
    TrendingUp,
    Layers,
    Target,
    Globe,
    Search,
    BookOpen,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    Settings,
    Rocket
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function KdpFactoryApp() {
    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Hero Stats */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Assets Generados", value: "1,284", icon: <Layers size={14} />, color: "text-blue-400" },
                    { label: "Uptime Mensual", value: "99.9%", icon: <Zap size={14} />, color: "text-emerald-400" },
                    { label: "Nichos Activos", value: "42", icon: <Target size={14} />, color: "text-purple-400" },
                    { label: "Coste por Asset", value: "0.02€", icon: <TrendingUp size={14} />, color: "text-amber-400" },
                ].map((stat) => (
                    <Card key={stat.label} variant="outline" className="p-4 bg-white/[0.02] border-white/5 flex flex-col gap-2 hover:border-white/10 transition-all group">
                        <div className="flex items-center justify-between text-neutral-500">
                            <span className="text-[8px] font-black uppercase tracking-widest">{stat.label}</span>
                            <div className="group-hover:text-white transition-colors">{stat.icon}</div>
                        </div>
                        <p className={`text-xl font-black italic tracking-tighter ${stat.color}`}>{stat.value}</p>
                    </Card>
                ))}
            </section>

            {/* App Main Area */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    <Card variant="outline" className="min-h-[400px] border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center p-12 space-y-8 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-[60px] animate-pulse" />
                            <div className="relative w-24 h-24 rounded-[32px] bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-2xl">
                                <Wand2 size={40} className="group-hover:scale-110 transition-transform duration-500" />
                            </div>
                        </div>
                        <div className="space-y-3 relative">
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Configurando Consola Maestro</h3>
                            <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed font-medium">
                                El sistema está sincronizando con el extractor de Amazon. Selecciona un módulo para comenzar la generación.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 relative">
                            <Button className="h-12 px-10 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/5">
                                Inicializar Motor
                            </Button>
                            <Button variant="outline" className="h-12 px-10 rounded-2xl border-white/10 text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
                                Documentación
                            </Button>
                        </div>
                    </Card>

                    {/* Module Selection Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { title: "Niche Brainstorming", desc: "IA-driven search for high demand low competition niches.", icon: <Search className="text-blue-400" />, status: "ONLINE" },
                            { title: "Asset Generator", desc: "Generación masiva de interiores y portadas vectoriales.", icon: <Sparkles className="text-emerald-400" />, status: "READY" },
                            { title: "Metadata Optimizer", desc: "SEO-focused titles, subtitles and descriptions.", icon: <BookOpen className="text-purple-400" />, status: "BETA" },
                            { title: "Royalty Forecast", desc: "Predicción de ingresos basada en rankings históricos.", icon: <BarChart3 className="text-amber-400" />, status: "STABLE" }
                        ].map((module) => (
                            <Card key={module.title} variant="glass" className="p-6 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 rounded-2xl bg-white/5 group-hover:bg-primary/10 transition-colors">
                                        {module.icon}
                                    </div>
                                    <Badge variant="neutral" className="text-[7px] font-black tracking-widest py-0.5 bg-white/5 border-white/5">{module.status}</Badge>
                                </div>
                                <h4 className="text-sm font-black text-white italic tracking-tight mb-1">{module.title}</h4>
                                <p className="text-xs text-neutral-500 leading-relaxed font-medium">{module.desc}</p>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    <Card variant="glass" className="p-6 border-white/5 bg-white/[0.02] space-y-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Settings size={80} />
                        </div>

                        <div className="flex items-center gap-2 relative">
                            <Settings size={16} className="text-neutral-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Settings de Sistema</h4>
                        </div>

                        <div className="space-y-4 relative">
                            {[
                                { label: "Modo de Generación", value: "Industrial (High Vol)", icon: <Rocket size={12} /> },
                                { label: "Región Amazon", value: "US / DE / ES / UK", icon: <Globe size={12} /> },
                                { label: "Calidad de Salida", value: "Ultra High Def (Vector)", icon: <Zap size={12} /> }
                            ].map((item) => (
                                <div key={item.label} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1 hover:bg-white/10 transition-colors">
                                    <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest flex items-center gap-1">
                                        {item.icon} {item.label}
                                    </span>
                                    <span className="text-xs font-bold text-white italic tracking-tight">{item.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="space-y-4 relative">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Checklist de Preparación</h4>
                            <div className="space-y-3">
                                {[
                                    "API de Amazon Conectada",
                                    "Modelos de IA Cargados",
                                    "Bucket S3 Ready",
                                    "Queue de Tareas Limpia"
                                ].map((check) => (
                                    <div key={check} className="flex items-center gap-3 text-neutral-500">
                                        <CheckCircle2 size={14} className="text-emerald-500/50" />
                                        <span className="text-[11px] font-medium">{check}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-3 relative group/alert">
                            <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover/alert:opacity-100 transition-opacity" />
                            <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={10} /> Aviso de Sistema
                            </p>
                            <p className="text-[11px] text-neutral-400 leading-relaxed italic relative">
                                "El motor KDP Factory requiere una API Key configurada para el extractor de rankings para funcionar a pleno rendimiento."
                            </p>
                        </div>
                    </Card>
                </div>
            </section>
        </div>
    );
}
