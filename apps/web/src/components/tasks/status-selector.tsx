"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    CircleDashed,
    Clock,
    Construction,
    FlaskConical,
    XOctagon,
    ChevronDown
} from "lucide-react";

const STATUS_CONFIG = {
    "Prototipo": { icon: <FlaskConical size={14} />, variant: "neutral" as const, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
    "En estudio": { icon: <Clock size={14} />, variant: "neutral" as const, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    "En desarrollo": { icon: <Construction size={14} />, variant: "warning" as const, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    "Activa": { icon: <CheckCircle2 size={14} />, variant: "success" as const, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    "Descartada": { icon: <XOctagon size={14} />, variant: "error" as const, color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
};

export function StatusSelector({ taskId, currentStatus }: { taskId: string, currentStatus: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const config = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG["Prototipo"];

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === currentStatus) return;

        startTransition(async () => {
            const result = await updateTaskStatus(taskId, newStatus);
            if (result.success) {
                setIsOpen(false);
            } else {
                alert("Error al actualizar el estado");
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
                <span className="text-[9px] font-black uppercase tracking-tight sm:tracking-widest whitespace-nowrap">{currentStatus}</span>
                <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-2 left-0 z-50 min-w-[160px] bg-[#0c0c0c] border border-white/10 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                        {Object.keys(STATUS_CONFIG).map((status) => {
                            const sCfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                            return (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${status === currentStatus
                                        ? 'bg-primary/20 text-primary border border-primary/20'
                                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <span className={status === currentStatus ? 'text-primary' : 'text-neutral-500'}>
                                        {sCfg.icon}
                                    </span>
                                    {status}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
