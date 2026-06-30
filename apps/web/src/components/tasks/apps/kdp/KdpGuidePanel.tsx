"use client";

import React from "react";
import {
    BookOpen, Rocket, Zap, TrendingUp,
    FileText, Image as ImageIcon, Layers, Eye, AlertTriangle, DollarSign,
    Tag, Globe, Star, Clock,
} from "lucide-react";

type GuideTab = "specs" | "pre" | "days7" | "post";

interface KdpGuidePanelProps {
    guideTab: GuideTab;
    setGuideTab: (tab: GuideTab) => void;
}

export function KdpGuidePanel({ guideTab, setGuideTab }: KdpGuidePanelProps) {
    const phases = [
        {
            id: "specs",
            label: "Specs del libro",
            color: "text-sky-400",
            border: "border-sky-500/25",
            bg: "bg-sky-500/8",
            dot: "bg-sky-400",
            icon: <BookOpen size={14} className="text-sky-400" />,
        },
        {
            id: "pre",
            label: "Pre-lanzamiento",
            color: "text-violet-400",
            border: "border-violet-500/25",
            bg: "bg-violet-500/8",
            dot: "bg-violet-400",
            icon: <Rocket size={14} className="text-violet-400" />,
        },
        {
            id: "days7",
            label: "Los 7 primeros días",
            color: "text-amber-400",
            border: "border-amber-500/25",
            bg: "bg-amber-500/8",
            dot: "bg-amber-400",
            icon: <Zap size={14} className="text-amber-400" />,
        },
        {
            id: "post",
            label: "Post-lanzamiento",
            color: "text-emerald-400",
            border: "border-emerald-500/25",
            bg: "bg-emerald-500/8",
            dot: "bg-emerald-400",
            icon: <TrendingUp size={14} className="text-emerald-400" />,
        },
    ];

    const specItems = [
        { icon: <FileText size={11} />, label: "Tamaño", value: "8.5 × 11 pulgadas", sub: "Trim size estándar KDP" },
        { icon: <ImageIcon size={11} />, label: "Ilustraciones", value: "~50 por libro", sub: "Suficiente para justificar precio" },
        { icon: <Layers size={11} />, label: "Interior", value: "Color estándar", sub: "Papel blanco, no crema" },
        { icon: <Eye size={11} />, label: "Resolución", value: "300 DPI mínimo", sub: "Sube a 600 DPI si es línea art" },
        { icon: <AlertTriangle size={11} />, label: "Sangrado", value: "0.125\" por lado", sub: "Obligatorio si hay fondo" },
        { icon: <DollarSign size={11} />, label: "Precio ideal", value: "$6.99 – $9.99", sub: "Sweet spot de conversión en KDP" },
    ];

    const preItems = [
        { icon: <Tag size={12} className="text-violet-400" />, text: "Keyword principal en las primeras 3-4 palabras del título — Amazon indexa el título completo." },
        { icon: <Tag size={12} className="text-violet-400" />, text: "Subtítulo: 2-3 long-tail keywords sin repetir las del título. Amazon las indexa independientemente." },
        { icon: <Tag size={12} className="text-violet-400" />, text: "7 frases de keywords, máximo 49 chars cada una. Amazon rechaza silenciosamente las que superan ese límite." },
        { icon: <Globe size={12} className="text-violet-400" />, text: "Elige 2 categorías con BSR #100 < 50.000 — significa que el top 100 de esa categoría se vende bien sin ser extremadamente competido." },
        { icon: <ImageIcon size={12} className="text-violet-400" />, text: "A+ Content desde el día 1: 5 módulos de imágenes + texto. Amazon lo prioriza en las búsquedas frente a listings sin A+." },
        { icon: <Star size={12} className="text-violet-400" />, text: "Prepara 10-15 early reviewers (amigos, familia, newsletter) para los primeros días. No pidas reviews explícitamente — deja que Amazon envíe el email automático." },
        { icon: <DollarSign size={12} className="text-violet-400" />, text: "Precio de lanzamiento: $2.99-$4.99 los primeros 7 días para maximizar conversión y velocity score. Sube después." },
    ];

    const days7 = [
        {
            range: "Día 1",
            color: "border-l-amber-500",
            items: [
                "Activa Amazon Sponsored Products con auto-targeting desde el primer minuto — Amazon empieza a indexar keywords de pago inmediatamente.",
                "Comparte en redes propias: Instagram, Pinterest boards, Facebook grupos de coloring books.",
                "Pide a tu red de early reviewers que compren y dejen reseña (sin pedirles que sean positivas).",
            ],
        },
        {
            range: "Días 2-3",
            color: "border-l-orange-500",
            items: [
                "Activa KDP Select Countdown Deal si aplica: 3-5 días a $0.99 genera volume de ventas que dispara el BSR.",
                "Publica un Reel o TikTok mostrando las páginas del libro — el tráfico externo es multiplicador del algoritmo.",
                "Objetivo: 10-20 ventas en 48h ponen el libro en el radar de Amazon's organic push.",
            ],
        },
        {
            range: "Días 4-5",
            color: "border-l-yellow-500",
            items: [
                "Si tienes >15 ventas y BSR < 20.000, sube el precio a normal ($6.99-$9.99).",
                "Revisa el Search Terms Report de Ads para ver qué keywords convierten — añádelas como manual exact.",
                "Busca el libro en Amazon y verifica que aparece en las primeras páginas para tu keyword principal.",
            ],
        },
        {
            range: "Días 6-7",
            color: "border-l-lime-500",
            items: [
                "30 ventas en 7 días → Amazon puede incluirte en 'Hot New Releases' y 'New Releases in [categoría]'.",
                "Aumenta el presupuesto de Ads si el ACoS (Advertising Cost of Sales) < 40%.",
                "Audita reseñas: si hay alguna negativa, responde con educación en menos de 48h — Amazon valora el engagement.",
                "Evalúa lanzar Vol. 2 del mismo nicho: el algoritmo cross-boost entre volúmenes del mismo autor es muy potente.",
            ],
        },
    ];

    const postItems = [
        { icon: <TrendingUp size={12} className="text-emerald-400" />, text: "Semanas 2-4: sube el precio $0.50 cada semana hasta que el ratio conversión caiga. Eso es tu precio óptimo." },
        { icon: <Star size={12} className="text-emerald-400" />, text: "A los 90 días: revisa y cambia categorías si el BSR de tu ranking actual es < 50.000 en otras menos competidas." },
        { icon: <BookOpen size={12} className="text-emerald-400" />, text: "Lanza Vol. 2 antes de las 6 semanas: el autor page de Amazon agrupa volúmenes y el algoritmo hace cross-selling automático." },
        { icon: <Zap size={12} className="text-emerald-400" />, text: "KDP Ads: a las 4 semanas, desactiva palabras clave con >10 clicks sin ventas. Deja activas solo las que conviertan." },
        { icon: <Globe size={12} className="text-emerald-400" />, text: "Activa la distribución expandida de KDP (Expanded Distribution) a los 30 días si tienes >20 ventas orgánicas — es ingreso pasivo adicional sin trabajo extra." },
        { icon: <DollarSign size={12} className="text-emerald-400" />, text: "Cuando el libro lleva 6+ meses y ventas bajan: actualiza portada + refresca keywords + baja precio 48h → Amazon lo trata como nuevo lanzamiento parcial." },
    ];

    return (
        <div className="mt-14 pt-10 border-t border-white/[0.06]">
            <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.025] via-white/[0.01] to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Header gradient bar */}
                <div className="h-px w-full bg-gradient-to-r from-amber-500/70 via-orange-400/30 to-transparent" />

                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
                            <Rocket size={18} className="text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white tracking-tight">Guía de lanzamiento KDP</h3>
                            <p className="text-xs text-neutral-500">Estrategia completa para el algoritmo de Amazon · specs · pre-venta · post-venta</p>
                        </div>
                    </div>

                    {/* Phase tabs */}
                    <div className="flex gap-2 flex-wrap">
                        {phases.map(p => (
                            <button key={p.id} onClick={() => setGuideTab(p.id as GuideTab)}
                                className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-black border transition-all ${guideTab === p.id ? `${p.bg} ${p.border} ${p.color}` : "border-white/[0.06] bg-white/[0.02] text-neutral-600 hover:text-neutral-400 hover:border-white/10"}`}>
                                {p.icon}
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Specs */}
                    {guideTab === "specs" && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {specItems.map(s => (
                                    <div key={s.label} className="flex items-start gap-2.5 px-3 py-3 rounded-2xl bg-sky-500/[0.05] border border-sky-500/15 hover:border-sky-500/25 transition-all">
                                        <div className="mt-0.5 p-1.5 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">{s.icon}</div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-sky-500/60 mb-0.5">{s.label}</p>
                                            <p className="text-sm font-black text-white leading-tight">{s.value}</p>
                                            <p className="text-[10px] text-neutral-600 leading-snug mt-0.5">{s.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[0.04] p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-sky-500/60 flex items-center gap-1.5"><Tag size={9} />Categorías recomendadas</p>
                                {[
                                    "Libros para Colorear para Adultos › Fantasía y Ciencia Ficción",
                                    "Libros para Colorear para Adultos › Ciudades y Arquitectura",
                                    "Libros para Colorear para Adultos › General",
                                    "Adult Coloring Books › Fantasy",
                                    "Arts & Crafts › Drawing › Coloring Books",
                                ].map(cat => (
                                    <div key={cat} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.025] border border-white/[0.05]">
                                        <div className="w-1 h-1 rounded-full bg-sky-400 shrink-0" />
                                        <span className="text-xs text-neutral-400">{cat}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pre-lanzamiento */}
                    {guideTab === "pre" && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                            <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock size={9} />Haz esto antes de pulsar &quot;Publish&quot;</p>
                            {preItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-violet-500/[0.04] border border-violet-500/10 hover:border-violet-500/20 transition-all">
                                    <div className="mt-0.5 p-1 rounded-md bg-violet-500/15 shrink-0">{item.icon}</div>
                                    <p className="text-sm text-neutral-300 leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 7 primeros días */}
                    {guideTab === "days7" && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60">El algoritmo de Amazon da máximo peso a los primeros 7 días</p>
                                <div className="h-px flex-1 bg-gradient-to-l from-amber-500/40 to-transparent" />
                            </div>
                            {days7.map((block, idx) => (
                                <div key={idx} className={`border-l-2 ${block.color} pl-4 py-1 space-y-1.5`}>
                                    <p className="text-xs font-black text-amber-300 uppercase tracking-widest">{block.range}</p>
                                    {block.items.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="mt-1.5 w-1 h-1 rounded-full bg-amber-500/60 shrink-0" />
                                            <p className="text-sm text-neutral-300 leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20">
                                <Zap size={14} className="text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-amber-200/80 leading-relaxed"><span className="font-black text-amber-300">30 ventas en 7 días</span> activan &quot;Hot New Releases&quot; — la sección de Amazon con mayor CTR orgánico de toda la plataforma. Es el salto que separa los libros que se venden solos de los que no.</p>
                            </div>
                        </div>
                    )}

                    {/* Post-lanzamiento */}
                    {guideTab === "post" && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                            <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><TrendingUp size={9} />Semanas 2-12 — mantén el momentum</p>
                            {postItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 hover:border-emerald-500/20 transition-all">
                                    <div className="mt-0.5 p-1 rounded-md bg-emerald-500/15 shrink-0">{item.icon}</div>
                                    <p className="text-sm text-neutral-300 leading-relaxed">{item.text}</p>
                                </div>
                            ))}
                            <div className="mt-2 flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/20">
                                <TrendingUp size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-emerald-200/80 leading-relaxed"><span className="font-black text-emerald-300">La estrategia de volúmenes</span> es el multiplicador más potente: cada nuevo vol. del mismo nicho arrastra ventas orgánicas a los anteriores. Con 5 volúmenes activos, el algoritmo los presenta juntos y el comprador tiende a llevarse varios.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
