"use client";

import { X, Rocket, Target, Zap, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-xl bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                {/* Glow Effects */}
                <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none" />
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />

                <div className="relative p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight italic">Nuevo Motor</h2>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Configuración de inversión</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Título del Motor</label>
                            <Input
                                placeholder="Ej: BioTerra Arbitrage v2"
                                className="h-12 bg-white/[0.03] border-white/5 rounded-2xl focus:ring-primary/20 focus:border-primary/40 placeholder:text-neutral-700"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Prioridad</label>
                                <select className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none">
                                    <option>Normal</option>
                                    <option>Alta</option>
                                    <option>Crítica</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">ROI Objetivo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500">x</span>
                                    <Input
                                        type="number"
                                        placeholder="1.5"
                                        className="h-12 pl-8 bg-white/[0.03] border-white/5 rounded-2xl focus:ring-primary/20 focus:border-primary/40 placeholder:text-neutral-700"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Descripción Técnica</label>
                            <textarea
                                placeholder="Breve descripción de la lógica de negocio..."
                                className="w-full min-h-[100px] bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm font-semibold text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-neutral-700 resize-none"
                            />
                        </div>

                        <div className="pt-4 flex gap-4">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/5 hover:bg-white/5"
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                onClick={onClose}
                            >
                                Crear Motor
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
