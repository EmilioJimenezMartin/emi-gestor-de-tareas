import { getTasks } from "@/lib/tasks";
import { TaskList } from "@/components/tasks/task-list";

export default function TareasPage() {
  const tasks = getTasks();

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Motores de <span className="text-primary font-black">Arbitraje</span>
          </h1>
          <p className="text-neutral-500 max-w-2xl font-medium">
            Pipeline de ejecución cargado desde el núcleo de datos. Filtra e identifica oportunidades en tiempo real.
          </p>
        </header>

        <TaskList initialTasks={tasks} />
      </main>
    </div>
  );
}