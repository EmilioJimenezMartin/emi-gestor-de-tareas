"use client";

import { useState, useEffect } from "react";
import {
    ShoppingCart, ShoppingBag, Globe, Sparkles, Loader2,
    X, ChevronRight, Wand2, TrendingUp, MessageCircle, Tag,
} from "lucide-react";

export type SearchPlatform = "etsy" | "amazon" | "general" | "trends" | "reddit" | "gumroad";

export interface SearchConfig {
    platform: SearchPlatform;
    url: string;
    searchTerm?: string;
    preset?: string;
}

interface SearchQueryBuilderProps {
    value?: SearchConfig;
    onChange?: (config: SearchConfig) => void;
    apiUrl: string;
    /** Extra presets per platform — merged with the built-in ones */
    extraEtsyPresets?: { label: string; url: string; hint?: string }[];
    extraAmazonPresets?: { label: string; url: string; hint?: string }[];
    extraGeneralPresets?: { label: string; url: string; hint?: string }[];
    /** Disable the platform tabs (lock to a specific platform) */
    lockPlatform?: SearchPlatform;
    className?: string;
}

const ETSY_PRESETS: { label: string; url: string; hint?: string }[] = [
    { label: "Coloring PDF Adults", url: "https://www.etsy.com/es/search?q=coloring+pages+pdf+adults&page=1", hint: "coloring pages pdf adults" },
    { label: "Bold & Easy", url: "https://www.etsy.com/es/search?q=bold+and+easy+coloring+book&page=1", hint: "bold and easy coloring book" },
    { label: "Kawaii Digital", url: "https://www.etsy.com/es/search?q=kawaii+coloring+book+digital&page=1", hint: "kawaii coloring book digital" },
    { label: "Wall Art Print", url: "https://www.etsy.com/es/search?q=wall+art+digital+print&page=1", hint: "wall art digital print" },
    { label: "Printable Journal", url: "https://www.etsy.com/es/search?q=printable+journal+planner&page=1", hint: "printable journal planner" },
    { label: "Activity Book Kids", url: "https://www.etsy.com/es/search?q=activity+book+kids+printable&page=1", hint: "activity book kids printable" },
];

const AMAZON_PRESETS: { label: string; url: string; hint?: string }[] = [
    { label: "Coloring Adults", url: "https://www.amazon.com/s?k=coloring+book+adults&rh=n%3A283155", hint: "coloring book adults" },
    { label: "Mandala Books", url: "https://www.amazon.com/s?k=mandala+coloring+book", hint: "mandala coloring book" },
    { label: "Animal Patterns", url: "https://www.amazon.com/s?k=animal+coloring+book+adults", hint: "animal coloring book adults" },
    { label: "KDP Bestsellers", url: "https://www.amazon.com/Best-Sellers-Books-Coloring/zgbs/books/4291/ref=zg_bs_nav_books_3_4", hint: "KDP best sellers" },
    { label: "Wall Art Posters", url: "https://www.amazon.com/s?k=wall+art+prints+posters", hint: "wall art prints posters" },
    { label: "Journals & Planners", url: "https://www.amazon.com/s?k=kdp+journal+planner", hint: "kdp journal planner" },
];

const GENERAL_PRESETS: { label: string; url: string; hint?: string }[] = [
    { label: "Amazon", url: "https://www.amazon.com/s?k=coloring+book+adults", hint: "amazon coloring books" },
    { label: "Etsy", url: "https://www.etsy.com/search?q=coloring+book", hint: "etsy coloring book" },
    { label: "Google Trends", url: "https://trends.google.com/trends/explore?q=coloring+book", hint: "coloring book trends" },
];

const REDDIT_PRESETS: { label: string; url: string; hint?: string }[] = [
    { label: "KDP + Coloring (New)", url: "https://www.reddit.com/r/kdp+coloringbooks/new.json?limit=100", hint: "posts recientes en r/kdp y r/coloringbooks" },
    { label: "KDP Hot", url: "https://www.reddit.com/r/kdp/hot.json?limit=100", hint: "posts populares en r/kdp" },
    { label: "Coloring Books Hot", url: "https://www.reddit.com/r/coloringbooks/hot.json?limit=100", hint: "posts populares en r/coloringbooks" },
    { label: "Self Publishing", url: "https://www.reddit.com/r/selfpublishing/hot.json?limit=100", hint: "comunidad de autopublicación" },
    { label: "KDP Top Month", url: "https://www.reddit.com/r/kdp/top.json?t=month&limit=100", hint: "más votados del mes en r/kdp" },
];

const GUMROAD_PRESETS: { label: string; url: string; hint?: string }[] = [
    { label: "Coloring Books", url: "https://gumroad.com/discover?query=coloring+book", hint: "coloring book digital" },
    { label: "KDP Templates", url: "https://gumroad.com/discover?query=kdp+template", hint: "kdp low content templates" },
    { label: "Printable Planner", url: "https://gumroad.com/discover?query=printable+planner", hint: "printable planner digital" },
    { label: "Wall Art Prints", url: "https://gumroad.com/discover?query=wall+art+print", hint: "wall art digital download" },
    { label: "Activity Sheets", url: "https://gumroad.com/discover?query=activity+sheets+kids", hint: "kids activity sheets" },
    { label: "Seamless Patterns", url: "https://gumroad.com/discover?query=seamless+pattern", hint: "seamless pattern bundle" },
];

const TRENDS_PRESETS: { label: string; url: string; hint?: string }[] = [
    // Root + Modifier comparisons — the most powerful technique
    { label: "Compare Formatos", url: "https://trends.google.com/trends/explore?q=coloring+book+adults,activity+book+adults,coloring+book+seniors&geo=US&date=today+5-y", hint: "Compara 3 formatos · 5 años" },
    { label: "Stress / Mindful", url: "https://trends.google.com/trends/explore?q=stress+relief+coloring,mindfulness+coloring+book,anxiety+coloring+book&geo=US&date=today+5-y", hint: "Nichos salud mental · rising" },
    { label: "Seniors & Memory", url: "https://trends.google.com/trends/explore?q=coloring+book+seniors,memory+activity+book,cognitive+activity+book&geo=US&date=today+5-y", hint: "Mercado senior · crecimiento" },
    { label: "Hobbies en Auge", url: "https://trends.google.com/trends/explore?q=urban+gardening+coloring,astrology+coloring+book,cottagecore+printable&geo=US&date=today+5-y", hint: "Hobbies + formato KDP" },
    { label: "Estacional 5a", url: "https://trends.google.com/trends/explore?q=christmas+coloring+book,halloween+coloring+book,valentine+coloring+book&geo=US&date=today+5-y", hint: "Picos estacionales · planifica con antelación" },
    { label: "Trending Hoy", url: "https://trends.google.com/trends/trendingsearches/daily?geo=US", hint: "Búsquedas virales del día" },
];

type AccentKey = "sky" | "orange" | "amber" | "emerald" | "rose" | "violet";

const PLATFORM_ACCENT: Record<SearchPlatform, AccentKey> = {
    etsy: "sky",
    amazon: "orange",
    general: "amber",
    trends: "emerald",
    reddit: "rose",
    gumroad: "violet",
};

const accentClasses = {
    sky: {
        tab: "bg-sky-500/15 border-sky-500/25 text-sky-300",
        preset: "bg-sky-500/15 border-sky-500/25 text-sky-300",
        presetHover: "hover:text-sky-400 hover:border-sky-500/20",
        input: "focus-within:border-sky-500/40",
        button: "bg-gradient-to-r from-sky-500 to-cyan-500 shadow-sky-500/20 hover:from-sky-400 hover:to-cyan-400",
        ai: "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20",
    },
    orange: {
        tab: "bg-orange-500/15 border-orange-500/25 text-orange-300",
        preset: "bg-orange-500/15 border-orange-500/25 text-orange-300",
        presetHover: "hover:text-orange-400 hover:border-orange-500/20",
        input: "focus-within:border-orange-500/40",
        button: "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400",
        ai: "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20",
    },
    amber: {
        tab: "bg-amber-500/15 border-amber-500/25 text-amber-300",
        preset: "bg-amber-500/15 border-amber-500/25 text-amber-300",
        presetHover: "hover:text-amber-400 hover:border-amber-500/20",
        input: "focus-within:border-amber-500/40",
        button: "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20 hover:from-amber-400 hover:to-orange-400",
        ai: "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20",
    },
    emerald: {
        tab: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300",
        preset: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300",
        presetHover: "hover:text-emerald-400 hover:border-emerald-500/20",
        input: "focus-within:border-emerald-500/40",
        button: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400",
        ai: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
    },
    rose: {
        tab: "bg-rose-500/15 border-rose-500/25 text-rose-300",
        preset: "bg-rose-500/15 border-rose-500/25 text-rose-300",
        presetHover: "hover:text-rose-400 hover:border-rose-500/20",
        input: "focus-within:border-rose-500/40",
        button: "bg-gradient-to-r from-rose-500 to-orange-500 shadow-rose-500/20 hover:from-rose-400 hover:to-orange-400",
        ai: "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20",
    },
    violet: {
        tab: "bg-violet-500/15 border-violet-500/25 text-violet-300",
        preset: "bg-violet-500/15 border-violet-500/25 text-violet-300",
        presetHover: "hover:text-violet-400 hover:border-violet-500/20",
        input: "focus-within:border-violet-500/40",
        button: "bg-gradient-to-r from-violet-500 to-purple-500 shadow-violet-500/20 hover:from-violet-400 hover:to-purple-400",
        ai: "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20",
    },
};

export function SearchQueryBuilder({
    value,
    onChange,
    apiUrl,
    extraEtsyPresets = [],
    extraAmazonPresets = [],
    extraGeneralPresets = [],
    lockPlatform,
    className = "",
}: SearchQueryBuilderProps) {
    const [platform, setPlatform] = useState<SearchPlatform>(value?.platform ?? lockPlatform ?? "etsy");
    const [url, setUrl] = useState(value?.url ?? "");
    const [showAi, setShowAi] = useState(false);
    const [aiIdea, setAiIdea] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiReasoning, setAiReasoning] = useState("");
    const [discoverLoading, setDiscoverLoading] = useState(false);
    const [discoverResult, setDiscoverResult] = useState<{ niche: string; reasoning: string } | null>(null);
    const storageKey = `sqb-discover-on-${lockPlatform ?? "all"}`;
    const [discoverOn, setDiscoverOn] = useState(() =>
        typeof window !== "undefined" ? localStorage.getItem(storageKey) !== "0" : true
    );
    const toggleDiscover = () => setDiscoverOn(v => {
        const next = !v;
        if (typeof window !== "undefined") localStorage.setItem(storageKey, next ? "1" : "0");
        return next;
    });

    // Sync internal platform state when the parent switches the lockPlatform tab
    useEffect(() => {
        if (lockPlatform && lockPlatform !== platform) {
            setPlatform(lockPlatform);
            setUrl("");
        }
    }, [lockPlatform]); // eslint-disable-line react-hooks/exhaustive-deps

    const accent = accentClasses[PLATFORM_ACCENT[platform]];

    const etsyPresets = [...ETSY_PRESETS, ...extraEtsyPresets];
    const amazonPresets = [...AMAZON_PRESETS, ...extraAmazonPresets];
    const generalPresets = [...GENERAL_PRESETS, ...extraGeneralPresets];

    const presetsForPlatform = platform === "etsy" ? etsyPresets : platform === "amazon" ? amazonPresets : platform === "trends" ? TRENDS_PRESETS : platform === "reddit" ? REDDIT_PRESETS : platform === "gumroad" ? GUMROAD_PRESETS : generalPresets;

    const emit = (newPlatform: SearchPlatform, newUrl: string, preset?: string) => {
        const term = newUrl.match(/[?&](?:q|k)=([^&]+)/)?.[1]?.replace(/\+/g, " ") ?? "";
        onChange?.({ platform: newPlatform, url: newUrl, searchTerm: term || undefined, preset });
    };

    const handlePlatformChange = (p: SearchPlatform) => {
        setPlatform(p);
        setUrl("");
        setAiReasoning("");
        emit(p, "");
    };

    const handleUrlChange = (newUrl: string) => {
        setUrl(newUrl);
        emit(platform, newUrl);
    };

    const handlePreset = (p: { label: string; url: string }) => {
        setUrl(p.url);
        setShowAi(false);
        emit(platform, p.url, p.label);
    };

    const handleAiSuggest = async () => {
        if (!aiIdea.trim()) return;
        setAiLoading(true);
        setAiReasoning("");
        try {
            const res = await fetch(`${apiUrl}/ai/suggest-search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea: aiIdea.trim(), platform }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json() as { url: string; searchTerm: string; reasoning?: string };
            setUrl(data.url);
            if (data.reasoning) setAiReasoning(data.reasoning);
            emit(platform, data.url, `AI: ${data.searchTerm}`);
        } catch {
            // silently ignore — user can retry
        } finally {
            setAiLoading(false);
        }
    };

    const handleDiscover = async () => {
        setDiscoverLoading(true);
        setDiscoverResult(null);
        try {
            const res = await fetch(`${apiUrl}/ai/discover-niche`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const data = await res.json() as { niche: string; url: string; searchTerm: string; reasoning: string };
            setUrl(data.url);
            setDiscoverResult({ niche: data.niche, reasoning: data.reasoning });
            setShowAi(false);
            emit(platform, data.url, `Discover: ${data.searchTerm}`);
        } catch {
            // silently ignore
        } finally {
            setDiscoverLoading(false);
        }
    };

    const platformIcon = platform === "etsy" ? <ShoppingCart size={11} /> : platform === "amazon" ? <ShoppingBag size={11} /> : platform === "reddit" ? <MessageCircle size={11} /> : platform === "gumroad" ? <Tag size={11} /> : <Globe size={11} />;

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Platform tabs */}
            {!lockPlatform && (
                <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/8 rounded-2xl w-fit">
                    {(["etsy", "amazon", "general", "trends", "reddit", "gumroad"] as const).map(p => {
                        const icons = { etsy: <ShoppingCart size={11} />, amazon: <ShoppingBag size={11} />, general: <Globe size={11} />, trends: <TrendingUp size={11} />, reddit: <MessageCircle size={11} />, gumroad: <Tag size={11} /> };
                        const labels = { etsy: "Etsy", amazon: "Amazon", general: "General", trends: "Trends", reddit: "Reddit", gumroad: "Gumroad" };
                        const isActive = platform === p;
                        return (
                            <button key={p} onClick={() => handlePlatformChange(p)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? accentClasses[PLATFORM_ACCENT[p]].tab : "text-neutral-600 hover:text-neutral-400"}`}>
                                {icons[p]} {labels[p]}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* URL input */}
            <div className={`flex items-center gap-2 bg-white/[0.025] border border-white/8 rounded-2xl px-4 h-11 transition-all ${accent.input}`}>
                <ChevronRight size={13} className="text-neutral-700 shrink-0" />
                <input
                    type="url"
                    value={url}
                    onChange={e => handleUrlChange(e.target.value)}
                    placeholder={
                        platform === "etsy" ? "https://www.etsy.com/search?q=..."
                        : platform === "amazon" ? "https://www.amazon.com/s?k=..."
                        : platform === "trends" ? "https://trends.google.com/trends/explore?q=..."
                        : platform === "reddit" ? "https://www.reddit.com/r/kdp/new.json?limit=100"
                        : platform === "gumroad" ? "https://gumroad.com/discover?query=..."
                        : "https://..."
                    }
                    className="flex-1 bg-transparent text-[11px] text-white placeholder:text-neutral-700 focus:outline-none font-mono"
                />
                {url && (
                    <button onClick={() => handleUrlChange("")} className="text-neutral-700 hover:text-white transition-colors">
                        <X size={11} />
                    </button>
                )}
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Búsquedas predefinidas</span>
                    <div className="flex items-center gap-1">
                        {/* Sugerencia IA toggle */}
                        <button
                            onClick={toggleDiscover}
                            title={discoverOn ? "Desactivar sugerencia IA" : "Activar sugerencia IA"}
                            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${discoverOn ? accent.ai : "border-white/8 text-neutral-600 hover:text-neutral-400 hover:border-white/15"}`}>
                            <Wand2 size={8} />
                            {discoverOn ? "IA ON" : "IA OFF"}
                        </button>
                        {/* Idea propia */}
                        <button
                            onClick={() => { setShowAi(v => !v); setAiReasoning(""); }}
                            className={`flex items-center gap-1.5 h-6 px-2.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${showAi ? accent.ai : "border-white/8 text-neutral-600 hover:text-neutral-400 hover:border-white/15"}`}>
                            <Sparkles size={8} /> Idea
                        </button>
                    </div>
                </div>

                {/* AI discover block — visible only when discoverOn and not in showAi mode */}
                {discoverOn && !showAi && (
                    <div className="space-y-1.5">
                        <button
                            onClick={() => void handleDiscover()}
                            disabled={discoverLoading}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-[9px] font-black uppercase tracking-wide ${accent.ai} disabled:opacity-50 disabled:cursor-not-allowed`}>
                            {discoverLoading
                                ? <Loader2 size={10} className="animate-spin shrink-0" />
                                : <Wand2 size={10} className="shrink-0" />}
                            <span>{discoverLoading ? "Buscando nicho…" : discoverResult ? "Nueva sugerencia" : "Sugerencia IA"}</span>
                            {!discoverLoading && !discoverResult && <span className="font-normal normal-case text-[8px] opacity-70 truncate flex-1">nicho poco explorado</span>}
                        </button>

                        {discoverResult && (
                            <div className={`rounded-xl border ${accent.ai.includes("sky") ? "border-sky-500/20 bg-sky-500/[0.04]" : accent.ai.includes("orange") ? "border-orange-500/20 bg-orange-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"} px-3 py-2.5 space-y-1`}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Sugerido</p>
                                    <button onClick={() => setDiscoverResult(null)} className="text-neutral-700 hover:text-white transition-colors"><X size={9} /></button>
                                </div>
                                <p className="text-[11px] font-black text-white leading-snug">{discoverResult.niche}</p>
                                <p className="text-[9px] text-neutral-500 leading-relaxed">{discoverResult.reasoning}</p>
                            </div>
                        )}
                    </div>
                )}

                {showAi ? (
                    <div className="space-y-2 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-400/80">Sugerir búsqueda con IA</p>
                        <div className="flex gap-2">
                            <input
                                value={aiIdea}
                                onChange={e => setAiIdea(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && void handleAiSuggest()}
                                placeholder="Ej: libros de colorear de animales para niños…"
                                className="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 h-9 text-[11px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-all"
                            />
                            <button
                                onClick={() => void handleAiSuggest()}
                                disabled={aiLoading || !aiIdea.trim()}
                                className="h-9 px-3 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                            </button>
                        </div>
                        {aiReasoning && (
                            <p className="text-[10px] text-violet-400/70 leading-relaxed border-l-2 border-violet-500/30 pl-2">{aiReasoning}</p>
                        )}
                        {url && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8">
                                {platformIcon}
                                <span className="text-[10px] font-mono text-neutral-400 truncate flex-1">{url}</span>
                                <span className="text-[8px] font-black uppercase text-violet-400">✓</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {presetsForPlatform.map(p => (
                            <button key={p.label} onClick={() => handlePreset(p)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-[9px] font-black uppercase ${url === p.url
                                    ? accent.preset
                                    : `bg-white/[0.02] border-white/8 text-neutral-500 ${accent.presetHover}`
                                    }`}>
                                {platformIcon}
                                {p.label} ↗
                                {p.hint && (
                                    <span className="font-normal text-neutral-600 normal-case truncate flex-1 text-[8px]">{p.hint}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
