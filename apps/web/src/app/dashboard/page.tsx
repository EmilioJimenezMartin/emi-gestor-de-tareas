"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Terminal, Database, Play, StopCircle, Search, FilterIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";

interface LogEntry {
    id: string;
    timestamp: string;
    level: "info" | "success" | "error" | "warning";
    message: string;
}

export default function ExtractorDashboard() {
    const [isExtracting, setIsExtracting] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [extractedData, setExtractedData] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const logsEndRef = useRef<HTMLDivElement>(null);

    const apiUrl = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""), []);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);

        socket.on("extractor:log", (data: any) => {
            setLogs((prev) => [...prev, {
                id: Math.random().toString(),
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                level: data.level || "info",
                message: data.message
            }]);
        });

        socket.on("extractor:done", () => {
            setIsExtracting(false);
            fetchExtractedData();
            toast.success("Extracción Finalizada");
        });

        return () => {
            socket.disconnect();
        };
    }, [apiUrl]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    useEffect(() => {
        fetchExtractedData();
    }, [apiUrl]);

    const fetchExtractedData = async () => {
        try {
            const res = await fetch(`${apiUrl}/extractor/data`);
            if (res.ok) {
                const json = await res.json();
                setExtractedData(json.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startExtraction = async () => {
        if (isExtracting) return;
        setLogs([]);
        setIsExtracting(true);

        try {
            const res = await fetch(`${apiUrl}/extractor/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: "All Public APIS", keyword: search })
            });
            if (!res.ok) throw new Error("Failed to start job");
        } catch (e) {
            toast.error("Error al arrancar el motor de extracción");
            setIsExtracting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                    <Database size={16} className="sm:size-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Inteligencia de Datos</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
                    Motor Extractor
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 max-w-2xl">
                    Centraliza la ingesta de información. Filtra, raspea y normaliza fuentes externas convirtiéndolas en JSON estandarizado persistido en MongoDB.
                </p>
            </header>

            {/* Main UI */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[calc(100vh-250px)] lg:min-h-[600px] mb-32 md:mb-0">
                {/* Left Col: Terminals & Controls */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-auto lg:h-full">
                    {/* Controls */}
                    <Card className="p-6 bg-black/40 border-white/5 backdrop-blur-xl shrink-0">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-white">
                            <FilterIcon size={16} className="text-primary" /> Filtros de Captura
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500 ml-1">Target Keywords</label>
                                <div className="relative mt-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={14} />
                                    <Input
                                        placeholder="Ej: Bounties, AI Models..."
                                        className="h-12 pl-10 bg-white/5 border-white/10 rounded-2xl"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500 ml-1">Data Source</label>
                                    <select className="w-full mt-1 h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-xs font-semibold focus:outline-none focus:border-primary/50 text-white appearance-none">
                                        <option>Múltiple Automatizado</option>
                                        <option>Open Data Portals</option>
                                        <option>Kaggle Datasets</option>
                                        <option>Gob.es Licitaciones</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500 ml-1">Profundidad</label>
                                    <select className="w-full mt-1 h-12 bg-white/5 border border-white/10 rounded-2xl px-4 text-xs font-semibold focus:outline-none focus:border-primary/50 text-white appearance-none">
                                        <option>Superficial (Rápida)</option>
                                        <option>Profunda (Lenta)</option>
                                    </select>
                                </div>
                            </div>
                            <Button
                                onClick={startExtraction}
                                disabled={isExtracting}
                                className={`w-full mt-4 h-14 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isExtracting ? 'bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(217,119,6,0.3)]' : 'bg-primary hover:bg-primary/90 text-black shadow-[0_0_20px_rgba(var(--primary),0.3)]'}`}
                            >
                                {isExtracting ? <><StopCircle size={16} className="mr-2 animate-pulse" /> Extrayendo...</> : <><Play size={16} className="mr-2" /> Iniciar Extractor</>}
                            </Button>
                        </div>
                    </Card>

                    {/* Terminal */}
                    <Card className="h-64 lg:h-auto lg:flex-1 bg-[#050505] border-white/5 overflow-hidden flex flex-col relative before:absolute before:inset-0 before:bg-gradient-to-t before:from-[#050505]/80 before:to-transparent before:pointer-events-none before:h-8 before:z-10 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
                        <div className="h-10 bg-white/[0.02] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-neutral-500" />
                                <span className="text-[10px] font-mono text-neutral-500">extractor_daemon_v1.sh</span>
                            </div>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/50" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                                <div className={`w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 ${isExtracting ? 'animate-pulse' : ''}`} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar font-mono text-[10px] sm:text-xs">
                            {logs.length === 0 && !isExtracting ? (
                                <p className="text-neutral-700 italic">Esperando señal de ignición...</p>
                            ) : (
                                <div className="space-y-1.5 pb-8">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex gap-3 leading-tight animate-in slide-in-from-bottom-1">
                                            <span className="text-neutral-600 shrink-0">[{log.timestamp}]</span>
                                            <span className={`${log.level === 'success' ? 'text-emerald-400 font-bold' : log.level === 'error' ? 'text-rose-400' : 'text-primary/80'}`}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Col: Data Grid */}
                <Card className="lg:col-span-8 min-h-[400px] lg:min-h-0 bg-black/40 border-white/5 backdrop-blur-xl flex flex-col overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 shrink-0">
                        <div>
                            <h3 className="font-bold text-sm text-white flex flex-wrap items-center gap-2">Base de Inteligencia <span className="bg-white/10 text-neutral-300 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest border border-white/10 mt-1 sm:mt-0">MongoDB</span></h3>
                            <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mt-1 sm:mt-1.5">IExtractedData Collections</p>
                        </div>
                        <div className="px-3 py-1 bg-primary/10 w-fit rounded-lg border border-primary/20 text-[10px] sm:text-xs font-black tracking-widest text-primary">
                            {extractedData.length} REGISTROS
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-white/[0.01]">
                        {extractedData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-4">
                                <Database size={48} className="text-white/5 stroke-1" />
                                <p className="text-xs font-semibold tracking-wide uppercase text-neutral-600">La bóveda de inteligencia está vacía</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {extractedData.map((data, i) => (
                                    <div key={data.id || i} className="group p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/5 hover:border-primary/30 transition-all cursor-pointer shadow-lg shadow-black/20 relative overflow-hidden flex flex-col">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-colors" />
                                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                                            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                                                {data.source?.source_type || 'SCRAPED'}
                                            </span>
                                            <span className="text-[8px] text-neutral-600 font-mono font-bold whitespace-nowrap ml-2">
                                                {data.temporal?.created_at ? new Date(data.temporal.created_at).toLocaleDateString() : 'Reciente'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-xs sm:text-sm text-white mb-2 sm:mb-3 line-clamp-2 leading-relaxed sm:leading-tight pr-2">{data.title}</h4>
                                        <p className="text-[10px] text-neutral-500 line-clamp-3 leading-relaxed mb-5 sm:mb-6 flex-1">
                                            {data.description || data.content?.raw?.substring(0, 100) || 'Data abstract...'}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-auto">
                                            {(data.metadata?.tags || []).slice(0, 4).map((t: string) => (
                                                <span key={t} className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-widest text-neutral-400 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
