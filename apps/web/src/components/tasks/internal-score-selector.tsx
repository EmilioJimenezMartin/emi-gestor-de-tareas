"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { updateTask } from "@/app/actions/tasks";
import { toast } from "sonner";
import { Task } from "@/lib/tasks";

interface InternalScoreSelectorProps {
    task: Task;
}

export function InternalScoreSelector({ task }: InternalScoreSelectorProps) {
    const [score, setScore] = useState(task.internal_score || 0);
    const [isPending, startTransition] = useTransition();

    const handleScoreUpdate = (newScore: number) => {
        setScore(newScore);
        startTransition(async () => {
            const result = await updateTask(task.id, { ...task, internal_score: newScore });
            if (result.success) {
                toast.success(`Score actualizado: ${newScore} estrellas`);
            } else {
                toast.error("Error al actualizar score");
                setScore(task.internal_score || 0);
            }
        });
    };

    return (
        <div className="flex items-center gap-1.5 p-2 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    disabled={isPending}
                    onClick={() => handleScoreUpdate(star)}
                    className={`p-1.5 rounded-lg transition-all ${score >= star ? "text-amber-500 hover:scale-110" : "text-neutral-600 hover:text-neutral-400"
                        }`}
                >
                    <Sparkles
                        size={14}
                        fill={score >= star ? "currentColor" : "none"}
                        className={score >= star ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" : ""}
                    />
                </button>
            ))}
        </div>
    );
}
