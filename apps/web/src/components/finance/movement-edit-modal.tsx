"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Save, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FinanceEntryCadence,
  FinanceEntryKind,
  FinanceMovement,
} from "@/store/finance-slice";
import { toast } from "sonner";

type Props = {
  open: boolean;
  mode: "edit" | "delete";
  movement: FinanceMovement | null;
  apiUrl: string;
  onClose: () => void;
  onUpdated: (movement: FinanceMovement) => void;
  onDeleted: (id: string) => void;
};

export function MovementEditModal({
  open,
  mode,
  movement,
  apiUrl,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [kind, setKind] = useState<FinanceEntryKind>("ingreso");
  const [cadence, setCadence] = useState<FinanceEntryCadence>("mensual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!movement) return;
    setKind(movement.kind);
    setCadence(movement.cadence);
    setTitle(movement.title);
    setDescription(movement.description ?? "");
    setAmount(String(movement.amount));
    if (movement.date) {
      setDate(new Date(movement.date).toISOString().split("T")[0]);
    } else if (movement.createdAt) {
      setDate(new Date(movement.createdAt).toISOString().split("T")[0]);
    }
  }, [movement]);

  const show = open && mounted && movement;

  const header = useMemo(() => {
    if (mode === "delete") return "¿Borrar movimiento?";
    return "Editar movimiento";
  }, [mode]);

  if (!show) return null;

  const body = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-black border border-white/10 rounded-[32px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300 my-auto">
        <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none" />
        <div className="relative p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight italic text-white">
                {header}
              </h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-mono">
                {movement._id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {mode === "delete" ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-5">
                <div className="mt-0.5 w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{movement.title}</p>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    Esta acción es irreversible.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 h-12 rounded-2xl border border-white/10 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={async () => {
                    if (isSaving) return;
                    setIsSaving(true);
                    try {
                      const res = await fetch(
                        `${apiUrl}/finance/movements/${movement._id}`,
                        { method: "DELETE" }
                      );
                      if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        toast.error(text ? `No se pudo borrar: ${text}` : "No se pudo borrar");
                        return;
                      }
                      onDeleted(movement._id);
                      toast.success("Movimiento borrado");
                      onClose();
                    } catch {
                      toast.error("Error de red conectando con la API");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="flex-1 h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-[10px]"
                >
                  <Trash2 size={14} className="mr-2" />
                  Borrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
                    onChange={(e) => setCadence(e.target.value as FinanceEntryCadence)}
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
                className="bg-black/40 border-white/10"
              />
              <Input
                label="Descripción"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-black/40 border-white/10"
              />
              <Input
                label="Importe (€)"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-black/40 border-white/10"
              />

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 ml-1">
                  Fecha del primer movimiento
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-black/40 border-white/10"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 h-12 rounded-2xl border border-white/10 font-black uppercase tracking-widest text-[10px] text-neutral-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  variant="secondary"
                  isLoading={isSaving}
                  disabled={isSaving || title.trim().length === 0 || amount.trim().length === 0}
                  onClick={async () => {
                    const normalizedTitle = title.trim();
                    const normalizedDescription = description.trim();
                    const parsedAmount = Number(amount.replace(",", "."));
                    if (!normalizedTitle) return toast.error("Añade un título");
                    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
                      return toast.error("Importe inválido");

                    setIsSaving(true);
                    try {
                      const res = await fetch(
                        `${apiUrl}/finance/movements/${movement._id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            kind,
                            cadence,
                            title: normalizedTitle,
                            description: normalizedDescription,
                            amount: parsedAmount,
                            date: new Date(date).toISOString(),
                          }),
                        }
                      );
                      if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        toast.error(text ? `No se pudo guardar: ${text}` : "No se pudo guardar");
                        return;
                      }
                      const json = (await res.json()) as { movement: FinanceMovement };
                      if (json.movement) onUpdated(json.movement);
                      toast.success("Movimiento actualizado");
                      onClose();
                    } catch {
                      toast.error("Error de red conectando con la API");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                >
                  <Save size={14} className="mr-2" />
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

