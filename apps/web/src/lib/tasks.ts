import data from "@/data/tasks.json";

export type Task = (typeof data)["tasks"][number];

const getApiUrl = () => {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
};

export async function getTasks(): Promise<Task[]> {
  try {
    const res = await fetch(`${getApiUrl()}/tasks`, {
      next: { revalidate: 0 } // Always fetch fresh to mirror socket status or disable caching to represent DB correctly
    });
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

