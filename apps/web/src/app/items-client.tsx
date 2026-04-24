"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createApiSocket } from "@/lib/socket";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { itemsActions, type Item } from "@/store/items-slice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Layers, Calendar, Activity, Loader2, Send } from "lucide-react";

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
    try {
      const res = await fetch(`${apiUrl}/items?limit=50`, { method: "GET" });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = (await res.json()) as { items: Item[] };
      dispatch(itemsActions.setItems(data.items));
    } catch (e) {
      dispatch(itemsActions.setError(e instanceof Error ? e.message : String(e)));
    }
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
    socket.on("items:created", ({ item }: { item: Item }) => dispatch(itemsActions.addItem(item)));
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Bento Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="outline" className="flex flex-col gap-2 group hover:border-primary/20 transition-colors">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers size={20} />
            </div>
            <Badge variant="info">Total</Badge>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold tracking-tight">{items.length}</p>
            <p className="text-sm text-neutral-500 font-medium">Tareas activas</p>
          </div>
        </Card>

        <Card variant="outline" className="flex flex-col gap-2 group hover:border-emerald-500/20 transition-colors">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Activity size={20} />
            </div>
            <Badge variant="success">Socket</Badge>
          </div>
          <div className="mt-2">
            <p className="text-lg font-semibold truncate">{socketConnected ? "Conectado" : "Esperando..."}</p>
            <p className="text-sm text-neutral-500 font-medium">Estado del tiempo real</p>
          </div>
        </Card>

        <Card variant="outline" className="flex flex-col gap-2 group hover:border-amber-500/20 transition-colors">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Calendar size={20} />
            </div>
            <Badge variant="warning">Hoy</Badge>
          </div>
          <div className="mt-2">
            <p className="text-lg font-semibold">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
            <p className="text-sm text-neutral-500 font-medium">Sesión iniciada</p>
          </div>
        </Card>
      </div>

      {/* Action Zone */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Nueva Tarea</h3>
            <p className="text-sm text-neutral-500">Añade rápidamente una tarea a tu lista para hoy.</p>
          </div>
          <div className="space-y-4">
            <Input
              label="Nombre de la tarea"
              placeholder="Ej. Revisar reportes trimestrales"
              value={name}
              onChange={(e) => dispatch(itemsActions.setName(e.target.value))}
            />
            <Input
              label="Metadatos (JSON)"
              placeholder='{"prioridad": "alta"}'
              value={payload}
              onChange={(e) => dispatch(itemsActions.setPayload(e.target.value))}
              className="font-mono text-xs"
            />
            <div className="pt-2">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => void createItem()}
                disabled={loading || name.trim().length === 0}
                isLoading={loading}
              >
                {loading ? "Creando..." : (
                  <>
                    <Plus size={18} className="mr-2" />
                    Crear Tarea
                  </>
                )}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">{error}</p>}
          </div>
        </div>

        {/* Task List */}
        <div className="md:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold tracking-tight">Mis Tareas</h3>
            <Button variant="ghost" size="sm" onClick={() => void refresh()} className="h-9 px-3">
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          <div className="space-y-2">
            {items.length > 0 ? (
              items.map((it) => (
                <Card key={it._id} variant="outline" className="p-4 hover:bg-white/[0.02] active:scale-[0.99] transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary border border-white/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <Send size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{it.name}</h4>
                      <p className="text-xs text-neutral-500 font-medium">Creado el {new Date(it.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={it.name.toLowerCase().includes('urgente') ? 'error' : 'neutral'}>Completado</Badge>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-secondary/20 rounded-3xl border border-dashed border-white/5">
                <Layers size={48} className="text-neutral-700 mb-4" />
                <p className="text-neutral-500 font-medium">No hay tareas pendientes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

