import data from "@/data/tasks.json";
import { apiFetch } from "@/lib/api-fetch";

export type Task = (typeof data)["tasks"][number];

export async function getTasks(): Promise<Task[]> {
  try {
    const res = await apiFetch("/tasks", { next: { revalidate: 0 } } as any);
    if (!res.ok) throw new Error("API not ok");
    const json = await res.json();
    return json.tasks as Task[];
  } catch (error) {
    console.warn("API completely offline or unreachable. Falling back to tasks.json");
    return data.tasks;
  }
}

export async function getTaskBySlug(slug: string): Promise<Task | null> {
  const tasks = await getTasks();
  return tasks.find((t) => t.slug === slug) ?? null;
}

