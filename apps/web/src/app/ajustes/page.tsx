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
import { toast } from "sonner";

export default function AjustesPage() {
    const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "disconnected" | "connecting" | "disconnecting">("connecting");
    const [isSaving, setIsSaving] = useState(false);

    const [defaultProvider, setDefaultProvider] = useState("google");
    const [defaultModel, setDefaultModel] = useState("gemini-2.5-flash");

    const apiUrl = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""), []);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch(`${apiUrl}/settings`);
                if (!res.ok) {
                    toast.error("No se pudo cargar la configuración (API/Mongo no disponible)");
                    return;
                }

                const json = await res.json();
                const map = new Map();
                json.settings?.forEach((s: any) => map.set(s.key, s.value));

                if (map.has("DEFAULT_LLM_PROVIDER")) setDefaultProvider(map.get("DEFAULT_LLM_PROVIDER"));
                if (map.has("DEFAULT_LLM_MODEL")) setDefaultModel(map.get("DEFAULT_LLM_MODEL"));
            } catch (err) {
                console.error(err);
                toast.error("Error de red conectando con la API");
            }
        }
        fetchSettings();
    }, [apiUrl]);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("db:status", (data) => {
            if (["unknown", "connected", "disconnected", "connecting", "disconnecting"].includes(data.status)) {
                setDbStatus(data.status);
            }
        });
        socket.on("disconnect", () => setDbStatus("unknown"));
        socket.on("connect_error", () => setDbStatus("unknown"));
        return () => { socket.disconnect() };
    }, [apiUrl]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = [
                { key: "DEFAULT_LLM_PROVIDER", value: defaultProvider },
                { key: "DEFAULT_LLM_MODEL", value: defaultModel }
            ];
            const res = await fetch(`${apiUrl}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                toast.success("Configuración guardada en MongoDB");
            } else {
                toast.error("Error al guardar la configuración");
            }
        } catch (e) {
            toast.error("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    };

    const handleProviderChange = (provider: string, model: string) => {
        setDefaultProvider(provider);
        setDefaultModel(model);
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
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
                        Optimiza tus motores de IA, gestiona integraciones de datos y configura protocolos.
                    </p>
                </div>
            </header>

            <div className="space-y-2">
                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight italic">Núcleo de Inteligencia</h2>
                            <Badge variant="neutral" className="text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20">ALPHA-v2</Badge>
                        </div>
                    </div>

                    <Card variant="outline" className="relative overflow-hidden p-1 sm:p-1 border-white/5 bg-white/[0.01]">
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            {/* Gemini Provider */}
                            <div className={`p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-white/5 space-y-8 relative transition-all duration-500 ${defaultProvider === 'google' ? 'bg-blue-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -left-10 -top-10 w-32 h-32 bg-blue-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'google' ? 'shadow-blue-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('google', 'gemini-1.5-pro')}
                                        >
                                            <span className="font-black text-xl italic">G</span>
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('google', 'gemini-1.5-pro')}>
                                            <h3 className="font-black text-lg text-white">Google Gemini</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Motor Oficial</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('google', 'gemini-1.5-pro')}>
                                        {defaultProvider === "google" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400">
                                                <Lock size={14} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                                    Credenciales (no editable)
                                                </span>
                                                <p className="text-xs text-neutral-400 leading-relaxed">
                                                    Los tokens/API keys no se gestionan desde la UI. Se configuran en el
                                                    servidor (por ejemplo vía <span className="font-mono">apps/api/.env</span>{" "}
                                                    o variables de entorno del despliegue).
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Google Target Model</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'google' ? defaultModel : 'gemini-2.5-flash'}
                                            onChange={(e) => { handleProviderChange('google', e.target.value) }}
                                        >
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        Nota: los modelos cloud suelen requerir credenciales y pueden tener cuotas (no
                                        es “ilimitado”).
                                    </p>
                                </div>
                            </div>

                            {/* Hugging Face Provider */}
                            <div className={`p-8 sm:p-10 space-y-8 relative transition-all duration-500 ${defaultProvider === 'huggingface' ? 'bg-amber-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'huggingface' ? 'shadow-amber-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('huggingface', 'meta-llama/Meta-Llama-3-70B')}
                                        >
                                            <span className="font-black text-xl italic">H</span>
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('huggingface', 'meta-llama/Meta-Llama-3-70B')}>
                                            <h3 className="font-black text-lg text-white">Hugging Face</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Open Source Core</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('huggingface', 'meta-llama/Meta-Llama-3-70B')}>
                                        {defaultProvider === "huggingface" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400">
                                                <Lock size={14} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                                    Token HF (no editable)
                                                </span>
                                                <p className="text-xs text-neutral-400 leading-relaxed">
                                                    Si en el futuro se usa un endpoint de Hugging Face, el token se
                                                    configurará en el backend. Aquí solo seleccionas proveedor y modelo.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">HF Target Model</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'huggingface' ? defaultModel : 'meta-llama/Meta-Llama-3-70B'}
                                            onChange={(e) => { handleProviderChange('huggingface', e.target.value) }}
                                        >
                                            <option value="deepseek-r1">DeepSeek (R1)</option>
                                            <option value="qwen-2.5-instruct">Qwen 2.5 (Instruct)</option>
                                            <option value="meta-llama/Meta-Llama-3-70B">Llama (70B Instruct)</option>
                                            <option value="mistralai/Mistral-Nemo-Instruct">Mistral NeMo (12B)</option>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        Estos nombres son “identificadores internos” de tu app (los mapearemos al
                                        proveedor real cuando implementemos la inferencia).
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border-t border-white/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-neutral-500 max-w-md">
                                <Zap size={16} className="text-primary shrink-0" />
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary/80 leading-relaxed">Se guarda el proveedor/modelo por defecto. Las credenciales se gestionan solo en backend.</p>
                            </div>
                            <Button onClick={handleSave} disabled={isSaving} variant="primary" className="w-full sm:w-fit font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar en MongoDB"}
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
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Administra redes de confidencialidad y esquemas Zero-Trust.</p>
                            </div>
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
                                <h3 className="font-black text-white italic">Notificaciones Activas</h3>
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Alertas del sistema, métricas caídas y reportes de rentabilidad.</p>
                            </div>
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
                                <h3 className="font-black text-white italic">MongoDB Core</h3>
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Conexión en streaming por WebSockets habilitada.</p>
                            </div>
                        </div>
                    </Card>
                </div>

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
