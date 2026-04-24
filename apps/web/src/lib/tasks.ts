import data from "@/data/tasks.json";

export type Task = (typeof data)["tasks"][number];

export function getTasks(): Task[] {
  return data.tasks;
}

export function getTaskBySlug(slug: string): Task | null {
  return data.tasks.find((t) => t.slug === slug) ?? null;
}

