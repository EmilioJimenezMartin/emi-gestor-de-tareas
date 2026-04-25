"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BrainCircuit,
    Settings,
    Shield,
    Bell,
    Database,
    Sparkles,
    Zap,
    Cpu,
    Lock,
    Globe,
    BellRing,
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createApiSocket } from "@/lib/socket";

export default function AjustesPage() {
    const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "disconnected" | "connecting" | "disconnecting">("connecting");
    const apiUrl = useMemo(
        () =>
            (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
                /\/$/,
                ""
            ),
        []
    );

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("db:status", (data) => {
            const status = data.status;
            if (
                status === "unknown" ||
                status === "connected" ||
                status === "disconnected" ||
                status === "connecting" ||
                status === "disconnecting"
            ) {
                setDbStatus(status);
            } else {
                setDbStatus("unknown");
            }
        });
        socket.on("disconnect", () => {
            setDbStatus("unknown");
        });
        socket.on("connect_error", () => {
            setDbStatus("unknown");
        });

        return () => {
            socket.disconnect();
        };
    }, [apiUrl]);

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
        {/* Header */}
        <header className="flex flex-col gap-6 relative">
            <div className="absolute -left-10 -top-10 w-48 h-48 bg-primary/10 blur-[80px] pointer-events-none" />
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                    <Settings size={18} className="sm:size-5" />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Configuración de Sistema</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white italic">
                    Ajustes de <span className="text-primary italic">Control</span>
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 max-w-2xl font-medium">
                    Optimiza tus motores de IA, gestiona integraciones de datos y configura protocolos de seguridad avanzada.
                </p>
            </div>
        </header>

        <div className="space-y-12">
            {/* IA Configuration Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Núcleo de Inteligencia</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20">ALPHA-v2</Badge>
                    </div>
                </div>

                <Card variant="outline" className="relative overflow-hidden p-1 sm:p-1 border-white/5 bg-white/[0.01]">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        {/* Gemini Provider */}
                        <div className="p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-white/5 space-y-8 group relative transition-all duration-500 hover:bg-white/[0.01]">
                            <div className="absolute -left-10 -top-10 w-32 h-32 bg-blue-600/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                        <span className="font-black text-xl italic">G</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-white">Google Gemini</h3>
                                        <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Motor Primario</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm text-neutral-400 leading-relaxed font-medium">Motor de razonamiento avanzado para análisis de mercado y procesamiento de grandes volúmenes de datos comerciales.</p>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest ml-1">Modelo Seleccionado</label>
                                    <select className="w-full h-12 bg-black/40 border border-white/5 rounded-2xl px-4 text-sm font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer hover:border-white/10">
                                        <option>Gemini 1.5 Pro (Ultra context)</option>
                                        <option>Gemini 1.5 Flash (Speed optimized)</option>
                                        <option>Gemini 1.0 Ultra (Legacy stable)</option>
                                    </select>
                                </div>
                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-tighter">Latencia Media: <span className="text-primary italic">140ms</span></span>
                                    <Badge variant="neutral" className="text-[7px] font-black uppercase">v1.5_STABLE</Badge>
                                </div>
                            </div>
                        </div>

                        {/* Hugging Face Provider */}
                        <div className="p-8 sm:p-10 space-y-8 group relative transition-all duration-500 hover:bg-white/[0.01]">
                            <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-600/5 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                        <span className="font-black text-xl italic">H</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-white">Hugging Face</h3>
                                        <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Open Source Core</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase">CONNECTED</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm text-neutral-400 leading-relaxed font-medium">Modelos especializados de código abierto para tareas de NLP específicas y mayor soberanía de datos en local.</p>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-neutral-600 uppercase tracking-widest ml-1">Modelo de Inferencia</label>
                                    <select className="w-full h-12 bg-black/40 border border-white/5 rounded-2xl px-4 text-sm font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer hover:border-white/10">
                                        <option>Llama 3.1 (70B Instruct)</option>
                                        <option>Mistral NeMo (12B)</option>
                                        <option>Phi-3.5 Mini (3.8B)</option>
                                        <option>Gemma 2 (27B)</option>
                                    </select>
                                </div>
                                <div className="pt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-tighter">Inferencia: <span className="text-amber-500 italic text-xs uppercase">API Hub</span></span>
                                    <Badge variant="neutral" className="text-[7px] font-black uppercase">v3.1_LATEST</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border-t border-white/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Zap size={14} className="text-amber-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Auto-escalado dinámico activado según demanda de GPU</p>
                        </div>
                        <Button variant="primary" className="w-full sm:w-fit font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                            Guardar Configuración
                        </Button>
                    </div>
                </Card>
            </section>

            {/* System Infrastructure Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-primary/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                <Lock size={20} />
                            </div>
                            <Badge variant="neutral" className="text-[7px] font-black uppercase">SEG-v4</Badge>
                        </div>
                        <div>
                            <h3 className="font-black text-white italic">Protocolos de Seguridad</h3>
                            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Administra tus API Keys, tokens de acceso y esquemas de cifrado de extremo a extremo.</p>
                        </div>
                        <Button variant="secondary" className="w-full text-[10px] font-black uppercase tracking-widest h-10 bg-white/5 border-white/5 hover:bg-white/10 transition-colors">
                            Administrar Keys
                        </Button>
                    </div>
                </Card>

                <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <BellRing size={20} />
                            </div>
                            <Badge variant="neutral" className="text-[7px] font-black uppercase">RT-v2</Badge>
                        </div>
                        <div>
                            <h3 className="font-black text-white italic">Motor de Notificaciones</h3>
                            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Configura alertas de Telegram y webhooks de sistema para eventos críticos de tus motores.</p>
                        </div>
                        <Button variant="secondary" className="w-full text-[10px] font-black uppercase tracking-widest h-10 bg-white/5 border-white/5 hover:bg-white/10 transition-colors">
                            Configurar Alertas
                        </Button>
                    </div>
                </Card>

                <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                    <div className="absolute -right-6 -top-6 w-20 h-20 bg-amber-500/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <Database size={20} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                {dbStatus === "connected" ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[8px] font-black text-emerald-500 uppercase">ONLINE</span>
                                    </>
                                ) : dbStatus === "connecting" ? (
                                    <>
                                        <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                        <span className="text-[8px] font-black text-amber-500 uppercase">CONNECTING</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                        <span className="text-[8px] font-black text-red-500 uppercase">OFFLINE</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-black text-white italic">Persistencia de Datos</h3>
                            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Estado de conexión con el núcleo de MongoDB y gestión de copias de seguridad automáticas.</p>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-tighter italic">MongoDB Cluster v6.0</span>
                            <Badge variant="neutral" className="text-[7px] font-black uppercase tracking-widest">Uptime 99.9%</Badge>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Footer Status Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-10 gap-4 border-t border-white/5 overflow-hidden">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Version del Sistema</span>
                        <span className="text-[10px] font-mono text-neutral-400 font-bold tracking-widest">v2.4.0-STABLE</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Entorno</span>
                        <Badge variant="neutral" className="text-[8px] font-black px-2 py-0">PRODUCCIÓN</Badge>
                    </div>
                </div>
                <div className="text-[9px] font-black text-neutral-600 uppercase tracking-tighter italic">
                    Gestor de Tareas © 2026 • High Alpha Dashboard Experience
                </div>
            </div>
        </div>
    </div>
    );
}
