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

function effectiveMonthlyAmount(m: FinanceMovement): number {
  // Annualized view: mensual = 12x anual (user requirement), puntual treated like anual.
  if (m.cadence === "mensual") return m.amount * 12;
  return m.amount;
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

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const m of movements) {
      const amt = effectiveMonthlyAmount(m);
      if (m.kind === "ingreso") income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
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
            anualizado
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

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 flex items-center justify-center">
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
                className={`text-xl font-black italic tracking-tighter tabular-nums bg-clip-text text-transparent ${
                  totals.net >= 0
                    ? "bg-gradient-to-br from-emerald-400 to-teal-300"
                    : "bg-gradient-to-br from-rose-400 to-orange-300"
                }`}
              >
                {formatEur(totals.net)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ingresos</p>
            <ArrowUpRight size={16} className="text-emerald-400" />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
            <p className="text-2xl font-black italic tracking-tighter tabular-nums bg-gradient-to-br from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {formatEur(totals.income)}
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Gastos</p>
            <ArrowDownRight size={16} className="text-rose-400" />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
            <p className="text-2xl font-black italic tracking-tighter tabular-nums bg-gradient-to-br from-rose-400 to-orange-300 bg-clip-text text-transparent">
              {formatEur(totals.expense)}
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Movimientos</p>
          <p className="mt-2 text-xl font-black italic tracking-tighter text-white tabular-nums">
            {movements.length}
          </p>
        </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
          Composición (anualizada)
        </p>

        <div className="mt-4 grid gap-3">
          <div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500">
              <span>Ingresos</span>
              <span className="text-emerald-400">{formatEur(totals.income)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500">
              <span>Gastos</span>
              <span className="text-rose-400">{formatEur(totals.expense)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
