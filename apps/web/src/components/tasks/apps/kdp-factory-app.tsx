"use client";

import { useState, useMemo, useEffect } from "react";
import {
    Cpu,
    Sparkles,
    Wand2,
    Zap,
    TrendingUp,
    Layers,
    Target,
    Globe,
    Search,
    BookOpen,
    BarChart3,
    CheckCircle2,
    AlertCircle,
    Settings,
    Plus,
    Trash2,
    DollarSign,
    Box,
    ShoppingCart,
    Palette,
    FileText,
    Image as ImageIcon,
    Shirt,
    Frame,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    BarChart,
    PieChart,
    Activity,
    Lightbulb,
    ChevronDown,
    Calendar
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ProductPlatform {
    name: string;
    earnings: number;
}

interface DigitalProduct {
    id: string;
    type: string;
    title: string;
    description: string;
    platforms: ProductPlatform[];
    totalEarnings: number;
    createdAt: string;
}

const PRODUCT_TYPES = [
    { id: "kdp-color-book", name: "KDP Color Book", icon: <BookOpen size={18} />, color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "poster-digital", name: "Poster Digital", icon: <ImageIcon size={18} />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { id: "patterns", name: "Patrones para Ropa", icon: <Shirt size={18} />, color: "text-purple-400", bg: "bg-purple-500/10" },
    { id: "printable-frames", name: "Cuadros Imprimibles", icon: <Frame size={18} />, color: "text-rose-400", bg: "bg-rose-500/10" }
];

const PLATFORMS = ["Amazon KDP", "Etsy", "Printify", "Creative Fabrica"];

type TabID = "insights" | "catalog" | "creation";
type PeriodID = "month" | "6months" | "year" | "all";

export function KdpFactoryApp() {
    const [activeTab, setActiveTab] = useState<TabID>("insights");
    const [chartPeriod, setChartPeriod] = useState<PeriodID>("month");

    // State for mock chart data
    const [chartData, setChartData] = useState<number[]>([]);

    useEffect(() => {
        // Generate mock data based on period
        let dataLength = 14;
        if (chartPeriod === "6months") dataLength = 24;
        if (chartPeriod === "year") dataLength = 12;
        if (chartPeriod === "all") dataLength = 20;

        const newData = Array.from({ length: dataLength }, () => Math.floor(Math.random() * 150) + 20);
        setChartData(newData);
    }, [chartPeriod]);

    const [products, setProducts] = useState<DigitalProduct[]>([
        {
            id: "prod_001",
            type: "KDP Color Book",
            title: "Ocean Wonders: Extreme Mandala",
            description: "Libro de colorear premium con 50 diseños de mandalas marinos.",
            platforms: [
                { name: "Amazon KDP", earnings: 450.20 },
                { name: "Etsy", earnings: 120.50 }
            ],
            totalEarnings: 570.70,
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: "prod_002",
            type: "Poster Digital",
            title: "Cyberpunk Cityscape Vol.1",
            description: "Poster digital en alta resolución para decoración gamer.",
            platforms: [
                { name: "Etsy", earnings: 230.15 },
                { name: "Creative Fabrica", earnings: 45.00 }
            ],
            totalEarnings: 275.15,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: "prod_003",
            type: "Patrones para Ropa",
            title: "Boho Floral Textile Set",
            description: "Colección de patrones repetibles para impresión en tela.",
            platforms: [
                { name: "Printify", earnings: 890.00 },
                { name: "Etsy", earnings: 140.00 }
            ],
            totalEarnings: 1030.00,
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
    ]);

    const [selectedType, setSelectedType] = useState(PRODUCT_TYPES[0].id);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [catalogFilter, setCatalogFilter] = useState("all");

    const stats = useMemo(() => {
        const total = products.reduce((acc, p) => acc + p.totalEarnings, 0);
        const count = products.length;
        const avg = count > 0 ? total / count : 0;
        return { total, count, avg };
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (catalogFilter === "all") return products;
        const typeName = PRODUCT_TYPES.find(t => t.id === catalogFilter)?.name;
        return products.filter(p => p.type === typeName);
    }, [products, catalogFilter]);

    const handleAddProduct = () => {
        if (!newTitle.trim()) {
            toast.error("El título es obligatorio");
            return;
        }

        const typeInfo = PRODUCT_TYPES.find(t => t.id === selectedType);

        const mockPlatforms = PLATFORMS.slice(0, Math.floor(Math.random() * 3) + 1).map(name => ({
            name,
            earnings: Math.floor(Math.random() * 100) + 20
        }));
        const totalEarnings = mockPlatforms.reduce((acc, p) => acc + p.earnings, 0);

        const newProduct: DigitalProduct = {
            id: `prod_${Date.now()}`,
            type: typeInfo ? typeInfo.name : "Digital Asset",
            title: newTitle.trim(),
            description: newDesc.trim() || "Generated by KDP Factory AI Engine",
            platforms: mockPlatforms,
            totalEarnings,
            createdAt: new Date().toISOString()
        };

        setProducts([newProduct, ...products]);
        setNewTitle("");
        setNewDesc("");
        toast.success("Producto creado. ¡Revísalo en el catálogo!");
        setActiveTab("catalog");
    };

    const handleDeleteProduct = (id: string) => {
        setProducts(products.filter(p => p.id !== id));
        toast.success("Producto eliminado");
    };

    const renderInsights = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-indigo-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-500/10 blur-2xl rounded-full transition-all group-hover:scale-150" />
                    <div className="flex items-center justify-between relative">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Ganancias Totales</span>
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 relative">
                        <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">
                            {stats.total.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                            <ArrowUpRight size={12} />
                            <span>+12.5% vs mes anterior</span>
                        </div>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-blue-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Promedio / Asset</span>
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                            <BarChart size={16} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-3xl font-black italic tracking-tighter text-white tabular-nums">
                            {stats.avg.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                        </p>
                        <div className="text-[10px] font-bold text-blue-400 italic">Rendimiento Saludable</div>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Market Reach</span>
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Globe size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 text-3xl font-black italic tracking-tighter text-white">
                        4/4 <span className="text-xs uppercase text-neutral-500 tracking-widest not-italic ml-2">Platforms</span>
                    </div>
                </Card>

                <Card variant="outline" className="p-6 bg-white/[0.02] border-white/5 flex flex-col gap-3 hover:border-purple-500/30 transition-all duration-500 group relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Top Nicho</span>
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                            <Activity size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 text-xl font-black italic tracking-tighter text-white flex flex-col">
                        <span>Mandala Art</span>
                        <span className="text-[11px] uppercase font-black text-purple-400 tracking-widest">+45% Demand</span>
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card variant="glass" className="lg:col-span-2 p-8 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white italic tracking-widest uppercase flex items-center gap-2">
                                <Activity size={14} className="text-indigo-400" />
                                Evolución de Tendencias
                            </h3>
                            <p className="text-[10px] text-neutral-500 font-medium tracking-tight">Análisis predictivo basado en volumen de ventas</p>
                        </div>

                        {/* Period Filter Dropdown */}
                        <div className="relative inline-block w-full md:w-48">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                                <Calendar size={12} />
                            </div>
                            <select
                                value={chartPeriod}
                                onChange={(e) => setChartPeriod(e.target.value as PeriodID)}
                                className="w-full h-10 bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-white/[0.08] transition-all"
                            >
                                <option value="month" className="bg-[#0a0a0a]">Último Mes</option>
                                <option value="6months" className="bg-[#0a0a0a]">Últimos 6 Meses</option>
                                <option value="year" className="bg-[#0a0a0a]">Último Año</option>
                                <option value="all" className="bg-[#0a0a0a]">Histórico Total</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>

                    {/* Mock Chart Area with Dynamic Data */}
                    <div className="h-[250px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-14 mt-4">
                        {chartData.map((height, i) => (
                            <div key={i} className="flex-1 group relative h-full flex items-end">
                                <div
                                    className="w-full bg-gradient-to-t from-indigo-500/10 via-indigo-500/30 to-indigo-500/50 rounded-t-sm sm:rounded-t-lg group-hover:from-indigo-500/30 group-hover:to-indigo-400 transition-all duration-700 relative overflow-hidden"
                                    style={{ height: `${height}%` }}
                                >
                                    <div className="absolute inset-x-0 top-0 h-0.5 bg-white/40 blur-[1px]" />
                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                </div>
                                {/* Tooltip */}
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-[10px] font-black text-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none shadow-2xl z-20">
                                    {height}€
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between px-2 text-[10px] font-black text-neutral-600 uppercase tracking-widest pt-3 border-t border-white/5">
                        {chartPeriod === "month" && (
                            <>
                                <span>Semana 1</span>
                                <span>Semana 2</span>
                                <span>Semana 3</span>
                                <span>Semana 4</span>
                            </>
                        )}
                        {chartPeriod === "6months" && (
                            <>
                                <span>Mes 1</span>
                                <span>Mes 3</span>
                                <span>Mes 6</span>
                            </>
                        )}
                        {chartPeriod === "year" && (
                            <>
                                <span>Trimestre 1</span>
                                <span>Trimestre 2</span>
                                <span>Trimestre 3</span>
                                <span>Trimestre 4</span>
                            </>
                        )}
                        {chartPeriod === "all" && (
                            <>
                                <span>2024</span>
                                <span>2025</span>
                                <span>2026</span>
                            </>
                        )}
                    </div>
                </Card>

                <Card variant="glass" className="p-8 border-white/5 bg-white/[0.01] space-y-8 flex flex-col justify-between relative overflow-hidden">
                    <div className="space-y-6 relative">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white italic tracking-widest uppercase">Platform Split</h3>
                            <p className="text-[10px] text-neutral-500 font-medium tracking-tight">Distribución por canales de venta</p>
                        </div>

                        <div className="space-y-5">
                            {[
                                { name: "Amazon KDP", percent: 65, color: "bg-orange-500" },
                                { name: "Etsy", percent: 25, color: "bg-indigo-500" },
                                { name: "Creative Fabrica", percent: 10, color: "bg-blue-500" }
                            ].map((plat: { name: string, percent: number, color: string, earnings?: number }) => (
                                <div key={plat.name} className="space-y-2.5">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-neutral-400">{plat.name}</span>
                                        <span className="text-white italic tabular-nums">{(plat.earnings || plat.percent)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px]">
                                        <div className={`h-full ${plat.color} rounded-full flex items-center justify-end px-1`} style={{ width: `${plat.percent}%` }}>
                                            <div className="w-1 h-1 bg-white/40 rounded-full blur-[1px]" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3 relative group/alert">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/alert:opacity-100 transition-opacity duration-500" />
                        <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.05em] flex items-center gap-2">
                            <Lightbulb size={10} /> Smart Insight
                        </p>
                        <p className="text-[11px] text-neutral-400 leading-relaxed italic relative">
                            "Los posters digitales de la serie 'Cyberpunk' están rindiendo un 25% mejor en Etsy que en otras plataformas este mes."
                        </p>
                    </div>
                </Card>
            </section>
        </div>
    );

    const renderCatalog = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Catalog Filters Refined */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                <div className="flex-1 w-full md:w-auto space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Filtrar por Categoría</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-indigo-400 transition-colors">
                            <Filter size={14} />
                        </div>
                        <select
                            value={catalogFilter}
                            onChange={(e) => setCatalogFilter(e.target.value)}
                            className="w-full md:w-64 h-12 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-10 text-[10px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer hover:bg-white/[0.08] transition-all"
                        >
                            <option value="all" className="bg-[#0a0a0a]">Todos los Activos</option>
                            {PRODUCT_TYPES.map(type => (
                                <option key={type.id} value={type.id} className="bg-[#0a0a0a]">{type.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-auto space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Búsqueda rápida</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-white transition-colors" size={14} />
                        <input
                            type="text"
                            placeholder="Ej: Cyberpunk Series"
                            className="h-12 w-full md:w-72 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-[10px] font-bold text-white focus:outline-none focus:border-white/20 transition-all placeholder:text-neutral-700"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
                {filteredProducts.length === 0 ? (
                    <Card variant="outline" className="p-20 border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-6 rounded-[32px] bg-white/5 text-neutral-700">
                            <Box size={48} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-black text-white italic tracking-tighter uppercase">Sin coincidencias</p>
                            <p className="text-sm text-neutral-500 font-medium tracking-tight">Prueba con otra categoría o término de búsqueda.</p>
                        </div>
                    </Card>
                ) : (
                    filteredProducts.map((product) => (
                        <Card key={product.id} variant="glass" className="group relative p-6 border-white/5 bg-white/[0.01] hover:border-white/20 transition-all duration-300 overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-blue-500 to-cyan-500 opacity-30 group-hover:opacity-100 transition-opacity" />

                            <div className="flex flex-col md:flex-row gap-6 relative">
                                <div className="flex-1 space-y-5">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="neutral" className="bg-indigo-500/10 border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.05em] px-2.5">
                                                    {product.type}
                                                </Badge>
                                                <span className="text-[10px] font-medium text-neutral-700 font-mono">#{product.id.slice(-6)}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight">{product.title}</h3>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteProduct(product.id)}
                                            className="h-9 w-9 p-0 rounded-xl text-neutral-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>

                                    <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl font-medium tracking-tight">{product.description}</p>

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {product.platforms.map((plat) => (
                                            <div key={plat.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group/plat cursor-default">
                                                <span className="text-[10px] font-black uppercase text-neutral-600 group-hover/plat:text-neutral-400 tracking-tighter transition-colors">{plat.name}</span>
                                                <div className="w-px h-2.5 bg-white/10" />
                                                <span className="text-[11px] font-black italic tracking-tighter text-emerald-400 tabular-nums">
                                                    {plat.earnings.toFixed(2)}€
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex md:flex-col justify-between items-end md:items-end gap-4 md:gap-6 md:w-48 md:border-l border-white/5 md:pl-8 pt-5 md:pt-0 border-t md:border-t-0">
                                    <div className="text-right space-y-0.5">
                                        <span className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-600 block">Total Profit</span>
                                        <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-white tabular-nums">{product.totalEarnings.toFixed(2)}€</span>
                                    </div>
                                    <Button variant="outline" className="h-9 md:h-10 px-4 md:w-full rounded-xl border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-xl shadow-white/5">
                                        Informe
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );

    const renderCreation = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-12">
                <Card variant="glass" className="p-6 md:p-14 border-primary/20 bg-primary/5 space-y-10 shadow-[0_0_100px_rgba(25,113,255,0.08)] relative overflow-hidden rounded-[24px] md:rounded-[48px]">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start relative z-10">
                        <div className="space-y-10 order-2 md:order-1">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-[20px] bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                                        <Wand2 size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">Generador Maestro</h2>
                                        <p className="text-[11px] font-black tracking-widest text-primary uppercase mt-1 italic">Industrial Quality Engine v2.0</p>
                                    </div>
                                </div>
                                <p className="text-sm text-neutral-400 font-medium leading-relaxed max-w-sm">
                                    Nuestro motor de IA generará automáticamente el esquema, los metadatos y la estrategia de lanzamiento para tu activo.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-5">
                                {[
                                    { step: "01", text: "Definición del Nicho Maestro", done: true, desc: "Segmentación algorítmica de audiencia." },
                                    { step: "02", text: "Título Estratégico SEO", done: newTitle.length > 5, desc: "Keywords de alta conversión integradas." },
                                    { step: "03", text: "Carga de Parámetros I.A.", done: newDesc.length > 10, desc: "Configuración del motor de generación." }
                                ].map((s) => (
                                    <div key={s.step} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-xs font-black ${s.done ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-neutral-600 border border-white/5"}`}>
                                            {s.done ? <CheckCircle2 size={18} /> : s.step}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className={`text-xs font-black uppercase tracking-tight ${s.done ? "text-neutral-200" : "text-neutral-600"}`}>{s.text}</p>
                                            <p className="text-[10px] text-neutral-600 font-medium italic">{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 rounded-[32px] bg-indigo-500/10 border border-indigo-500/20 flex gap-5 relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 blur-2xl group-hover:bg-indigo-400/20 transition-all" />
                                <div className="p-4 rounded-2xl bg-indigo-500/20 text-indigo-400 h-fit">
                                    <Lightbulb size={24} />
                                </div>
                                <div className="space-y-1.5 relative">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Smart Context Tip</p>
                                    <p className="text-xs text-neutral-400 leading-relaxed italic font-medium">
                                        "Los mercados europeos (DE/FR/ES) muestran una saturación baja en la categoría 'Cuadros Imprimibles'. Ideal para lanzamientos flash."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 p-6 md:p-10 rounded-[32px] md:rounded-[48px] bg-white/[0.04] border border-white/10 shadow-3xl backdrop-blur-3xl relative order-1 md:order-2 overflow-hidden">
                            <div className="absolute -inset-1 bg-gradient-to-br from-primary/10 via-transparent to-indigo-500/10 blur-xl opacity-30" />
                            <div className="space-y-8 relative">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1">Tipo de Activo Digital</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {PRODUCT_TYPES.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => setSelectedType(type.id)}
                                                className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 ${selectedType === type.id
                                                    ? "bg-white/10 border-white/20 shadow-xl scale-[1.02] ring-1 ring-primary/30"
                                                    : "bg-white/[0.02] border-white/5 opacity-50 hover:opacity-100 hover:bg-white/[0.05]"
                                                    }`}
                                            >
                                                <div className={`p-3 rounded-xl ${type.bg} ${type.color} shadow-inner`}>
                                                    {type.icon}
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-[0.05em] text-left leading-none">{type.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1 block mb-1">Proyecto Master Title</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="Ej: Minimalist Japanese Art Set"
                                        className="w-full h-12 md:h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-medium"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black uppercase tracking-[0.05em] text-neutral-500 ml-1 block mb-1">Descripción de Lanzamiento</label>
                                    <textarea
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        placeholder="Define el concepto central y el nicho demográfico..."
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all resize-none font-medium leading-relaxed"
                                    />
                                </div>

                                <Button
                                    onClick={handleAddProduct}
                                    className="w-full h-16 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_15px_40px_rgba(255,255,255,0.15)]"
                                >
                                    <Sparkles size={18} className="mr-3" /> Lanzar Generación Maestro
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Sub-Navigation Tabs - Floating Style */}
            <div className="sticky top-[90px] z-[50] w-full flex justify-center pointer-events-none px-4">
                <div className="pointer-events-auto flex p-1.5 bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-full overflow-x-auto no-scrollbar">
                    {[
                        { id: "insights", name: "Insights", icon: <BarChart3 size={15} /> },
                        { id: "catalog", name: "Catálogo", icon: <Box size={15} /> },
                        { id: "creation", name: "Creación", icon: <Plus size={15} /> }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabID)}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 whitespace-nowrap min-w-[130px] justify-center ${activeTab === tab.id
                                ? "bg-white text-black shadow-lg scale-[1.05] z-10"
                                : "text-neutral-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area Rendering Based on Active Tab */}
            <div className="relative pt-6">
                {activeTab === "insights" && renderInsights()}
                {activeTab === "catalog" && renderCatalog()}
                {activeTab === "creation" && renderCreation()}
            </div>
        </div>
    );
}
