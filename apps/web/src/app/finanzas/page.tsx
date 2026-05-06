"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  financeActions,
  type FinanceEntryCadence,
  type FinanceEntryKind,
  type FinanceMovement,
} from "@/store/finance-slice";
import { createApiSocket } from "@/lib/socket";
import {
  TrendingUp,
  Plus,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { MovementEditModal } from "@/components/finance/movement-edit-modal";

function formatEur(v: number) {
  return `${v.toFixed(2)}€`;
}

function annualizedAmount(cadence: FinanceEntryCadence, amount: number) {
  // Requirement: anual and puntual count the same; mensual is 12x anual.
  if (cadence === "mensual") return amount * 12;
  return amount;
}

export default function FinanzasPage() {
  const dispatch = useAppDispatch();
  const { movements, loaded } = useAppSelector((s) => s.finance);

  const [kind, setKind] = useState<FinanceEntryKind>("ingreso");
  const [cadence, setCadence] = useState<FinanceEntryCadence>("mensual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"edit" | "delete">("edit");
  const [activeMovement, setActiveMovement] = useState<FinanceMovement | null>(
    null
  );

  const apiUrl = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    if (loaded) return;
    const run = async () => {
      try {
        const res = await fetch(`${apiUrl}/finance/movements?limit=200`, {
          method: "GET",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { movements: FinanceMovement[] };
        dispatch(financeActions.setMovements({ movements: json.movements ?? [] }));
      } catch {
        // ignore on first load
      }
    };
    void run();
  }, [apiUrl, dispatch, loaded]);

  useEffect(() => {
    const socket = createApiSocket(apiUrl);
    socket.on("finance:movement_created", ({ movement }) =>
      dispatch(financeActions.upsertMovement({ movement }))
    );
    socket.on("finance:movement_updated", ({ movement }) =>
      dispatch(financeActions.upsertMovement({ movement }))
    );
    socket.on("finance:movement_deleted", ({ id }) =>
      dispatch(financeActions.removeMovement({ id }))
    );
    return () => {
      socket.disconnect();
    };
  }, [apiUrl, dispatch]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of movements) {
      const amt = annualizedAmount(e.cadence, e.amount);
      if (e.kind === "ingreso") income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [movements]);

  const ring = useMemo(() => {
    const r = 30;
    const c = 2 * Math.PI * r;
    const total = Math.max(1, totals.income + totals.expense);
    const incomeRatio = totals.income / total;
    const expenseRatio = totals.expense / total;
    return {
      c,
      incomeDash: `${c * incomeRatio} ${c}`,
      expenseDash: `${c * expenseRatio} ${c}`,
      expenseOffset: c * incomeRatio,
    };
  }, [totals.expense, totals.income]);

  const movementsSorted = useMemo(
    () =>
      movements
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [movements]
  );

  async function submit() {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const parsedAmount = Number(amount.replace(",", "."));
    if (!normalizedTitle) {
      toast.error("Añade un título");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Importe inválido");
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/finance/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          cadence,
          title: normalizedTitle,
          description: normalizedDescription,
          amount: parsedAmount,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 503) {
          toast.error("MongoDB no está conectado");
        } else {
          if (res.status === 404) {
            toast.error("API sin endpoints de Finanzas (reinicia/rebuild la API)");
            return;
          }
          toast.error(text ? `No se pudo guardar: ${text}` : "No se pudo guardar el movimiento");
        }
        return;
      }

      const json = (await res.json()) as { movement: FinanceMovement };
      if (json.movement) {
        dispatch(financeActions.upsertMovement({ movement: json.movement }));
      }
      toast.success("Movimiento guardado");
      setTitle("");
      setDescription("");
      setAmount("");
    } catch {
      toast.error("Error de red conectando con la API");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp size={16} className="sm:size-5" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">
            Finanzas
          </span>
          <Badge variant="neutral" className="bg-white/5 border-white/10 text-[8px] font-black uppercase tracking-widest">
            Ingresos vs gastos
          </Badge>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
          Centro financiero
        </h1>
        <p className="text-sm sm:text-base text-neutral-500 max-w-2xl">
          Crea ingresos y gastos (anual/mensual/puntual) y revisa el balance.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card
          variant="outline"
          className="lg:col-span-5 lg:sticky lg:top-8 h-fit border-white/5 bg-white/[0.02] p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                Nuevo movimiento
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Guardado en MongoDB (vía API).
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600 ml-1">
                  Tipo
                </span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as FinanceEntryKind)}
                  className="h-12 rounded-2xl bg-black/40 border border-white/10 px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="gasto">Gasto</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600 ml-1">
                  Periodicidad
                </span>
                <select
                  value={cadence}
                  onChange={(e) =>
                    setCadence(e.target.value as FinanceEntryCadence)
                  }
                  className="h-12 rounded-2xl bg-black/40 border border-white/10 px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                  <option value="puntual">Puntual</option>
                </select>
              </label>
            </div>

            <Input
              label="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Suscripción / Alquiler / Servicios"
              className="bg-black/40 border-white/10"
            />

            <Input
              label="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: AWS + dominios / Licencias / Nómina"
              className="bg-black/40 border-white/10"
            />

            <Input
              label="Importe (€)"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej: 49.90"
              className="bg-black/40 border-white/10"
            />

            <Button
              variant="secondary"
              onClick={submit}
              disabled={isSubmitting || title.trim().length === 0 || amount.trim().length === 0}
              isLoading={isSubmitting}
              className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/10"
            >
              <Plus size={14} className="mr-2" /> Añadir
            </Button>
          </div>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative group overflow-hidden p-5 sm:p-6 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-emerald-500/20 transition-all duration-500">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />
              <div className="relative space-y-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 w-fit text-white shadow-lg shadow-black/20">
                  <ArrowUpRight size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Ingresos</p>
                  <p className="text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-emerald-400 to-teal-300 bg-clip-text text-transparent italic tabular-nums mt-1">
                    {formatEur(totals.income)}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group overflow-hidden p-5 sm:p-6 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-rose-500/20 transition-all duration-500">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-400 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />
              <div className="relative space-y-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 w-fit text-white shadow-lg shadow-black/20">
                  <ArrowDownRight size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Gastos</p>
                  <p className="text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br from-rose-400 to-orange-300 bg-clip-text text-transparent italic tabular-nums mt-1">
                    {formatEur(totals.expense)}
                  </p>
                </div>
              </div>
            </div>

            <div className={`relative group overflow-hidden p-5 sm:p-6 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-amber-500/20 transition-all duration-500 ${totals.net >= 0 ? "hover:border-emerald-500/20" : "hover:border-rose-500/20"}`}>
              <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${totals.net >= 0 ? "from-emerald-500 to-teal-400" : "from-rose-500 to-orange-400"} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />
              <div className="relative space-y-4">
                <div className={`p-2 rounded-xl bg-gradient-to-br ${totals.net >= 0 ? "from-emerald-500 to-teal-400" : "from-rose-500 to-orange-400"} w-fit text-white shadow-lg shadow-black/20`}>
                  <TrendingUp size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Neto Total</p>
                  <p className={`text-2xl sm:text-3xl font-black tracking-tighter bg-gradient-to-br ${totals.net >= 0 ? "from-emerald-400 to-teal-300" : "from-rose-400 to-orange-300"} bg-clip-text text-transparent italic tabular-nums mt-1`}>
                    {formatEur(totals.net)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card
            variant="outline"
            className="border-white/5 bg-white/[0.02] p-0 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                  Movimientos
                </h2>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {movementsSorted.length} elemento(s)
                </p>
              </div>
            </div>

            <ul className="divide-y divide-white/5">
              {movementsSorted.map((e) => (
                <li key={e._id} className="px-5 sm:px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="neutral"
                          className={
                            e.kind === "ingreso"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }
                        >
                          {e.kind}
                        </Badge>
                        <Badge
                          variant="neutral"
                          className="bg-white/5 border-white/10 text-[8px] font-black uppercase tracking-widest"
                        >
                          {e.cadence}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-bold text-white truncate">
                        {e.title}
                      </p>
                      {e.description ? (
                        <p className="mt-1 text-xs text-neutral-500 line-clamp-2">
                          {e.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-neutral-600 font-mono">
                        {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${e.kind === "ingreso" ? "bg-emerald-500" : "bg-rose-500"
                            } shadow-[0_0_10px_rgba(255,255,255,0.12)]`}
                        />
                        <p
                          className={`text-xl font-black italic tracking-tighter tabular-nums bg-clip-text text-transparent ${e.kind === "ingreso"
                            ? "bg-gradient-to-br from-emerald-300 to-teal-200"
                            : "bg-gradient-to-br from-rose-300 to-orange-200"
                            }`}
                        >
                          {e.kind === "gasto" ? "-" : "+"}
                          {formatEur(e.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveMovement(e);
                            setModalMode("edit");
                            setModalOpen(true);
                          }}
                          className="rounded-xl border border-white/10 hover:bg-white/5 text-neutral-300"
                        >
                          <Pencil size={14} className="mr-2" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveMovement(e);
                            setModalMode("delete");
                            setModalOpen(true);
                          }}
                          className="rounded-xl border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 text-neutral-400"
                        >
                          <Trash2 size={14} className="mr-2" /> Borrar
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}

              {movementsSorted.length === 0 ? (
                <li className="px-5 sm:px-6 py-10 text-center text-sm text-neutral-500">
                  No hay movimientos todavía.
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </section>

      <MovementEditModal
        open={modalOpen}
        mode={modalMode}
        movement={activeMovement}
        apiUrl={apiUrl}
        onClose={() => setModalOpen(false)}
        onUpdated={(movement) =>
          dispatch(financeActions.upsertMovement({ movement }))
        }
        onDeleted={(id) => dispatch(financeActions.removeMovement({ id }))}
      />
    </div>
  );
}
