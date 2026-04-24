"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const DATA_PATH = path.join(process.cwd(), "apps/web/src/data/tasks.json");

export async function updateTaskStatus(taskId: string, newStatus: string) {
    try {
        const fileContents = fs.readFileSync(DATA_PATH, "utf8");
        const data = JSON.parse(fileContents);

        const taskIndex = data.tasks.findIndex((t: any) => t.id === taskId);

        if (taskIndex === -1) {
            throw new Error("Task not found");
        }

        data.tasks[taskIndex].status = newStatus;

        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

        revalidatePath("/");
        revalidatePath(`/tareas/${data.tasks[taskIndex].slug}`);

        return { success: true };
    } catch (error) {
        console.error("Error updating task status:", error);
        return { success: false, error: "Failed to update status" };
    }
}
