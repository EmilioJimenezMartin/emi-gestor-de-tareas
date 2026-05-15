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
  Briefcase,
  Search,
  X,
  Activity,
  History,
  BarChart3,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { MovementEditModal } from "@/components/finance/movement-edit-modal";
import { getTasks, type Task } from "@/lib/tasks";

function formatEur(v: number) {
  return `${v.toFixed(2)}€`;
}

// Cumulative balance at a given date: counts actual occurrences from each movement's start to atDate.
// puntual = 1 occurrence; mensual = elapsed months; anual = elapsed years.
function cumulativeBalance(movements: FinanceMovement[], atDate: Date) {
  let income = 0;
  let expense = 0;
  for (const m of movements) {
    const start = new Date(m.date || m.createdAt);
    if (start > atDate) continue;
    const rawEnd = m.endDate ? new Date(m.endDate) : null;
    const mEnd = rawEnd && rawEnd.getFullYear() > 2000 ? rawEnd : null;
    const limit = mEnd && mEnd < atDate ? mEnd : atDate;
    let occurrences = 0;
    if (m.cadence === "puntual") {
      occurrences = 1;
    } else if (m.cadence === "mensual") {
      const months = (limit.getFullYear() - start.getFullYear()) * 12 + (limit.getMonth() - start.getMonth()) + 1;
      occurrences = Math.max(0, months);
    } else if (m.cadence === "anual") {
      const years = limit.getFullYear() - start.getFullYear() + 1;
      occurrences = Math.max(0, years);
    }
    const total = occurrences * m.amount;
    if (m.kind === "ingreso") income += total;
    else expense += total;
  }
  return { income, expense, net: income - expense };
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
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getTasks().then(setAllTasks).catch(() => { });
  }, []);
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

  // Balance acumulado a día de hoy: ingresos y gastos reales desde su fecha de inicio
  const totals = useMemo(() => cumulativeBalance(movements, new Date()), [movements]);

  // Proyecciones: balance acumulado en esa fecha futura
  const forecast1Y = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    return cumulativeBalance(movements, d);
  }, [movements]);

  const forecast10Y = useMemo(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 10);
    return cumulativeBalance(movements, d);
  }, [movements]);

  // Tendencia: proyecta el balance acumulado mes a mes para detectar inversión de signo
  const trend = useMemo(() => {
    const now = new Date();
    const currentBalance = cumulativeBalance(movements, now).net;

    if (currentBalance >= 0) {
      for (let i = 1; i <= 120; i++) {
        const future = new Date(now);
        future.setMonth(now.getMonth() + i);
        if (cumulativeBalance(movements, future).net < 0) {
          return { status: "deplet", label: `Balance negativo en ${future.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}` };
        }
      }
      return { status: "pos", label: "Tendencia positiva estable" };
    } else {
      for (let i = 1; i <= 120; i++) {
        const future = new Date(now);
        future.setMonth(now.getMonth() + i);
        if (cumulativeBalance(movements, future).net >= 0) {
          return { status: "recup", label: `Balance positivo en ${future.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}` };
        }
      }
      return { status: "neg", label: "Tendencia negativa estable" };
    }
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
          taskIds: selectedTaskIds,
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
          <TrendingUp size={24} className="sm:size-6" strokeWidth={2.5} />
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
          className="lg:col-span-5 lg:sticky lg:top-8 h-fit border-white/5 bg-white/[0.02] p-5 sm:p-6 group overflow-hidden relative"
        >
          {/* Reactive Shiny Gradient */}
          <div className={`absolute -right-10 -top-10 w-40 h-40 blur-3xl transition-all duration-1000 opacity-20 ${kind === 'ingreso' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-br border shadow-lg shadow-black/20 transition-all duration-500 ${kind === 'ingreso' ? 'from-emerald-500/20 to-teal-600/20 text-emerald-400 border-emerald-500/20' : 'from-rose-500/20 to-orange-600/20 text-rose-400 border-rose-500/20'}`}>
                <Plus size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500">
                  Nuevo movimiento
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Guardado en MongoDB (vía API).
                </p>
              </div>
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

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Briefcase size={12} className="text-primary/60" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Asociar a tareas</span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-600">{selectedTaskIds.length} seleccionadas</span>
                </div>

                {/* Selected Badges */}
                {selectedTaskIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                    {selectedTaskIds.map(id => {
                      const t = allTasks.find(task => (task as any)._id === id || task.id === id);
                      if (!t) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/20 border border-primary/50 text-white transition-all">
                          <span className="text-[10px] font-bold truncate max-w-[150px]">{t.title}</span>
                          <button onClick={() => setSelectedTaskIds(selectedTaskIds.filter(pid => pid !== id))} className="text-primary hover:text-white shrink-0 ml-1">
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Search and List */}
                <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-white/[0.02] focus-within:border-primary/50 transition-colors">
                  <div className="flex items-center px-3 border-b border-white/5 shrink-0">
                    <Search size={14} className="text-neutral-500 shrink-0" />
                    <input
                      type="text"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="Buscar tareas..."
                      className="flex-1 h-10 bg-transparent border-none text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:ring-0 px-3"
                    />
                  </div>
                  <div className="max-h-[140px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-white/5">
                    {allTasks.filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !selectedTaskIds.includes((t as any)._id || t.id)).map(t => {
                      const taskId = (t as any)._id || t.id;
                      return (
                        <button
                          key={taskId}
                          onClick={() => {
                            setSelectedTaskIds([...selectedTaskIds, taskId]);
                            setTaskSearch("");
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {t.title}
                        </button>
                      );
                    })}
                    {allTasks.filter(t => t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !selectedTaskIds.includes((t as any)._id || t.id)).length === 0 && (
                      <div className="px-3 py-4 text-center text-[10px] uppercase tracking-widest text-neutral-600">
                        {taskSearch ? "No hay coincidencias" : "Todas las tareas seleccionadas / Ninguna tarea disponible"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={submit}
                disabled={isSubmitting}
                className="w-full h-14 bg-gradient-to-br from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/10 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  "Guardando..."
                ) : (
                  <>
                    <Plus size={22} strokeWidth={3} />
                    <span>Crear movimiento</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Trend Intelligence Card */}
            <div className={`relative group overflow-hidden p-6 rounded-3xl border border-white/5 bg-white/[0.02] transition-all duration-500 ${trend.status === 'pos' ? 'hover:border-emerald-500/20' : trend.status === 'neg' ? 'hover:border-rose-500/20' : 'hover:border-primary/20'}`}>
              <div className={`absolute -right-6 -top-6 w-32 h-32 blur-3xl transition-opacity duration-700 opacity-10 group-hover:opacity-30 bg-gradient-to-br ${trend.status === 'pos' ? 'from-emerald-500 to-teal-400' : trend.status === 'neg' ? 'from-rose-500 to-orange-400' : 'from-primary to-blue-400'}`} />
              <div className="relative flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl border shadow-inner transition-all duration-500 ${trend.status === 'pos' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : trend.status === 'neg' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-primary/10 text-primary border-primary/10'}`}>
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Tendencia de Capital</span>
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
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/20 blur-3xl opacity-15 group-hover:opacity-25 transition-all duration-1000" />
              <div className="relative flex flex-col items-center justify-center h-full text-center">
                <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-600/10 text-primary border border-primary/20 shadow-xl shadow-black/20">
                  <Activity size={28} strokeWidth={2.5} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">balance neto total</p>
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
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-primary to-blue-400 opacity-5 group-hover:opacity-20 blur-2xl transition-all duration-700" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Previsión 1 Año</p>
                    <p className={`text-xl font-black tracking-tighter italic tabular-nums mt-1 bg-gradient-to-br bg-clip-text text-transparent ${forecast1Y.net >= 0 ? "from-emerald-400 to-teal-300" : "from-rose-400 to-orange-300"}`}>
                      {formatEur(forecast1Y.net)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/5 text-primary border border-white/10">
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* 10 Year Forecast */}
              <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-amber-500/20 transition-all duration-500">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-400 opacity-5 group-hover:opacity-20 blur-2xl transition-all duration-700" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Previsión 10 Años</p>
                    <p className={`text-xl font-black tracking-tighter italic tabular-nums mt-1 bg-gradient-to-br bg-clip-text text-transparent ${forecast10Y.net >= 0 ? "from-amber-400 to-yellow-300" : "from-rose-400 to-orange-300"}`}>
                      {formatEur(forecast10Y.net)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/5 text-amber-400 border border-white/10">
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Card
            variant="outline"
            className="border-white/5 bg-white/[0.02] p-0 overflow-hidden group relative"
          >
            {/* Persistent Shiny Gradient */}
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-primary/10 blur-[80px] opacity-10 group-hover:opacity-20 transition-all duration-1000" />

            <div className="flex items-center justify-between px-5 sm:px-6 py-5 border-b border-white/5 relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] text-primary border border-white/10 shadow-xl shadow-black/20">
                  <BarChart3 size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.1em] text-white/90">
                    Historial de movimientos
                  </h2>
                  <p className="mt-1 text-[11px] text-neutral-500 font-medium">
                    {movementsSorted.length} elemento(s) registrados
                  </p>
                </div>
              </div>
            </div>

            <ul className="divide-y divide-white/5">
              {movementsSorted.map((e) => (
                <li key={e._id} className="group p-5 sm:p-6 hover:bg-white/[0.04] transition-all duration-500 relative overflow-hidden border-b border-white/[0.02] last:border-0 border-t-0">
                  {/* Shiny Corner Gradient - FIXED COLORS */}
                  <div className={`absolute -right-12 -top-12 w-32 h-32 blur-3xl transition-all duration-1000 opacity-10 group-hover:opacity-30 bg-gradient-to-br ${e.kind === 'ingreso' ? 'from-emerald-500 to-teal-400' : 'from-rose-500 to-orange-400'}`} />

                  <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-1.5 h-12 rounded-full shrink-0 ${e.kind === 'ingreso' ? 'bg-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white truncate">{e.title}</p>
                          {e.taskIds && e.taskIds.length > 0 && (
                            <Badge variant="neutral" className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                              <Briefcase size={8} />
                              {e.taskIds.length}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">{e.cadence} • {new Date(e.date || e.createdAt).toLocaleDateString()}</p>
                        {e.description && <p className="text-xs text-neutral-400 mt-1 truncate max-w-md">{e.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                      <span className={`text-xl font-black italic tracking-tighter tabular-nums ${e.kind === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {e.kind === 'ingreso' ? '+' : '-'}{formatEur(e.amount)}
                      </span>
                      <div className="flex items-center gap-3 relative z-20">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveMovement(e);
                            setModalMode("edit");
                            setModalOpen(true);
                          }}
                          className="h-11 w-11 p-0 rounded-2xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all border border-white/5 active:scale-90 group/btn relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none" />
                          <Pencil size={20} strokeWidth={2.5} className="relative z-10" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveMovement(e);
                            setModalMode("delete");
                            setModalOpen(true);
                          }}
                          className="h-11 w-11 p-0 rounded-2xl bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-neutral-400 transition-all border border-white/5 active:scale-90 group/btn relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-rose-500/20 blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none" />
                          <Trash2 size={20} strokeWidth={2.5} className="relative z-10" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}

              {movementsSorted.length === 0 ? (
                <li className="px-5 sm:px-6 py-10 text-center text-[10px] uppercase tracking-widest font-bold text-neutral-600">
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
