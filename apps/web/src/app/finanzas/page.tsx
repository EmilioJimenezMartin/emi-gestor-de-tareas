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

function calculateForecast(movements: FinanceMovement[], years: number) {
  const now = new Date();
  const forecastEnd = new Date();
  forecastEnd.setFullYear(now.getFullYear() + years);

  let income = 0;
  let expense = 0;

  for (const m of movements) {
    const start = new Date(m.date || m.createdAt);
    const mEnd = m.endDate ? new Date(m.endDate) : null;

    // The limit of our calculation is either the forecast end or the movement's end, whichever is sooner.
    const limit = mEnd && mEnd < forecastEnd ? mEnd : forecastEnd;

    if (start > limit) continue;

    let occurrences = 0;

    if (m.cadence === "puntual") {
      occurrences = 1;
    } else if (m.cadence === "mensual") {
      const months = (limit.getFullYear() - start.getFullYear()) * 12 + (limit.getMonth() - start.getMonth()) + 1;
      occurrences = Math.max(0, months);
    } else if (m.cadence === "anual") {
      const yearsElapsed = limit.getFullYear() - start.getFullYear() + 1;
      occurrences = Math.max(0, yearsElapsed);
    }

    const total = occurrences * m.amount;
    if (m.kind === "ingreso") income += total;
    else expense += total;
  }
  return { income, expense, net: income - expense };
}

function annualizedAmount(cadence: FinanceEntryCadence, amount: number) {
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
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

  const forecast1Y = useMemo(() => calculateForecast(movements, 1), [movements]);
  const forecast10Y = useMemo(() => calculateForecast(movements, 10), [movements]);

  const trend = useMemo(() => {
    const current = calculateForecast(movements, 0); // Value as of now
    let monthlyNet = 0;
    for (const m of movements) {
      let val = 0;
      if (m.cadence === "mensual") val = m.amount;
      else if (m.cadence === "anual") val = m.amount / 12;

      if (val === 0) continue;
      if (m.kind === "ingreso") monthlyNet += val;
      else monthlyNet -= val;
    }

    if (current.net >= 0 && monthlyNet >= 0) return { status: "pos", label: "Tendencia positiva estable" };
    if (current.net < 0 && monthlyNet <= 0) return { status: "neg", label: "Tendencia negativa estable" };

    if (current.net < 0 && monthlyNet > 0) {
      const months = Math.abs(current.net) / monthlyNet;
      const flip = new Date();
      flip.setMonth(flip.getMonth() + months);
      return { status: "recup", label: `Balance positivo en ${flip.toLocaleDateString()}` };
    }
    if (current.net > 0 && monthlyNet < 0) {
      const months = current.net / Math.abs(monthlyNet);
      const flip = new Date();
      flip.setMonth(flip.getMonth() + months);
      return { status: "deplet", label: `Balance negativo en ${flip.toLocaleDateString()}` };
    }
    return { status: "stable", label: "Tendencia estable" };
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
        .sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || "")),
    [movements]
  );

  async function submit() {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const parsedAmount = Number(amount.replace(",", "."));

    if (!normalizedTitle) return toast.error("Añade un título");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return toast.error("Importe inválido");
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
          date: new Date(date).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        toast.error(text ? `Error: ${text}` : "No se pudo guardar");
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
      setEndDate("");
    } catch {
      toast.error("Error de red");
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

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fecha inicio"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 bg-white/[0.03] border-white/10 rounded-2xl focus:ring-primary/20 transition-all text-white"
                />
                <Input
                  label="Fecha fin (Opcional)"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 bg-white/[0.03] border-white/10 rounded-2xl focus:ring-primary/20 transition-all text-white"
                />
              </div>

              <Button
                onClick={submit}
                disabled={isSubmitting}
                className="w-full h-14 bg-gradient-to-br from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/10 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : "Crear movimiento"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trend Intelligence Card */}
            <div className={`relative group overflow-hidden p-6 rounded-3xl border border-white/5 bg-white/[0.02] transition-all duration-500 ${trend.status === 'pos' ? 'hover:border-emerald-500/20' : trend.status === 'neg' ? 'hover:border-rose-500/20' : 'hover:border-primary/20'}`}>
              <div className={`absolute -right-6 -top-6 w-24 h-24 blur-2xl transition-opacity duration-500 opacity-0 group-hover:opacity-10 bg-gradient-to-br ${trend.status === 'pos' ? 'from-emerald-500 to-teal-400' : trend.status === 'neg' ? 'from-rose-500 to-orange-400' : 'from-primary to-blue-400'}`} />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className={trend.status === 'pos' ? 'text-emerald-400' : trend.status === 'neg' ? 'text-rose-400' : 'text-primary'} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tendencia de Capital</span>
                </div>
                <h4 className="text-lg font-bold text-white tracking-tight">
                  {trend.label}
                </h4>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest ${trend.status === 'pos' ? 'bg-emerald-500/10 text-emerald-400' : trend.status === 'neg' ? 'bg-rose-500/10 text-rose-400' : 'bg-primary/10 text-primary'}`}>
                    {trend.status === 'pos' || trend.status === 'recup' ? 'Saludable' : 'Riesgo'}
                  </div>
                </div>
              </div>
            </div>

            <Card
              className="relative group overflow-hidden border-white/5 bg-white/[0.02] p-6 rounded-3xl"
            >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/20 blur-3xl opacity-0 group-hover:opacity-20 transition-all duration-500" />
              <div className="relative flex flex-col items-center justify-center h-full text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-2">balance neto total</p>
                <div className={`text-4xl font-black italic tracking-tighter tabular-nums bg-clip-text text-transparent bg-gradient-to-br ${totals.net >= 0 ? "from-emerald-400 to-teal-400" : "from-rose-400 to-orange-400"}`}>
                  {formatEur(totals.net)}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary/60 px-1">
              <TrendingUp size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Proyecciones a futuro</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1 Year Forecast */}
              <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-primary/20 transition-all duration-500">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-primary to-blue-400 opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-500" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Previsión 1 Año</p>
                    <p className={`text-xl font-black tracking-tighter italic tabular-nums mt-1 bg-gradient-to-br bg-clip-text text-transparent ${forecast1Y.net >= 0 ? "from-emerald-400 to-teal-300" : "from-rose-400 to-orange-300"}`}>
                      {formatEur(forecast1Y.net)}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 text-primary border border-white/10">
                    <TrendingUp size={14} />
                  </div>
                </div>
              </div>

              {/* 10 Year Forecast */}
              <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-amber-500/20 transition-all duration-500">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-400 opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-500" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Previsión 10 Años</p>
                    <p className={`text-xl font-black tracking-tighter italic tabular-nums mt-1 bg-gradient-to-br bg-clip-text text-transparent ${forecast10Y.net >= 0 ? "from-amber-400 to-yellow-300" : "from-rose-400 to-orange-300"}`}>
                      {formatEur(forecast10Y.net)}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 text-amber-400 border border-white/10">
                    <TrendingUp size={14} />
                  </div>
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
                  Historial de movimientos
                </h2>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {movementsSorted.length} elemento(s)
                </p>
              </div>
            </div>

            <ul className="divide-y divide-white/5">
              {movementsSorted.map((e) => (
                <li key={e._id} className="px-5 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-4">
                    <div className="flex-1 min-w-0">
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
                      <p className="mt-2 text-sm sm:text-base font-bold text-white">
                        {e.title}
                      </p>
                      {e.description ? (
                        <p className="mt-1 text-xs text-neutral-500">
                          {e.description}
                        </p>
                      ) : null}
                      <p className="mt-3 text-[10px] text-neutral-600 font-mono uppercase tracking-widest">
                        Fecha del primer movimiento: {new Date(e.date || e.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-row items-center justify-between sm:flex-col sm:items-end gap-4 sm:gap-3 shrink-0 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-0 border-white/5">
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
                          className="h-9 px-3 rounded-xl border border-white/10 hover:bg-white/5 text-neutral-300 transition-all font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Pencil size={12} className="mr-2" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveMovement(e);
                            setModalMode("delete");
                            setModalOpen(true);
                          }}
                          className="h-9 px-3 rounded-xl border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 text-neutral-400 transition-all font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Trash2 size={12} className="mr-2" /> Borrar
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
