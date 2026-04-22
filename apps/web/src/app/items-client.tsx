"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createApiSocket } from "@/lib/socket";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { itemsActions, type Item } from "@/store/items-slice";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function ItemsClient() {
  const apiUrl = useMemo(() => getApiUrl().replace(/\/$/, ""), []);
  const dispatch = useAppDispatch();
  const { items, name, payload, loading, error, socketConnected } =
    useAppSelector((s) => s.items);

  const refresh = useCallback(async () => {
    dispatch(itemsActions.setError(null));
    const res = await fetch(`${apiUrl}/items?limit=50`, { method: "GET" });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = (await res.json()) as { items: Item[] };
    dispatch(itemsActions.setItems(data.items));
  }, [apiUrl, dispatch]);

  useEffect(() => {
    refresh().catch((e) =>
      dispatch(itemsActions.setError(e instanceof Error ? e.message : String(e)))
    );
  }, [dispatch, refresh]);

  useEffect(() => {
    const socket = createApiSocket(apiUrl);
    socket.on("connect", () => dispatch(itemsActions.setSocketConnected(true)));
    socket.on("disconnect", () =>
      dispatch(itemsActions.setSocketConnected(false))
    );
    socket.on("items:created", ({ item }) => dispatch(itemsActions.addItem(item)));
    return () => {
      socket.disconnect();
    };
  }, [apiUrl, dispatch]);

  async function createItem() {
    dispatch(itemsActions.setLoading(true));
    dispatch(itemsActions.setError(null));
    try {
      let parsedPayload: unknown | undefined = undefined;
      if (payload.trim().length > 0) parsedPayload = JSON.parse(payload);

      const res = await fetch(`${apiUrl}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payload: parsedPayload }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = (await res.json()) as { item: Item };
      dispatch(itemsActions.addItem(data.item));
      dispatch(itemsActions.resetForm());
    } catch (e) {
      dispatch(itemsActions.setError(e instanceof Error ? e.message : String(e)));
    } finally {
      dispatch(itemsActions.setLoading(false));
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-slate-100">Items</h2>
        <p className="text-sm text-slate-400">
          API: <span className="font-mono text-slate-300">{apiUrl}</span>
        </p>
        <p className="text-xs text-slate-500">
          Socket: {socketConnected ? "conectado" : "desconectado"}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Nombre</span>
            <input
              value={name}
              onChange={(e) => dispatch(itemsActions.setName(e.target.value))}
              className="h-10 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-slate-100 outline-none focus:border-slate-500"
              placeholder="ej: import-2026-04-22"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Payload (JSON opcional)</span>
            <input
              value={payload}
              onChange={(e) => dispatch(itemsActions.setPayload(e.target.value))}
              className="h-10 rounded-lg border border-slate-700 bg-slate-800/60 px-3 font-mono text-xs text-slate-100 outline-none focus:border-slate-500"
              placeholder='{"foo":"bar"}'
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void createItem()}
            disabled={loading || name.trim().length === 0}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {loading ? "Creando..." : "Crear item"}
          </button>
          <button
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Refrescar
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-12 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-400">
          <div className="col-span-4">Nombre</div>
          <div className="col-span-8">Creado</div>
        </div>
        <ul className="divide-y divide-slate-800">
          {items.map((it) => (
            <li key={it._id} className="grid grid-cols-12 px-4 py-3 text-sm text-slate-200">
              <div className="col-span-4 truncate font-medium">{it.name}</div>
              <div className="col-span-8 font-mono text-xs text-slate-500">
                {new Date(it.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">
              No hay items todavía.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
