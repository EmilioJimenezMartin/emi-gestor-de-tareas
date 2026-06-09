"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api-fetch";

const DATA_PATH = path.join(process.cwd().includes("apps/web") ? process.cwd() : path.join(process.cwd(), "apps/web"), "src/data/tasks.json");

export async function updateTaskProperty(taskId: string, updates: Record<string, any>) {
    try {
        try {
            const response = await apiFetch(`/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
                cache: "no-store",
            });
            const data = await response.json();
            if (response.ok && data.success) {
                console.log(`[updateTaskProperty] SUCCESS for ${taskId}`);
            } else {
                console.error(`[updateTaskProperty] API ERROR for ${taskId}:`, data);
                throw new Error("API responded with error");
            }
        } catch (apiError: any) {
            console.error(`[updateTaskProperty] Persistence failed for ${taskId}:`, apiError.message);
            throw apiError;
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");
        revalidatePath("/tareas/[slug]", "page");
        revalidatePath("/dashboard", "layout");

        return { success: true };
    } catch (error) {
        console.error("Error updating task property:", error);
        return { success: false, error: "Failed to update property" };
    }
}

export async function createTask(taskData: Record<string, any>) {
    try {
        try {
            const response = await apiFetch("/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(taskData),
            });
            if (!response.ok) {
                console.warn(`API returned ${response.status}. Falling back to tasks.json`);
                throw new Error("API failed");
            }
        } catch (apiError) {
            console.warn("API completely unreachable. Appending to local tasks.json fallback...");
            const fileContents = fs.readFileSync(DATA_PATH, "utf8");
            const data = JSON.parse(fileContents);

            if (!taskData.id) taskData.id = taskData.slug || `task-${Date.now()}`;
            if (!taskData.slug) taskData.slug = taskData.id;

            data.tasks.push(taskData);
            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");

        return { success: true };
    } catch (error) {
        console.error("Error creating task:", error);
        return { success: false, error: "Failed to create task" };
    }
}

export async function deleteTask(taskId: string) {
    try {
        try {
            const response = await apiFetch(`/tasks/${taskId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                console.warn(`API returned ${response.status}. Falling back to tasks.json`);
                throw new Error("API failed");
            }
        } catch (apiError) {
            console.warn("API completely unreachable. Removing from local tasks.json fallback...");
            const fileContents = fs.readFileSync(DATA_PATH, "utf8");
            const data = JSON.parse(fileContents);

            data.tasks = data.tasks.filter((t: any) => t.id !== taskId);
            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");

        return { success: true };
    } catch (error) {
        console.error("Error deleting task:", error);
        return { success: false, error: "Failed to delete task" };
    }
}

export async function updateTask(taskId: string, taskData: Record<string, any>) {
    return updateTaskProperty(taskId, taskData);
}

export async function addTaskComment(taskId: string, text: string) {
    try {
        const response = await apiFetch(`/tasks/${taskId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            console.error(`[addTaskComment] API ERROR for ${taskId}:`, data);
            return { success: false, error: data?.error || "Failed to add comment" };
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");
        revalidatePath("/tareas/[slug]", "page");
        revalidatePath("/dashboard", "layout");

        return { success: true, task: data.task, comment: data.comment };
    } catch (error: any) {
        console.error("Error adding task comment:", error);
        return { success: false, error: "Failed to add comment" };
    }
}

export async function updateTaskComment(taskId: string, commentId: string, text: string) {
    try {
        const response = await apiFetch(`/tasks/${taskId}/comments/${commentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            console.error(`[updateTaskComment] API ERROR for ${taskId}/${commentId}:`, data);
            return { success: false, error: data?.error || "Failed to update comment" };
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");
        revalidatePath("/tareas/[slug]", "page");
        revalidatePath("/dashboard", "layout");

        return { success: true, task: data.task };
    } catch (error: any) {
        console.error("Error updating task comment:", error);
        return { success: false, error: "Failed to update comment" };
    }
}

export async function deleteTaskComment(taskId: string, commentId: string) {
    try {
        const response = await apiFetch(`/tasks/${taskId}/comments/${commentId}`, {
            method: "DELETE",
            cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            console.error(`[deleteTaskComment] API ERROR for ${taskId}/${commentId}:`, data);
            return { success: false, error: data?.error || "Failed to delete comment" };
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");
        revalidatePath("/tareas/[slug]", "page");
        revalidatePath("/dashboard", "layout");

        return { success: true, task: data.task };
    } catch (error: any) {
        console.error("Error deleting task comment:", error);
        return { success: false, error: "Failed to delete comment" };
    }
}
