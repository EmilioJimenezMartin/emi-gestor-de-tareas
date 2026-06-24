"use client";

import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";

export interface ConsoleEntry {
    id: string;
    level: "info" | "success" | "error" | "warning" | "warn";
    message?: string;
    msg?: string;
    timestamp?: string;
    ts?: string;
    src?: string;
}

interface ActivityConsoleProps {
    logs: ConsoleEntry[];
    isRunning?: boolean;
    title?: string;
    height?: string;
    className?: string;
    autoScroll?: boolean;
}

const levelColor = (l: string) =>
    l === "success" ? "text-emerald-400"
    : l === "error" ? "text-rose-400"
    : l === "warning" || l === "warn" ? "text-amber-400"
    : "text-neutral-500";

const levelPrefix = (l: string) =>
    l === "success" ? "▶" : l === "error" ? "✕" : l === "warning" || l === "warn" ? "▲" : "›";

const srcColor = (s?: string) =>
    s === "clone" ? "text-rose-500/60"
    : s === "autoclone" ? "text-sky-500/60"
    : s === "viral" ? "text-emerald-500/60"
    : s === "radar" ? "text-amber-500/60"
    : s === "system" ? "text-violet-500/60"
    : "text-neutral-700";

export function ActivityConsole({
    logs,
    isRunning = false,
    title = "activity.log",
    height = "h-[300px]",
    className = "",
    autoScroll = true,
}: ActivityConsoleProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll && endRef.current) {
            const container = endRef.current.parentElement;
            if (container) container.scrollTop = container.scrollHeight;
        }
    }, [logs, autoScroll]);

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/8 flex items-center justify-center">
                        <Activity size={12} className="text-neutral-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono">Log</span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isRunning ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : logs.length > 0 ? "bg-white/5 text-neutral-600 border border-white/8" : "bg-white/5 text-neutral-700 border border-white/8"}`}>
                        {isRunning ? "RUNNING" : logs.length > 0 ? `${logs.length} líneas` : "IDLE"}
                    </span>
                </div>
            </div>

            {/* Terminal window */}
            <div className={`rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col ${height}`}>
                {/* Traffic lights bar */}
                <div className="h-8 bg-white/[0.015] border-b border-white/5 flex items-center px-3 gap-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                    <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                    <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-500/60 animate-pulse" : "bg-emerald-500/20"}`} />
                    <span className="text-[8px] font-mono text-neutral-800 ml-1">{title}</span>
                </div>

                {/* Log lines */}
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-0.5">
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-neutral-800 italic text-[9px]">Esperando actividad…</div>
                    ) : (
                        <>
                            {logs.map(entry => {
                                const text = entry.msg ?? entry.message ?? "";
                                const time = entry.ts
                                    ? new Date(entry.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                                    : entry.timestamp ?? "";
                                return (
                                    <div key={entry.id} className="flex gap-2 leading-relaxed animate-in fade-in duration-150">
                                        <span className="text-neutral-800 shrink-0 opacity-50">{time}</span>
                                        {entry.src && (
                                            <span className={`shrink-0 font-black uppercase text-[8px] ${srcColor(entry.src)}`}>{entry.src}</span>
                                        )}
                                        <span className={`shrink-0 ${levelColor(entry.level)}`}>{levelPrefix(entry.level)}</span>
                                        <span className={levelColor(entry.level)}>{text}</span>
                                    </div>
                                );
                            })}
                            {isRunning && <div className="animate-pulse pl-8 text-sky-400/40 text-lg">_</div>}
                        </>
                    )}
                    <div ref={endRef} />
                </div>
            </div>
        </div>
    );
}
