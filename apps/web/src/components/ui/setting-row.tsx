"use client";

import { Toggle, type ToggleColor } from "./toggle";

// ── SettingRow — label + description + any control ────────────────────────────

interface SettingRowProps {
    label: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}

export function SettingRow({ label, description, children, className }: SettingRowProps) {
    return (
        <div className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.02] ${className ?? ""}`}>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white leading-tight">{label}</p>
                {description && (
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">{description}</p>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

// ── ToggleRow — convenience wrapper for toggle settings ───────────────────────

interface ToggleRowProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    color?: ToggleColor;
    disabled?: boolean;
    className?: string;
}

export function ToggleRow({ label, description, checked, onChange, color, disabled, className }: ToggleRowProps) {
    return (
        <SettingRow label={label} description={description} className={className}>
            <Toggle checked={checked} onChange={onChange} color={color} disabled={disabled} />
        </SettingRow>
    );
}
