"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  _id: string;
  name: string;
  payload?: unknown;
  createdAt: string;
};

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function ItemsClient() {
  const apiUrl = useMemo(() => getApiUrl().replace(/\/$/, ""), []);
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [payload, setPayload] = useState('{"foo":"bar"}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch(`${apiUrl}/items?limit=50`, { method: "GET" });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items);
  }, [apiUrl]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  async function createItem() {
    setLoading(true);
    setError(null);
    try {
      let parsedPayload: unknown | undefined = undefined;
      if (payload.trim().length > 0) parsedPayload = JSON.parse(payload);

      const res = await fetch(`${apiUrl}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payload: parsedPayload }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Items</h2>
        <p className="text-sm text-zinc-600">
          API: <span className="font-mono">{apiUrl}</span>
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-700">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg border border-zinc-200 px-3 outline-none focus:border-zinc-400"
              placeholder="ej: import-2026-04-22"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-700">Payload (JSON opcional)</span>
            <input
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="h-10 rounded-lg border border-zinc-200 px-3 font-mono text-xs outline-none focus:border-zinc-400"
              placeholder='{"foo":"bar"}'
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void createItem()}
            disabled={loading || name.trim().length === 0}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear item"}
          </button>
          <button
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Refrescar
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
        <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600">
          <div className="col-span-4">Nombre</div>
          <div className="col-span-8">Creado</div>
        </div>
        <ul className="divide-y divide-zinc-200">
          {items.map((it) => (
            <li key={it._id} className="grid grid-cols-12 px-4 py-3 text-sm">
              <div className="col-span-4 truncate font-medium">{it.name}</div>
              <div className="col-span-8 font-mono text-xs text-zinc-600">
                {new Date(it.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-600">
              No hay items todavía.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}

