import { ItemsClient } from "./items-client";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-100">emi-gestor-de-tareas</h1>
          <p className="text-sm text-slate-400">
            Frontend en Next.js consumiendo un API Node/Fastify + MongoDB.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/tareas"
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-neutral-100"
            >
              Ver tareas
            </Link>
          </div>
        </header>
        <ItemsClient />
      </main>
    </div>
  );
}
