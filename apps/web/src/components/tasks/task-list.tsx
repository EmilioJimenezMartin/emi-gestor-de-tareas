"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Task } from "@/lib/tasks";
import { Search, Filter, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskListProps {
    initialTasks: Task[];
}

function badgeVariantForPriority(priority?: string) {
    switch (priority?.toLowerCase()) {
        case "critical":
            return "bg-red-500/10 text-red-400 border border-red-500/20";
        case "high":
            return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
        default:
            return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
}

export function TaskList({ initialTasks }: TaskListProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [sortBy, setSortBy] = useState("default");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const categories = useMemo(() => {
        const allCats = initialTasks.flatMap((t) => t.categories || []);
        return Array.from(new Set(allCats)).sort();
    }, [initialTasks]);

    const filteredAndSortedTasks = useMemo(() => {
        let result = initialTasks.filter((task) => {
            const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase()) ||
                (task.categories || []).some(cat => cat.toLowerCase().includes(search.toLowerCase()));
            const matchesStatus = statusFilter === "all" || task.status === statusFilter;
            const matchesCategory = categoryFilter === "all" || (task.categories || []).includes(categoryFilter);
            const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

            return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
        });

        if (sortBy === "priority") {
            const priorityMap: Record<string, number> = { critical: 3, high: 2, normal: 1 };
            result.sort((a, b) => (priorityMap[b.priority || ""] || 0) - (priorityMap[a.priority || ""] || 0));
        } else if (sortBy === "roi") {
            result.sort((a, b) => (b.viability_metrics?.roi_potential || 0) - (a.viability_metrics?.roi_potential || 0));
        } else if (sortBy === "difficulty") {
            // Implementation ease 10 is easiest, so Difficulty is 10 - ease. 
            // Higher ease = lower difficulty. 
            result.sort((a, b) => (a.viability_metrics?.implementation_ease || 10) - (b.viability_metrics?.implementation_ease || 10));
        }

        return result;
    }, [initialTasks, search, statusFilter, priorityFilter, sortBy]);

    return (
        <div className="space-y-8">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-3xl animate-in slide-in-from-top duration-500">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                    <Input
                        placeholder="Buscar motor o categoría..."
                        className="pl-10 h-11"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-secondary/50 rounded-2xl px-3 py-1.5 border border-white/5">
                        <Filter size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 pr-2"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos los Status</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/50 rounded-2xl px-3 py-1.5 border border-white/5">
                        <Filter size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 pr-2 max-w-[150px]"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">Todas Categorías</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/50 rounded-2xl px-3 py-1.5 border border-white/5">
                        <ArrowUpDown size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 pr-2"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="default">Ordenar por</option>
                            <option value="priority">Prioridad</option>
                            <option value="roi">Mejor ROI</option>
                            <option value="difficulty">Más Fácil</option>
                        </select>
                    </div>

                    <div className="flex items-center bg-secondary/50 rounded-2xl p-1 border border-white/5">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-1.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                <span>Resultados: {filteredAndSortedTasks.length}</span>
                {search && <Badge variant="neutral" className="text-[9px] lowercase">"{search}"</Badge>}
            </div>

            {/* Tasks List/Grid */}
            <section className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-2" : "flex flex-col gap-4"}>
                {filteredAndSortedTasks.map((t) => (
                    <Link
                        key={t.id}
                        href={`/tareas/${t.slug}`}
                        className={`group relative flex flex-col justify-between rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-primary/5 ${viewMode === 'list' ? 'md:flex-row md:items-center' : ''}`}
                    >
                        <div className={viewMode === 'list' ? 'flex-1 flex flex-col md:flex-row md:items-center gap-6' : ''}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-white group-hover:text-primary transition-colors truncate">
                                            {t.title}
                                        </h2>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(t.categories || []).map(cat => (
                                                <span key={cat} className="text-[9px] font-black uppercase tracking-widest text-neutral-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                    {cat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <span
                                        className={`inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-tighter ${badgeVariantForPriority(
                                            t.priority
                                        )}`}
                                    >
                                        {t.priority || "Normal"}
                                    </span>
                                </div>

                                {!(viewMode === 'list') && (
                                    <p className="mt-4 text-sm leading-relaxed text-neutral-400 line-clamp-2">
                                        {t.description}
                                    </p>
                                )}
                            </div>

                            {/* Métricas de viabilidad */}
                            <div className={`flex gap-6 border-white/5 ${viewMode === 'list' ? 'md:border-l md:pl-6' : 'mt-5 border-t pt-4'}`}>
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-neutral-500 font-bold tracking-tighter">ROI</span>
                                    <span className="text-sm font-bold text-emerald-400">{t.viability_metrics?.roi_potential}/10</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-neutral-500 font-bold tracking-tighter">Éxito</span>
                                    <span className="text-sm font-bold text-primary">{t.viability_metrics?.success_probability}/10</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-neutral-500 font-bold tracking-tighter">Diff.</span>
                                    <span className="text-sm font-bold text-neutral-300">{10 - (t.viability_metrics?.implementation_ease || 0)}/10</span>
                                </div>
                            </div>
                        </div>

                        <div className={`${viewMode === 'list' ? 'md:ml-auto md:pl-6 md:border-l' : 'mt-8'} flex items-center justify-between border-white/5`}>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 border border-white/5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-neutral-500">LIVE</span>
                                </div>

                                <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 border border-white/5">
                                    <span className="text-neutral-500">STACK:</span>
                                    <span className="text-primary font-bold">
                                        {t.technical_stack?.framework || 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {filteredAndSortedTasks.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-neutral-500">
                            <Search size={32} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">No se encontraron motores</h3>
                            <p className="text-sm text-neutral-500">Prueba ajustando los filtros o la búsqueda.</p>
                        </div>
                        <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setPriorityFilter("all"); setSortBy("default"); }}>
                            Limpiar filtros
                        </Button>
                    </div>
                )}
            </section>
        </div>
    );
}
