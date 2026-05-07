"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createApiSocket } from "@/lib/socket";
import type { FinanceMovement } from "@/store/finance-slice";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";

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

export function FinanceSummaryClient() {
  const apiUrl = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""),
    []
  );
  const [movements, setMovements] = useState<FinanceMovement[]>([]);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`${apiUrl}/finance/movements?limit=200`, { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as { movements: FinanceMovement[] };
      setMovements(json.movements ?? []);
    };
    void run();
  }, [apiUrl]);

  useEffect(() => {
    const socket = createApiSocket(apiUrl);
    socket.on("finance:movement_created", ({ movement }) =>
      setMovements((prev) => [movement, ...prev.filter((m) => m._id !== movement._id)])
    );
    socket.on("finance:movement_updated", ({ movement }) =>
      setMovements((prev) => prev.map((m) => (m._id === movement._id ? movement : m)))
    );
    socket.on("finance:movement_deleted", ({ id }) =>
      setMovements((prev) => prev.filter((m) => m._id !== id))
    );
    return () => {
      socket.disconnect();
    };
  }, [apiUrl]);

  const forecast1Y = useMemo(() => calculateForecast(movements, 1), [movements]);

  const totals = useMemo(() => {
    return forecast1Y; // Use the 1-year lifetime forecast as the main total for the dashboard
  }, [forecast1Y]);

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

  const compare = useMemo(() => {
    return {
      total: Math.max(1, totals.income + totals.expense),
      income: totals.income,
      expense: totals.expense,
    };
  }, [totals.expense, totals.income]);

  const ring = useMemo(() => {
    const r = 34;
    const c = 2 * Math.PI * r;
    const incomeRatio = compare.income / compare.total;
    const expenseRatio = compare.expense / compare.total;
    return {
      c,
      incomeDash: `${c * incomeRatio} ${c}`,
      expenseDash: `${c * expenseRatio} ${c}`,
      expenseOffset: c * incomeRatio,
      incomeRatio,
    };
  }, [compare.income, compare.total, compare.expense]);

  return (
    <Card variant="glass" className="p-6 border-white/5 bg-white/[0.01]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp size={16} />
          <h3 className="text-sm font-bold">Finanzas</h3>
          <Badge variant="neutral" className="bg-white/5 border-white/10 text-[8px] font-black uppercase tracking-widest">
            Proyección 1 Año
          </Badge>
        </div>
        <Badge
          variant="neutral"
          className={
            totals.net >= 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }
        >
          neto {formatEur(totals.net)}
        </Badge>
      </div>

      <div className="mt-5 flex flex-col md:flex-row gap-6">
        <div className="flex-1 lg:flex-none lg:w-[220px] rounded-3xl border border-white/5 bg-white/[0.02] p-5 flex items-center justify-center">
          <div className="relative w-[140px] h-[140px]">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="34" className="fill-none stroke-white/5 stroke-[10]" />
              <circle
                cx="50"
                cy="50"
                r="34"
                className="fill-none stroke-emerald-500/60 stroke-[10]"
                strokeLinecap="round"
                strokeDasharray={ring.incomeDash}
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="34"
                className="fill-none stroke-rose-500/60 stroke-[10]"
                strokeLinecap="round"
                strokeDasharray={ring.expenseDash}
                strokeDashoffset={-ring.expenseOffset}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                neto
              </span>
              <span
                className={`text-xl font-black italic tracking-tighter tabular-nums bg-clip-text text-transparent ${totals.net >= 0
                  ? "bg-gradient-to-br from-emerald-400 to-teal-300"
                  : "bg-gradient-to-br from-rose-400 to-orange-300"
                  }`}
              >
                {formatEur(totals.net)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-emerald-500/20 transition-all duration-500">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />
            <div className="relative space-y-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 w-fit text-white shadow-lg shadow-black/20">
                <ArrowUpRight size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Ingresos</p>
                <p className="text-2xl font-black tracking-tighter bg-gradient-to-br from-emerald-400 to-teal-300 bg-clip-text text-transparent italic tabular-nums mt-1">
                  {formatEur(totals.income)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-rose-500/20 transition-all duration-500">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-400 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />
            <div className="relative space-y-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 w-fit text-white shadow-lg shadow-black/20">
                <ArrowDownRight size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Gastos</p>
                <p className="text-2xl font-black tracking-tighter bg-gradient-to-br from-rose-400 to-orange-300 bg-clip-text text-transparent italic tabular-nums mt-1">
                  {formatEur(totals.expense)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative group overflow-hidden p-5 rounded-3xl border border-white/5 bg-white/[0.02] hover:border-primary/20 transition-all duration-500">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-primary to-blue-400 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500" />
            <div className="relative space-y-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-blue-400 w-fit text-white shadow-lg shadow-black/20">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Movimientos</p>
                <p className="text-2xl font-black tracking-tighter bg-gradient-to-br from-primary to-blue-300 bg-clip-text text-transparent italic tabular-nums mt-1">
                  {movements.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-5 border-t border-white/5">
        <div className="relative group overflow-hidden rounded-2xl bg-white/[0.02] border border-white/5 p-4 transition-all duration-500 hover:bg-white/[0.04]">
          <div className={`absolute -left-10 -top-10 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-br ${trend.status === 'pos' ? 'from-emerald-500 to-teal-400' : trend.status === 'neg' ? 'from-rose-500 to-orange-400' : 'from-primary to-blue-400'}`} />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border ${trend.status === 'pos' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : trend.status === 'neg' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">Perspectiva de Capital</p>
                <p className="text-xs font-bold text-white mt-0.5 tracking-tight">{trend.label}</p>
              </div>
            </div>
            <Badge variant="neutral" className={`bg-white/5 border-white/10 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 ${trend.status === 'pos' ? 'text-emerald-400' : trend.status === 'neg' ? 'text-rose-400' : 'text-primary'}`}>
              {trend.status === 'pos' || trend.status === 'recup' ? 'Saludable' : 'Riesgo'}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
