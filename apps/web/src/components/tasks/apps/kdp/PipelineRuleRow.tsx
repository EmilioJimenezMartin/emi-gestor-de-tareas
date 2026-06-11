// Fila plegable de regla del pipeline (alertas del autopilot).
// Extraído de kdp-factory-app.tsx sin cambios de lógica.
"use client";
import React from "react";
import { ChevronDown } from "lucide-react";

export function PipelineRuleRow({ rule, levelStyle }: {
    rule: { key: string; level: string; icon: string; label: string; items: string[]; count: number };
    levelStyle: Record<string, string>;
}) {
    const [open, setOpen] = React.useState(false);
    return (
        <div className={`rounded-xl border px-3 py-2 ${levelStyle[rule.level] ?? levelStyle.warn}`}>
            <button
                className="w-full flex items-center gap-2 text-left"
                onClick={() => rule.items.length > 0 && setOpen(o => !o)}
            >
                <span className="text-sm shrink-0">{rule.icon}</span>
                <span className="text-[12px] font-bold flex-1 leading-tight">{rule.label}</span>
                {rule.items.length > 0 && (
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                )}
            </button>
            {open && rule.items.length > 0 && (
                <div className="mt-1.5 ml-5 space-y-0.5">
                    {rule.items.map((item, i) => (
                        <p key={i} className="text-[11px] opacity-70 truncate">· {item}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
