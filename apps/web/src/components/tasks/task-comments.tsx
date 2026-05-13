"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { MessageSquare, Plus, Trash2, Send, Quote, Edit2, Check, X } from "lucide-react";
import { updateTask } from "@/app/actions/tasks";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface TaskCommentsProps {
    task: {
        id: string;
        comments?: string[];
        title: string;
    }
}

export function TaskComments({ task }: TaskCommentsProps) {
    const router = useRouter();
    const [newComment, setNewComment] = useState("");
    const [isPending, startTransition] = useTransition();
    const [comments, setComments] = useState<string[]>(task.comments || []);

    // Editing state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editContent, setEditContent] = useState("");

    const handleAddComment = () => {
        if (!newComment.trim()) return;

        const updatedComments = [...comments, newComment.trim()];

        startTransition(async () => {
            const result = await updateTask(task.id, { ...task, comments: updatedComments });
            if (result.success) {
                setComments(updatedComments);
                setNewComment("");
                toast.success("Comentario añadido");
                router.refresh();
            } else {
                toast.error("Error al añadir comentario");
            }
        });
    };

    const handleUpdateComment = (index: number) => {
        if (!editContent.trim()) return;

        const updatedComments = [...comments];
        updatedComments[index] = editContent.trim();

        startTransition(async () => {
            const result = await updateTask(task.id, { ...task, comments: updatedComments });
            if (result.success) {
                setComments(updatedComments);
                setEditingIndex(null);
                setEditContent("");
                toast.success("Comentario actualizado");
                router.refresh();
            } else {
                toast.error("Error al actualizar comentario");
            }
        });
    };

    const handleDeleteComment = (index: number) => {
        const updatedComments = comments.filter((_, i) => i !== index);

        startTransition(async () => {
            const result = await updateTask(task.id, { ...task, comments: updatedComments });
            if (result.success) {
                setComments(updatedComments);
                toast.success("Comentario eliminado");
                router.refresh();
            } else {
                toast.error("Error al eliminar comentario");
            }
        });
    };

    const startEditing = (index: number, content: string) => {
        setEditingIndex(index);
        setEditContent(content);
    };

    return (
        <Card variant="outline" className="p-6 sm:p-8 space-y-8 border-white/5 bg-white/[0.02] overflow-hidden relative group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-700" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                <div className="space-y-2">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <MessageSquare className="text-indigo-400" size={20} />
                        Notas y Comentarios
                    </h2>
                    <div className="h-1 w-20 bg-gradient-to-r from-indigo-500 to-transparent rounded-full" />
                </div>
                <div className="w-fit bg-white/5 px-3 py-1 rounded-full border border-white/10 shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{comments.length} Comentarios</span>
                </div>
            </div>

            {/* Inpue Section - MOVED TO TOP */}
            <div className="relative">
                <div className="group/input flex flex-col sm:flex-row gap-2 p-1.5 bg-black/20 border border-white/5 rounded-[24px] focus-within:border-indigo-500/40 focus-within:bg-black/30 transition-all duration-300">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Añadir una nota técnica o comentario..."
                        rows={1}
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm text-white placeholder:text-neutral-600 p-3 resize-none scrollbar-none min-h-[44px]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment();
                            }
                        }}
                    />
                    <button
                        onClick={handleAddComment}
                        disabled={isPending || !newComment.trim()}
                        className="h-11 sm:h-auto px-6 py-3 sm:py-0 rounded-2xl bg-indigo-500 text-white flex items-center justify-center gap-2 hover:bg-indigo-400 disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-indigo-500/10"
                    >
                        <Plus size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Añadir Nota</span>
                    </button>
                </div>
            </div>

            <div className="space-y-4 relative">
                {comments.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-neutral-600">
                            <Quote size={20} />
                        </div>
                        <p className="text-xs font-medium text-neutral-500 max-w-[200px]">No hay comentarios aún. Documenta aquí los detalles clave.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {[...comments].reverse().map((comment, revIdx) => {
                            const index = comments.length - 1 - revIdx;
                            const isEditing = editingIndex === index;

                            return (
                                <div key={index} className={`flex flex-col gap-3 p-5 rounded-2xl transition-all duration-300 border ${isEditing ? "bg-indigo-500/5 border-indigo-500/20" : "bg-white/[0.03] border-white/5 hover:border-white/10"} group/comment`}>
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="w-full bg-black/20 border border-indigo-500/30 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none min-h-[80px]"
                                                autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingIndex(null)}
                                                    className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <X size={12} className="mr-1" /> Cancelar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleUpdateComment(index)}
                                                    disabled={isPending}
                                                    className="h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-[9px] font-black uppercase tracking-widest"
                                                >
                                                    <Check size={12} className="mr-1" /> Guardar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{comment}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover/comment:opacity-100 transition-all">
                                                <button
                                                    onClick={() => startEditing(index, comment)}
                                                    disabled={isPending}
                                                    className="p-2 rounded-lg hover:bg-white/5 text-neutral-600 hover:text-white transition-all"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteComment(index)}
                                                    disabled={isPending}
                                                    className="p-2 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-neutral-600 transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Card>
    );
}
