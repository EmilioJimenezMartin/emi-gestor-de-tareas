import { ItemsClient } from "./items-client";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-100">emi-gestor-de-tareas</h1>
          <p className="text-sm text-slate-400">
            Frontend en Next.js consumiendo un API Node/Fastify + MongoDB.
          </p>
        </header>
        <ItemsClient />
      </main>
    </div>
  );
}
