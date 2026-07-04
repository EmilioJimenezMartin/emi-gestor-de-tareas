"use client";

import { useState } from "react";
import { Search, TrendingUp, Tag, BookOpen, Star, ChevronDown, ChevronUp, Link2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface CompetitorBook {
    rank: number;
    title: string;
    subtitle: string;
    asin: string;
    reviews: number;
    rating: number;
    price: string;
    bsr: number | null;
    categories: string[];
    bullets: string[];
    bestseller: boolean;
}

interface KeywordFrequency {
    word: string;
    count: number;
    pct: number;
}

interface CompetitorSEOIntelligence {
    keyword: string;
    totalFound: number;
    topBooks: CompetitorBook[];
    topKeywords: KeywordFrequency[];
    audienceTerms: string[];
    benefitTerms: string[];
    titlePatterns: string[];
    subtitlePatterns: string[];
    categories: string[];
    avgReviews: number;
    priceRange: { min: string; max: string };
    scrapedAt: string;
}

interface SimpleNiche {
    _id: string;
    name: string;
    nickname?: string;
    productType?: string;
    competitorIntel?: Record<string, unknown>;
}

interface Props {
    defaultKeyword?: string;
    defaultProductType?: string;
    niches?: SimpleNiche[];
    onApplyKeywords?: (keywords: string[]) => void;
    onAnalysisComplete?: (data: CompetitorSEOIntelligence) => void;
}

export function CompetitorSEOPanel({ defaultKeyword = "", defaultProductType = "coloring-book", niches = [], onApplyKeywords, onAnalysisComplete }: Props) {
    const [keyword, setKeyword] = useState(defaultKeyword);
    const [productType, setProductType] = useState(defaultProductType);
    const [linkedNicheId, setLinkedNicheId] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CompetitorSEOIntelligence | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedBook, setExpandedBook] = useState<number | null>(null);
    const [activeSection, setActiveSection] = useState<"keywords" | "books" | "categories">("keywords");

    const saveToNiche = async (nicheId: string, intel: CompetitorSEOIntelligence) => {
        await fetch(`${API}/niches/${nicheId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competitorIntel: intel }),
        }).catch(() => {});
    };

    const analyze = async () => {
        if (!keyword.trim()) return;
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const r = await fetch(`${API}/niches/competitor-seo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: keyword.trim(), productType }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? "Error analizando");
            setData(d);
            onAnalysisComplete?.(d);
            if (linkedNicheId) void saveToNiche(linkedNicheId, d);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Search bar */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 space-y-3">
                <p className="text-sm font-bold text-white">Analizar competidores en Amazon</p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                    Introduce el nicho o keyword que quieres analizar. El sistema scrapeará los top 20 resultados en Amazon y extraerá títulos, subtítulos, keywords que más se repiten, categorías, precio medio, reviews y bullet points de los mejores libros.
                </p>
                {niches.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Link2 size={13} className="text-zinc-500 flex-shrink-0" />
                        <select
                            value={linkedNicheId}
                            onChange={e => {
                                const id = e.target.value;
                                setLinkedNicheId(id);
                                if (id) {
                                    const n = niches.find(n => n._id === id);
                                    if (n) {
                                        setKeyword(n.nickname?.trim() || n.name);
                                        if (n.competitorIntel) {
                                            const saved = n.competitorIntel as unknown as CompetitorSEOIntelligence;
                                            setData(saved);
                                            onAnalysisComplete?.(saved);
                                        } else {
                                            setData(null);
                                        }
                                    }
                                } else {
                                    setData(null);
                                }
                            }}
                            className="flex-1 h-9 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none"
                        >
                            <option value="">Vincular nicho (opcional)</option>
                            {niches.map(n => (
                                <option key={n._id} value={n._id}>{n.nickname?.trim() || n.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => { setKeyword(e.target.value); setLinkedNicheId(""); }}
                            onKeyDown={e => e.key === "Enter" && void analyze()}
                            placeholder="ej: mandala coloring book adults"
                            className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
                        />
                        {linkedNicheId && <p className="text-xs text-zinc-600 px-1">Edita la keyword en inglés antes de analizar</p>}
                    </div>
                    <select
                        value={productType}
                        onChange={e => setProductType(e.target.value)}
                        className="h-10 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-300 outline-none"
                    >
                        <option value="coloring-book">Coloring Book</option>
                        <option value="printable-poster">Printable Poster</option>
                        <option value="seamless-pattern">Seamless Pattern</option>
                    </select>
                    <button
                        onClick={() => void analyze()}
                        disabled={loading || !keyword.trim()}
                        className="h-10 px-4 rounded-xl bg-violet-600/80 hover:bg-violet-500 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-40"
                    >
                        <Search size={14} />
                        {loading ? "Analizando..." : "Analizar"}
                    </button>
                </div>
                {loading && (
                    <div className="space-y-1.5">
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                        </div>
                        <p className="text-xs text-zinc-500">Scrapeando Amazon + visitando páginas de producto... (~15s)</p>
                    </div>
                )}
                {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 border border-red-400/20">{error}</p>}
            </div>

            {data && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {data.scrapedAt && (
                        <p className="text-xs text-zinc-600 px-1">
                            Análisis guardado · {new Date(data.scrapedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                            {linkedNicheId && <span className="text-zinc-700"> · Re-analiza para actualizar</span>}
                        </p>
                    )}
                    {/* Summary stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: "Libros analizados", value: data.totalFound.toString() },
                            { label: "Reviews medias", value: data.avgReviews.toLocaleString() },
                            { label: "Rango de precio", value: data.priceRange.min && data.priceRange.max ? `${data.priceRange.min}–${data.priceRange.max}` : "—" },
                            { label: "Keywords clave", value: data.topKeywords.length.toString() },
                        ].map(s => (
                            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
                                <p className="text-lg font-bold text-white">{s.value}</p>
                                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Audience + benefits tags */}
                    {(data.audienceTerms.length > 0 || data.benefitTerms.length > 0) && (
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                            {data.audienceTerms.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-widest text-sky-400">Audiencias encontradas en títulos</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {data.audienceTerms.map(a => (
                                            <span key={a} className="text-sm px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300">{a}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {data.benefitTerms.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Beneficios encontrados en títulos</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {data.benefitTerms.map(b => (
                                            <span key={b} className="text-sm px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">{b}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section tabs */}
                    <div className="flex gap-2">
                        {([
                            { id: "keywords" as const, label: "Keywords", icon: <TrendingUp size={13} /> },
                            { id: "books"    as const, label: "Top libros", icon: <BookOpen size={13} /> },
                            { id: "categories" as const, label: "Categorías", icon: <Tag size={13} /> },
                        ]).map(t => (
                            <button key={t.id} onClick={() => setActiveSection(t.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${activeSection === t.id ? "bg-violet-500/15 border-violet-500/30 text-violet-300" : "border-white/8 text-zinc-500 hover:text-zinc-300"}`}>
                                {t.icon}{t.label}
                            </button>
                        ))}
                        {onApplyKeywords && data.topKeywords.length > 0 && (
                            <button
                                onClick={() => onApplyKeywords(data.topKeywords.slice(0, 7).map(k => k.word))}
                                className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-600/30 transition"
                            >
                                Usar en listing →
                            </button>
                        )}
                    </div>

                    {/* Keywords section */}
                    {activeSection === "keywords" && (
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Palabras y frases más repetidas en top 20</p>
                                <div className="space-y-2">
                                    {data.topKeywords.map(kw => (
                                        <div key={kw.word} className="flex items-center gap-3">
                                            <span className="text-sm text-zinc-300 w-48 truncate">{kw.word}</span>
                                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
                                                    style={{ width: `${kw.pct}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-zinc-500 w-12 text-right">{kw.pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {data.subtitlePatterns.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/8">
                                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Patrones de subtítulo en top libros</p>
                                    {data.subtitlePatterns.map((p, i) => (
                                        <div key={i} className="text-sm text-zinc-400 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/5 leading-snug">
                                            "{p}"
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Top books section */}
                    {activeSection === "books" && (
                        <div className="space-y-2">
                            {data.topBooks.map((book, i) => (
                                <div key={i} className={`rounded-xl border transition-all ${expandedBook === i ? "border-white/15 bg-white/5" : "border-white/8 bg-white/[0.02] hover:bg-white/[0.035]"}`}>
                                    <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpandedBook(expandedBook === i ? null : i)}>
                                        <span className="text-xs font-bold text-zinc-600 w-5 pt-0.5 flex-shrink-0">#{book.rank}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white leading-snug">{book.title}</p>
                                            {book.subtitle && <p className="text-sm text-zinc-400 mt-0.5 leading-snug">{book.subtitle}</p>}
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                {book.reviews > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                                                        <Star size={10} className="text-amber-400" />
                                                        {book.reviews.toLocaleString()} reviews
                                                    </span>
                                                )}
                                                {book.rating > 0 && <span className="text-xs text-zinc-500">{book.rating}★</span>}
                                                {book.price && <span className="text-xs text-emerald-400">{book.price}</span>}
                                                {book.bsr && <span className="text-xs text-zinc-600">BSR #{book.bsr.toLocaleString()}</span>}
                                                {book.bestseller && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Bestseller</span>}
                                            </div>
                                        </div>
                                        {expandedBook === i ? <ChevronUp size={14} className="text-zinc-600 flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-zinc-600 flex-shrink-0 mt-1" />}
                                    </div>

                                    {expandedBook === i && (book.bullets.length > 0 || book.categories.length > 0) && (
                                        <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
                                            {book.categories.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Categorías</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {book.categories.map(c => (
                                                            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {book.bullets.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Bullet points</p>
                                                    <ul className="space-y-1">
                                                        {book.bullets.map((b, j) => (
                                                            <li key={j} className="text-sm text-zinc-400 flex gap-2">
                                                                <span className="text-zinc-600 flex-shrink-0">•</span>
                                                                {b}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <a
                                                href={`https://www.amazon.com/dp/${book.asin}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-sky-400 hover:underline"
                                            >
                                                Ver en Amazon →
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Categories section */}
                    {activeSection === "categories" && (
                        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Categorías Amazon encontradas en los top libros</p>
                            {data.categories.length === 0 ? (
                                <p className="text-sm text-zinc-500">No se pudieron extraer categorías de las páginas de producto.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {data.categories.map((c, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm">
                                            <span className="text-zinc-600 text-xs w-4">{i + 1}.</span>
                                            <span className="text-zinc-300">{c}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-zinc-600 pt-1 border-t border-white/8">
                                Usa estas categorías al subir tu libro a KDP en "Browse Categories" para aparecer junto a tus competidores.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
