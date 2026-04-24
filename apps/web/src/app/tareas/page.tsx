import { getTasks } from "@/lib/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { Settings } from "lucide-react";

export default function TareasPage() {
  const tasks = getTasks();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white italic">
          Explorador de <span className="text-primary font-black">Oportunidades</span>
        </h1>
        <p className="text-sm sm:text-base text-neutral-500 max-w-2xl">
          Pipeline de ejecución cargado desde el núcleo de datos. Filtra e identifica oportunidades en tiempo real.
        </p>
      </header>

      <TaskList initialTasks={tasks} />
    </div>
  );
}