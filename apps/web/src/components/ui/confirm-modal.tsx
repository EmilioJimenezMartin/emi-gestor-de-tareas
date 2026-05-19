"use client";

import { Loader2 } from "lucide-react";
import { Modal } from "./modal";

type Variant = "danger" | "warning" | "stop" | "info";

interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: Variant;
    icon?: React.ReactNode;
    isLoading?: boolean;
}

const VARIANT_STYLES: Record<Variant, { icon: string; confirm: string; confirmHover: string }> = {
    danger: {
        icon: "bg-red-500/10 border border-red-500/20",
        confirm: "bg-red-500 text-white",
        confirmHover: "hover:bg-red-400",
    },
    warning: {
        icon: "bg-amber-500/10 border border-amber-500/20",
        confirm: "bg-amber-500 text-black",
        confirmHover: "hover:bg-amber-400",
    },
    stop: {
        icon: "bg-orange-500/10 border border-orange-500/20",
        confirm: "bg-orange-500 text-white",
        confirmHover: "hover:bg-orange-400",
    },
    info: {
        icon: "bg-sky-500/10 border border-sky-500/20",
        confirm: "bg-sky-500 text-white",
        confirmHover: "hover:bg-sky-400",
    },
};

export function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger",
    icon,
    isLoading = false,
}: ConfirmModalProps) {
    const styles = VARIANT_STYLES[variant];

    return (
        <Modal open={open} onClose={onClose} zIndex={200}>
            <div className="p-8 space-y-6">
                <div className="space-y-3 text-center">
                    {icon && (
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${styles.icon}`}>
                            {icon}
                        </div>
                    )}
                    <p className="text-base font-black text-white">{title}</p>
                    {description && (
                        <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-black text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 h-11 rounded-2xl text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${styles.confirm} ${styles.confirmHover}`}
                    >
                        {isLoading && <Loader2 size={14} className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
