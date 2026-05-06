"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task } from "@/lib/tasks";
import { AddTaskModal } from "./add-task-modal";
import { deleteTask } from "@/app/actions/tasks";
import { toast } from "sonner";

interface TaskDetailActionsProps {
    task: Task;
}

export function TaskDetailActions({ task }: TaskDetailActionsProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteTask(task.id);
            if (result.success) {
                toast.success("¡Motor eliminado con éxito!");
                router.push("/tareas");
            } else {
                toast.error("Error al eliminar el motor.");
            }
        });
    };

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <Button
                        variant="primary"
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex-1 h-11 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-white/5"
                    >
                        <Pencil size={14} className="mr-2" /> Editar Motor
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="flex-1 h-11 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/5 hover:bg-rose-500/10 hover:text-rose-500 text-neutral-500"
                    >
                        <Trash2 size={14} className="mr-2" /> Eliminar
                    </Button>
                </div>

                <Button
                    variant="secondary"
                    className="w-full text-[10px] font-black uppercase tracking-widest h-12 shadow-lg shadow-primary/10 rounded-2xl"
                >
                    Ejecutar Motor Manualmente
                </Button>
            </div>

            {/* Modals */}
            <AddTaskModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                initialData={task}
            />

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setIsDeleteModalOpen(false)} />
                    <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[32px] p-8 shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 my-auto">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white italic">¿Estás seguro?</h3>
                                <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                                    Estás a punto de eliminar el motor <strong>{task.title}</strong>. Esta acción es irreversible.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 w-full">
                                <Button
                                    disabled={isPending}
                                    onClick={handleDelete}
                                    className="w-full h-12 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-rose-600/20"
                                >
                                    {isPending ? "Eliminando..." : "Sí, eliminar permanentemente"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="w-full h-12 rounded-2xl border border-white/5 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
