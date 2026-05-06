"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, FileJson, Layers, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTask, updateTask } from "@/app/actions/tasks";
import { toast } from "sonner";
import { Task } from "@/lib/tasks";

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Task | null;
}

type Mode = "select" | "json" | "form";

export function AddTaskModal({ isOpen, onClose, initialData }: AddTaskModalProps) {
    const isEdit = !!initialData;
    const [mode, setMode] = useState<Mode>("select");
    const [step, setStep] = useState(1);
    const [isPending, startTransition] = useTransition();
    const [jsonInput, setJsonInput] = useState("");
    const [mounted, setMounted] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Record<string, any>>({
        id: "",
        title: "",
        slug: "",
        status: "Prototipo",
        priority: "medium",
        description: "",
        viability_metrics: {
            implementation_ease: 5,
            success_probability: 5,
            resource_intensity: 5,
            time_to_mvp: 5,
            roi_potential: 5
        },
        technical_stack: { framework: "", database: "", apis_required: [] },
        business_logic: { problem: "", solution: "", monetization: [] },
        categories: [],
        automation_config: { cron_schedule: "", auto_notify_telegram: false, auto_publish_to_marketplace: false }
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData((prev) => ({
                ...prev,
                ...initialData,
                viability_metrics: { ...prev.viability_metrics, ...initialData.viability_metrics },
                technical_stack: { ...prev.technical_stack, ...initialData.technical_stack },
                business_logic: { ...prev.business_logic, ...initialData.business_logic },
                automation_config: { ...prev.automation_config, ...initialData.automation_config }
            }));
            setJsonInput(JSON.stringify(initialData, null, 2));
        } else {
            setFormData({
                id: "",
                title: "",
                slug: "",
                status: "Prototipo",
                priority: "medium",
                description: "",
                viability_metrics: {
                    implementation_ease: 5,
                    success_probability: 5,
                    resource_intensity: 5,
                    time_to_mvp: 5,
                    roi_potential: 5
                },
                technical_stack: { framework: "", database: "", apis_required: [] },
                business_logic: { problem: "", solution: "", monetization: [] },
                categories: [],
                automation_config: { cron_schedule: "", auto_notify_telegram: false, auto_publish_to_marketplace: false }
            });
            setMode("select");
            setStep(1);
        }
    }, [initialData, isOpen]);

    if (!isOpen || !mounted) return null;

    const handleReset = () => {
        if (!isEdit) {
            setMode("select");
            setStep(1);
            setJsonInput("");
        }
        onClose();
    };

    const submitTask = (data: any) => {
        startTransition(async () => {
            const result = isEdit
                ? await updateTask(data.id, data)
                : await createTask(data);

            if (result.success) {
                toast.success(isEdit ? "¡Motor actualizado con éxito!" : "¡Motor creado con éxito!");
                handleReset();
            } else {
                toast.error(isEdit ? "Error al actualizar el motor." : "Error al crear el motor.");
            }
        });
    };

    const handleJsonSubmit = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            submitTask(parsed);
        } catch (e) {
            toast.error("El JSON no es válido.");
        }
    };

    const handleFormSubmit = () => {
        const finalData = { ...formData };
        if (!finalData.id) {
            finalData.id = finalData.slug || finalData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        }
        if (!finalData.slug) finalData.slug = finalData.id;

        submitTask(finalData);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500" onClick={handleReset} />
            <div className="relative w-full max-w-xl bg-black border border-white/10 rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 fade-in duration-500 my-auto">
                <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none" />
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="relative p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                {isEdit ? <RotateCcw size={20} /> : <Sparkles size={20} />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight italic">{isEdit ? "Editar Motor" : "Nuevo Motor"}</h2>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                                    {isEdit ? `Actualizando ${initialData.id}` : "Creación de entidad"}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleReset} className="p-2 rounded-full hover:bg-white/5 text-neutral-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {mode === "select" && (
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setMode("form")} className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-primary/50 transition-all group">
                                <Layers size={40} className="text-neutral-400 group-hover:text-primary transition-colors" strokeWidth={1} />
                                <div className="text-center">
                                    <h3 className="font-bold text-sm text-neutral-200">Paso a Paso</h3>
                                    <p className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest">Asistente GUI</p>
                                </div>
                            </button>
                            <button onClick={() => setMode("json")} className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-blue-500/50 transition-all group">
                                <FileJson size={40} className="text-neutral-400 group-hover:text-blue-500 transition-colors" strokeWidth={1} />
                                <div className="text-center">
                                    <h3 className="font-bold text-sm text-neutral-200">Pegar JSON</h3>
                                    <p className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest">Modo Experto</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {mode === "json" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Payload JSON Raw</label>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{\n  "title": "BioTerra",\n  "status": "Prototipo"\n}'
                                    className="w-full h-64 bg-black/50 font-mono text-xs border border-white/10 rounded-2xl p-4 text-emerald-400 focus:outline-none focus:border-blue-500 resize-none shadow-inner"
                                />
                            </div>
                            <div className="pt-4 flex gap-4">
                                <Button variant="ghost" onClick={() => setMode("select")} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/5 text-neutral-400 hover:bg-white/5">
                                    Volver
                                </Button>
                                <Button disabled={isPending} onClick={handleJsonSubmit} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                                    {isEdit ? "Guardar Cambios" : "Ejecutar JSON"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === "form" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center gap-2 mb-6">
                                {[1, 2, 3].map((s) => (
                                    <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? "bg-primary" : "bg-white/10"}`} />
                                ))}
                            </div>

                            {step === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-left-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Nombre del Motor</label>
                                        <Input
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="Ej: Licitador Fantasma Automatizado"
                                            className="h-12 bg-white/[0.03] border-white/5 rounded-2xl"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">ID Único</label>
                                            <Input
                                                value={formData.id}
                                                disabled={isEdit}
                                                onChange={(e) => setFormData({ ...formData, id: e.target.value, slug: e.target.value })}
                                                placeholder="bot-001"
                                                className="h-12 bg-white/[0.03] border-white/5 rounded-2xl disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Prioridad</label>
                                            <select
                                                value={formData.priority}
                                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                                className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl px-4 text-sm font-semibold focus:outline-none appearance-none text-white cursor-pointer"
                                            >
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="critical">Critical</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Descripción General</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Descripción del proyecto..."
                                            className="w-full h-24 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">ROI Potencial (1-10)</label>
                                            <Input type="number" min={1} max={10} value={formData.viability_metrics.roi_potential} onChange={(e) => setFormData({ ...formData, viability_metrics: { ...formData.viability_metrics, roi_potential: Number(e.target.value) } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Prob. Éxito (1-10)</label>
                                            <Input type="number" min={1} max={10} value={formData.viability_metrics.success_probability} onChange={(e) => setFormData({ ...formData, viability_metrics: { ...formData.viability_metrics, success_probability: Number(e.target.value) } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Intensidad Ops (1-10)</label>
                                            <Input type="number" min={1} max={10} value={formData.viability_metrics.resource_intensity} onChange={(e) => setFormData({ ...formData, viability_metrics: { ...formData.viability_metrics, resource_intensity: Number(e.target.value) } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Facilidad de Código (1-10)</label>
                                            <Input type="number" min={1} max={10} value={formData.viability_metrics.implementation_ease} onChange={(e) => setFormData({ ...formData, viability_metrics: { ...formData.viability_metrics, implementation_ease: Number(e.target.value) } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Stack (Frameworks)</label>
                                            <Input placeholder="Ej: Next.js, Python" value={formData.technical_stack.framework} onChange={(e) => setFormData({ ...formData, technical_stack: { ...formData.technical_stack, framework: e.target.value } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Base de Datos</label>
                                            <Input placeholder="Ej: PostgreSQL" value={formData.technical_stack.database} onChange={(e) => setFormData({ ...formData, technical_stack: { ...formData.technical_stack, database: e.target.value } })} className="h-12 bg-white/[0.03] border-white/5 rounded-2xl" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Problema de Negocio</label>
                                        <textarea
                                            value={formData.business_logic.problem}
                                            onChange={(e) => setFormData({ ...formData, business_logic: { ...formData.business_logic, problem: e.target.value } })}
                                            placeholder="Problema que resuelve..."
                                            className="w-full h-20 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-sm focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex gap-4">
                                {step > 1 ? (
                                    <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/5 text-neutral-400 hover:bg-white/5">
                                        Atrás
                                    </Button>
                                ) : (
                                    <Button variant="ghost" onClick={() => setMode("select")} className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/5 text-neutral-400 hover:bg-white/5">
                                        Volver
                                    </Button>
                                )}

                                {step < 3 ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => setStep(step + 1)}
                                        className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(25,113,255,0.3)]"
                                    >
                                        Siguiente <ArrowRight size={14} className="ml-2" />
                                    </Button>
                                ) : (
                                    <Button
                                        disabled={isPending}
                                        onClick={handleFormSubmit}
                                        variant={isEdit ? "primary" : "secondary"}
                                        className={`flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isEdit
                                            ? "shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                            : "bg-[#10b981] !text-white hover:bg-[#059669] border-none shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                            }`}
                                    >
                                        {isEdit ? "Actualizar Motor" : "Activar Auto-Lanzamiento"}
                                        {isEdit ? <RotateCcw size={14} className="ml-2" /> : <CheckCircle2 size={14} className="ml-2" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
