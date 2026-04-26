"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const DATA_PATH = path.join(process.cwd().includes("apps/web") ? process.cwd() : path.join(process.cwd(), "apps/web"), "src/data/tasks.json");

export async function updateTaskProperty(taskId: string, updates: Record<string, any>) {
    try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
        try {
            const response = await fetch(`${apiUrl}/tasks/${taskId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            if (!response.ok) {
                console.warn(`API returned ${response.status}. Falling back to tasks.json`);
                throw new Error("API failed");
            }
        } catch (apiError) {
            console.warn("API completely unreachable. Modifying local tasks.json fallback...");
            const fileContents = fs.readFileSync(DATA_PATH, "utf8");
            const data = JSON.parse(fileContents);

            const taskIndex = data.tasks.findIndex((t: any) => t.id === taskId);

            if (taskIndex === -1) {
                throw new Error("Task not found in fallback JSON");
            }

            data.tasks[taskIndex] = { ...data.tasks[taskIndex], ...updates };
            fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        }

        revalidatePath("/");
        revalidatePath("/tareas", "layout");

        return { success: true };
    } catch (error) {
        console.error("Error updating task property:", error);
        return { success: false, error: "Failed to update property" };
    }
}

export async function createTask(taskData: Record<string, any>) {
    try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
        try {
            const response = await fetch(`${apiUrl}/tasks`, {
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
