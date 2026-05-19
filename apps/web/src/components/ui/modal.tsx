"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    showClose?: boolean;
    zIndex?: number;
}

export function Modal({ open, onClose, children, maxWidth = "max-w-sm", showClose = false, zIndex = 150 }: ModalProps) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
            style={{ zIndex }}
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className={`relative w-full ${maxWidth} rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/60 animate-in zoom-in-95 fade-in duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {showClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-xl text-neutral-600 hover:text-white hover:bg-white/8 transition-all"
                    >
                        <X size={14} />
                    </button>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
