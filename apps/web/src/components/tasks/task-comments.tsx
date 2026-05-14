"use client";

import { useState, useTransition, useEffect } from "react";
import { MessageSquare, Plus, Trash2, Quote, Edit2, Check, X, AlertTriangle } from "lucide-react";
import { addTaskComment, updateTaskComment, deleteTaskComment } from "@/app/actions/tasks";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type TaskComment = {
    id: string;
    text: string;
    createdAt?: string;
    updatedAt?: string;
};

interface TaskCommentsProps {
    task: {
        id: string;
        comments?: Array<TaskComment | string>;
        title: string;
    }
}

export function TaskComments({ task }: TaskCommentsProps) {
    const router = useRouter();
    const [newComment, setNewComment] = useState("");
    const [isPending, startTransition] = useTransition();
    const coerceComments = (raw: Array<TaskComment | string> | undefined): TaskComment[] => {
        if (!raw) return [];
        return raw
            .map((c) => {
                if (typeof c === "string") {
                    const text = c.trim();
                    if (!text) return null;
                    return { id: `legacy-${Date.now()}-${Math.random().toString(16).slice(2)}`, text };
                }
                if (c && typeof c === "object") {
                    const text = (c.text || "").trim();
                    if (!text) return null;
                    return { id: c.id, text, createdAt: c.createdAt, updatedAt: c.updatedAt };
                }
                return null;
            })
            .filter(Boolean) as TaskComment[];
    };

    const [comments, setComments] = useState<TaskComment[]>(coerceComments(task.comments));

    useEffect(() => {
        if (task.comments) {
            setComments(coerceComments(task.comments));
        }
    }, [task.comments]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    const handleAddComment = () => {
        if (!newComment.trim()) return;

        const newItem: TaskComment = {
            id: `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            text: newComment.trim(),
            createdAt: new Date().toISOString()
        };
        const updatedComments = [...comments, newItem];

        startTransition(async () => {
            const result = await addTaskComment(task.id, newItem.text);
            if (result.success) {
                // Prefer the server-generated comment (id/createdAt) if present.
                const serverComment = (result as any).comment as TaskComment | undefined;
                setComments((prev) => (serverComment ? [...prev, serverComment] : [...prev, newItem]));
                setNewComment("");
                toast.success("Comentario guardado en base de datos");
                router.refresh();
            } else {
                toast.error("Error al guardar en MongoDB");
            }
        });
    };

    const handleUpdateComment = (id: string) => {
        if (!editContent.trim()) return;

        const updatedComments = comments.map((c) =>
            c.id === id ? { ...c, text: editContent.trim(), updatedAt: new Date().toISOString() } : c
        );

        startTransition(async () => {
            const result = await updateTaskComment(task.id, id, editContent.trim());
            if (result.success) {
                setComments(updatedComments);
                setEditingId(null);
                setEditContent("");
                toast.success("Comentario actualizado");
                router.refresh();
            } else {
                toast.error("Error al actualizar");
            }
        });
    };

    const confirmDelete = () => {
        if (idToDelete === null) return;

        const updatedComments = comments.filter((c) => c.id !== idToDelete);

        startTransition(async () => {
            const result = await deleteTaskComment(task.id, idToDelete);
            if (result.success) {
                setComments(updatedComments);
                setIdToDelete(null);
                toast.success("Comentario eliminado");
                router.refresh();
            } else {
                toast.error("Error al eliminar");
            }
        });
    };

    const startEditing = (id: string, content: string) => {
        setEditingId(id);
        setEditContent(content);
    };

    return (
        <Card variant="outline" className="p-6 sm:p-8 space-y-8 border-white/5 bg-white/[0.02] overflow-hidden relative group">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-700" />

            {/* Confirmation Modal - FIXED TO SCREEN (FULL SCREEN) */}
            {idToDelete !== null && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 sm:p-8 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIdToDelete(null)} />
                    <Card variant="glass" className="relative w-full max-w-sm p-8 sm:p-10 border-rose-500/30 bg-black shadow-[0_0_50px_rgba(244,63,94,0.1)] flex flex-col items-center text-center space-y-8 animate-in zoom-in duration-300 rounded-[32px]">
                        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner group">
                            <AlertTriangle size={40} className="group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-2xl font-bold text-white tracking-tight italic">¿Eliminar nota?</h3>
                            <p className="text-sm text-neutral-500 leading-relaxed max-w-[240px]">Esta acción borrará permanentemente el comentario de la base de datos.</p>
                        </div>
                        <div className="flex gap-4 w-full">
                            <Button
                                variant="outline"
                                className="flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest border-white/5 bg-white/5 hover:bg-white/10 text-white transition-all"
                                onClick={() => setIdToDelete(null)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
                                onClick={confirmDelete}
                                disabled={isPending}
                            >
                                {isPending ? "..." : "Eliminar"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

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

            {/* Input Section */}
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
                        {[...comments].reverse().map((comment) => {
                            const isEditing = editingId === comment.id;

                            return (
                                <div key={comment.id} className={`relative overflow-hidden flex flex-col gap-3 p-5 sm:p-6 rounded-2xl transition-all duration-300 border ${isEditing ? "bg-indigo-500/10 border-indigo-500/20" : "bg-white/[0.02] border-white/5 hover:border-white/10"} group/comment`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${isEditing ? "bg-indigo-400 shadow-[2px_0_10px_rgba(129,140,248,0.5)]" : "bg-indigo-500/30"}`} />

                                    <div className="flex-1 w-full pl-2">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                <textarea
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="w-full bg-black/40 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all resize-none min-h-[120px]"
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingId(null)}
                                                        className="h-9 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 text-neutral-400"
                                                    >
                                                        <X size={14} className="mr-1" /> Cancelar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateComment(comment.id)}
                                                        disabled={isPending}
                                                        className="h-9 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                                                    >
                                                        <Check size={14} className="mr-1" /> Guardar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between w-full group/inner">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-[14px] sm:text-[15px] text-neutral-300 leading-relaxed whitespace-pre-wrap break-words">{comment.text}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0 bg-white/5 sm:bg-transparent p-1.5 sm:p-0 rounded-xl sm:opacity-0 sm:group-hover/comment:opacity-100 transition-all self-end sm:self-auto">
                                                    <button
                                                        onClick={() => startEditing(comment.id, comment.text)}
                                                        disabled={isPending}
                                                        className="flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                                                        title="Editar comentario"
                                                    >
                                                        <Edit2 size={16} />
                                                        <span className="sm:hidden text-[10px] font-black uppercase tracking-widest">Editar</span>
                                                    </button>
                                                    <div className="w-px h-4 bg-white/10 sm:hidden" />
                                                    <button
                                                        onClick={() => setIdToDelete(comment.id)}
                                                        disabled={isPending}
                                                        className="flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-rose-500/10 text-neutral-500 hover:text-rose-500 transition-all"
                                                        title="Eliminar comentario"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span className="sm:hidden text-[10px] font-black uppercase tracking-widest">Eliminar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Card>
    );
}
