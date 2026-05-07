"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Save, Trash2, AlertTriangle, Briefcase, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FinanceEntryCadence,
  FinanceEntryKind,
  FinanceMovement,
} from "@/store/finance-slice";
import { toast } from "sonner";
import { getTasks, type Task } from "@/lib/tasks";

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
  const [endDate, setEndDate] = useState("");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState("");

  useEffect(() => {
    setMounted(true);
    getTasks().then(setAllTasks).catch(() => { });
  }, []);

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
    if (movement.endDate) {
      setEndDate(new Date(movement.endDate).toISOString().split("T")[0]);
    } else {
      setEndDate("");
    }
    setSelectedTaskIds(movement.taskIds || []);
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 ml-1">
                    Fecha inicio
                  </label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-black/40 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-600 ml-1">
                    Fecha fin (Opcional)
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-black/40 border-white/10"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Briefcase size={12} className="text-primary/60" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Asociar a tareas</span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-600">{selectedTaskIds.length} seleccionadas</span>
                </div>

                {/* Selected Badges */}
                {selectedTaskIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 bg-black/40 border border-white/5 rounded-xl">
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
                <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden bg-black/40 focus-within:border-primary/50 transition-colors">
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
                            endDate: endDate ? new Date(endDate).toISOString() : null,
                            taskIds: selectedTaskIds,
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

