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
            <div className="flex flex-col gap-6 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl animate-in slide-in-from-top duration-500">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <Input
                            placeholder="Buscar motor o categoría..."
                            className="pl-10 h-12 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/50 rounded-2xl p-1 border border-white/5 self-end lg:self-auto">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <List size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 bg-secondary/30 rounded-2xl px-3 py-2 border border-white/5">
                        <Filter size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 w-full"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos los Status</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/30 rounded-2xl px-3 py-2 border border-white/5">
                        <Filter size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 w-full"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">Todas Categorías</option>
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-secondary/30 rounded-2xl px-3 py-2 border border-white/5 sm:col-span-2 lg:col-span-1">
                        <ArrowUpDown size={14} className="text-neutral-500" />
                        <select
                            className="bg-transparent text-sm font-semibold outline-none text-neutral-300 w-full"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="default">Ordenar por</option>
                            <option value="priority">Prioridad</option>
                            <option value="roi">Mejor ROI</option>
                            <option value="difficulty">Más Fácil</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                <span>Resultados: {filteredAndSortedTasks.length}</span>
                {search && <Badge variant="neutral" className="text-[9px] lowercase">"{search}"</Badge>}
            </div>

            {/* Tasks List/Grid */}
            <section className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2" : "flex flex-col gap-4"}>
                {filteredAndSortedTasks.map((t) => (
                    <Link
                        key={t.id}
                        href={`/tareas/${t.slug}`}
                        className={`group relative flex flex-col justify-between rounded-3xl border border-white/5 bg-white/[0.02] p-5 sm:p-6 transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-primary/5 w-full min-w-0 overflow-hidden ${viewMode === 'list' ? 'lg:flex-row lg:items-center' : ''}`}
                    >
                        <div className={`min-w-0 ${viewMode === 'list' ? 'flex-1 lg:flex lg:flex-row lg:items-center gap-6' : 'flex-1'}`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-white group-hover:text-primary transition-colors truncate">
                                            {t.title}
                                        </h2>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {(t.categories || []).map(cat => (
                                                <span key={cat} className="text-[9px] font-black uppercase tracking-tight text-neutral-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
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

                            {/* Métricas de viabilidad - Compact Horizontal Layout */}
                            <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 border-white/5 ${viewMode === 'list' ? 'lg:border-l lg:pl-6' : 'mt-5 border-t pt-4'}`}>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-start">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-black tracking-tight leading-none mb-0.5">ROI</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-xs sm:text-sm font-black text-white tabular-nums">{t.viability_metrics?.roi_potential}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-start">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-black tracking-tight leading-none mb-0.5">Éxito</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(25,113,255,0.5)]" />
                                            <span className="text-xs sm:text-sm font-black text-white tabular-nums">{t.viability_metrics?.success_probability}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-start lg:items-start">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-black tracking-tight leading-none mb-0.5">Dificultad</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                            <span className="text-xs sm:text-sm font-black text-white tabular-nums">{10 - (t.viability_metrics?.implementation_ease || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`${viewMode === 'list' ? 'mt-6 lg:mt-0 lg:ml-auto lg:pl-6 lg:border-l flex-shrink-0' : 'mt-8'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-white/5 w-full lg:w-auto`}>
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
