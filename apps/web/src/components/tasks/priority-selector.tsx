"use client";

import { useState, useTransition } from "react";
import { updateTaskProperty } from "@/app/actions/tasks";
import { toast } from "sonner";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    CircleDashed,
    Flame
} from "lucide-react";

export type Priority = 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_CONFIG = {
    "critical": { label: "CRITICAL", icon: <Flame size={14} />, color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
    "high": { label: "HIGH", icon: <AlertTriangle size={14} />, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    "medium": { label: "MEDIUM", icon: <Activity size={14} />, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    "low": { label: "LOW", icon: <CheckCircle2 size={14} />, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
};

export function PrioritySelector({ taskId, currentPriority }: { taskId: string, currentPriority: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const prioKey = (currentPriority?.toLowerCase() || "medium") as keyof typeof PRIORITY_CONFIG;
    const config = PRIORITY_CONFIG[prioKey] || PRIORITY_CONFIG["medium"];

    const handlePriorityChange = (newPriority: string) => {
        if (newPriority === currentPriority) return;

        startTransition(async () => {
            const result = await updateTaskProperty(taskId, { priority: newPriority });
            if (result.success) {
                setIsOpen(false);
                toast.success(`Prioridad actualizada: ${newPriority}`);
            } else {
                toast.error("Error al actualizar la prioridad");
            }
        });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isPending}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95 ${config.color} ${isPending ? 'opacity-50 grayscale' : 'shadow-lg shadow-black/20'}`}
            >
                {isPending ? <CircleDashed size={14} className="animate-spin" /> : config.icon}
                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">{config.label}</span>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-2 left-0 z-50 min-w-[140px] bg-[#0c0c0c] border border-white/10 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                        {Object.keys(PRIORITY_CONFIG).map((prio) => {
                            const pCfg = PRIORITY_CONFIG[prio as keyof typeof PRIORITY_CONFIG];
                            return (
                                <button
                                    key={prio}
                                    onClick={() => handlePriorityChange(prio)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${prio === prioKey
                                        ? 'bg-primary/20 text-primary border border-primary/20'
                                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <span className={prio === prioKey ? 'text-primary' : 'text-neutral-500'}>
                                        {pCfg.icon}
                                    </span>
                                    {pCfg.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
