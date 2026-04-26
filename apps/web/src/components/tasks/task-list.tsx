"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Task } from "@/lib/tasks";
import {
    Search,
    Filter,
    ArrowUpDown,
    LayoutGrid,
    List,
    Rocket,
    TrendingUp,
    FlaskConical,
    Clock,
    Construction,
    CheckCircle2,
    XOctagon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskListProps {
    initialTasks: Task[];
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
            result.sort((a, b) => (a.viability_metrics?.implementation_ease || 10) - (b.viability_metrics?.implementation_ease || 10));
        }

        return result;
    }, [initialTasks, search, statusFilter, priorityFilter, sortBy, categoryFilter]);

    return (
        <div className="space-y-8">
            {/* Controls Bar */}
            <div className="flex flex-col gap-6 bg-white/[0.02] border border-white/5 p-4 sm:p-6 rounded-3xl animate-in slide-in-from-top duration-500">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <Input
                            placeholder="Buscar motor o categoría..."
                            className="pl-10 h-11 w-full bg-black/20 border-white/5"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="hidden sm:flex items-center gap-2 bg-secondary/50 rounded-2xl p-1 border border-white/5 self-end lg:self-auto">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <select
                        className="bg-black/20 text-xs font-bold uppercase tracking-widest outline-none text-neutral-400 h-10 px-4 rounded-xl border border-white/5 focus:border-primary/50 transition-colors"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">TODOS LOS STATUS</option>
                        <option value="active">ACTIVE</option>
                        <option value="paused">PAUSED</option>
                    </select>

                    <select
                        className="bg-black/20 text-xs font-bold uppercase tracking-widest outline-none text-neutral-400 h-10 px-4 rounded-xl border border-white/5 focus:border-primary/50 transition-colors"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">TODAS CATEGORÍAS</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    <select
                        className="bg-black/20 text-xs font-bold uppercase tracking-widest outline-none text-neutral-400 h-10 px-4 rounded-xl border border-white/5 focus:border-primary/50 transition-colors sm:col-span-2 lg:col-span-1"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="default">ORDENAR POR</option>
                        <option value="priority">PRIORIDAD</option>
                        <option value="roi">MEJOR ROI</option>
                        <option value="difficulty">MÁS FÁCIL</option>
                    </select>
                </div>
            </div>

            {/* Tasks Feed */}
            <section className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2" : "flex flex-col gap-4"}>
                {filteredAndSortedTasks.map((t) => (
                    <Link key={t.id} href={`/tareas/${t.slug}`} className="block group">
                        <Card variant="outline" className="relative overflow-hidden p-4 sm:p-6 hover:border-white/20 transition-all duration-500 bg-white/[0.03] border-white/12 shadow-2xl shadow-black/40">
                            {/* Card Glow Effect */}
                            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 opacity-0 group-hover:opacity-100 blur-[80px] transition-opacity duration-700 pointer-events-none" />

                            <div className={`relative flex flex-col gap-2 md:gap-6 ${viewMode === 'list' ? 'lg:flex-row lg:items-center lg:justify-between' : ''}`}>
                                {/* Main Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant={t.priority === 'critical' ? 'error' : (t.priority === 'high' ? 'warning' : 'neutral')} className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm">
                                                    {t.priority}
                                                </Badge>
                                                <div className={`flex items-center gap-1 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] ${t.status === 'Prototipo' ? 'text-purple-400' :
                                                    t.status === 'En estudio' ? 'text-blue-400' :
                                                        t.status === 'En desarrollo' ? 'text-amber-400' :
                                                            t.status === 'Activa' ? 'text-emerald-400' :
                                                                'text-neutral-500'
                                                    }`}>
                                                    {t.status === 'Prototipo' && <FlaskConical size={10} />}
                                                    {t.status === 'En estudio' && <Clock size={10} />}
                                                    {t.status === 'En desarrollo' && <Construction size={10} />}
                                                    {t.status === 'Activa' && <CheckCircle2 size={10} />}
                                                    {t.status === 'Descartada' && <XOctagon size={10} />}
                                                    {t.status}
                                                </div>
                                            </div>
                                            <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                                                {t.title}
                                            </h3>
                                            {t.business_logic?.solution && (
                                                <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-neutral-400 font-medium line-clamp-4 sm:line-clamp-3 leading-relaxed">
                                                    {t.business_logic.solution}
                                                </p>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 rounded-2xl bg-secondary/50 border border-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500 shrink-0">
                                            <Rocket size={20} />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-3 sm:mt-2">
                                        {(t.categories || []).map(cat => (
                                            <Badge key={cat} variant="neutral" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-white/5 border-white/5 transition-colors group-hover:border-white/10 group-hover:bg-white/10">
                                                {cat}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Metrics - Forced Single Line on Mobile */}
                                <div className={`grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-x-8 border-white/5 ${viewMode === 'list' ? 'lg:border-l lg:pl-8' : 'border-t pt-4'}`}>
                                    <div className="flex flex-col items-start px-2 sm:px-0">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-extrabold tracking-[0.2em] leading-none mb-1.5 whitespace-nowrap">ROI</span>
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                            <span className="text-sm sm:text-lg font-black text-white tabular-nums italic tracking-tighter">{t.viability_metrics?.roi_potential}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start px-2 sm:px-0 border-x border-white/5 sm:border-none">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-extrabold tracking-[0.2em] leading-none mb-1.5 whitespace-nowrap">Éxito</span>
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(25,113,255,0.4)]" />
                                            <span className="text-sm sm:text-lg font-black text-white tabular-nums italic tracking-tighter">{t.viability_metrics?.success_probability}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start px-2 sm:px-0">
                                        <span className="text-[7px] sm:text-[8px] uppercase text-neutral-500 font-extrabold tracking-[0.2em] leading-none mb-1.5 whitespace-nowrap">Dificultad</span>
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
                                            <span className="text-sm sm:text-lg font-black text-white tabular-nums italic tracking-tighter">{10 - (t.viability_metrics?.implementation_ease || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}

                {filteredAndSortedTasks.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01] rounded-3xl border border-dashed border-white/10 animate-in fade-in duration-500">
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
