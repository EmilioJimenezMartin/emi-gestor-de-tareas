/**
 * Ciclo de vida comercial de un nicho publicado.
 * El usuario gestiona las fases a mano (pre-publicado → publicado → fin de vida)
 * y pone la fecha de publicación; este módulo dispara los consejos de actuación
 * por Telegram cuando el nicho cruza cada hito (una sola vez por hito).
 */
import { Niche } from "../models/niche.js";
import { KdpSale } from "../models/kdp-sale.js";
import { sendTelegram, shouldNotify } from "./telegram.js";

export interface LifecycleMilestone {
    fromDay: number;
    title: string;
    advice: string;
    /** si se define, el consejo cambia según haya ventas o no */
    salesAware?: { withSales: string; withoutSales: string };
}

// Fuente de verdad de los hitos — el panel de la UI replica estos mismos consejos
export const LIFECYCLE_MILESTONES: LifecycleMilestone[] = [
    { fromDay: 0, title: "Día 0 — Lanzamiento", advice: "Precio de lanzamiento bajo ($6.99). La velocidad de ventas inicial activa la \"luna de miel\" del algoritmo (~30 días de visibilidad extra)." },
    { fromDay: 3, title: "Día 3 — Primeras reviews", advice: "Pide reviews a conocidos QUE COMPREN (no regalado): las Verified Purchase pesan mucho más. Objetivo: 3-5 reviews esta semana." },
    { fromDay: 14, title: "Día 14 — Re-validar mercado", advice: "Lanza otro Market Scan del nicho: ¿entró competencia nueva? ¿Tu libro ya aparece en el autocomplete? Añade el ASIN al nicho para activar el rank tracker." },
    {
        fromDay: 30, title: "Día 30 — Decisión clave",
        advice: "",
        salesAware: {
            withSales: "Hay tracción 🎉 — sube el precio a $8.99. La luna de miel termina: las reviews y la velocidad acumulada sostienen el ranking.",
            withoutSales: "Sin ventas aún — rota metadatos: cambia la keyword principal del título por la 2ª del intel (KDP permite editar sin perder histórico). Considera refrescar la portada.",
        },
    },
    {
        fromDay: 60, title: "Día 60 — Consolidar o pivotar",
        advice: "",
        salesAware: {
            withSales: "Sigue vendiendo — sube a $10.99 y lanza el Vol. 2 (double-down): los compradores satisfechos recompran.",
            withoutSales: "2 meses sin ventas — última rotación de metadatos + portada nueva, o marca el nicho como Fin de vida y reinvierte el esfuerzo en uno gold.",
        },
    },
    { fromDay: 90, title: "Día 90 — Veredicto final", advice: "Decide: si vende, es catálogo permanente (revisa precio estacional); si no, márcalo Fin de vida. Un catálogo muerto no cuesta nada, pero tu tiempo sí." },
];

async function nicheSalesLast60d(nicheId: string): Promise<number> {
    const now = new Date();
    const periods = [0, 1].map(off => {
        const d = new Date(now.getFullYear(), now.getMonth() - off, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const agg = await KdpSale.aggregate([
        { $match: { period: { $in: periods }, nicheId } },
        { $group: { _id: null, units: { $sum: "$unitsSold" } } },
    ]);
    return agg[0]?.units ?? 0;
}

/**
 * Revisa todos los nichos en fase "published" y avisa de los hitos cruzados
 * que aún no se hayan notificado. También recuerda los "pre-published" estancados.
 */
export async function checkLifecycleAlerts(io?: any): Promise<{ alerted: number }> {
    let alerted = 0;

    // ── Publicados: hitos por días desde la publicación ──
    const published = await Niche.find({
        lifecycleStage: "published",
        publishedAt: { $ne: null },
        status: { $ne: "archived" },
    }).select("name publishedAt lifecycleAlertsSent").lean() as any[];

    for (const n of published) {
        const day = Math.floor((Date.now() - new Date(n.publishedAt).getTime()) / 86_400_000);
        const sent = new Set<number>((n.lifecycleAlertsSent ?? []) as number[]);
        const due = LIFECYCLE_MILESTONES.filter(m => day >= m.fromDay && !sent.has(m.fromDay));
        if (due.length === 0) continue;

        const units = due.some(m => m.salesAware) ? await nicheSalesLast60d(String(n._id)) : 0;
        const blocks = due.map(m => {
            const advice = m.salesAware ? (units > 0 ? m.salesAware.withSales : m.salesAware.withoutSales) : m.advice;
            return `📌 <b>${m.title}</b>\n${advice}`;
        });

        if (await shouldNotify("lifecycle.milestone")) {
            await sendTelegram(`📖 <b>${n.name}</b> — día ${day} desde publicación\n\n${blocks.join("\n\n")}`);
        }
        await Niche.findByIdAndUpdate(n._id, { $addToSet: { lifecycleAlertsSent: { $each: due.map(m => m.fromDay) } } });
        io?.emit("niches:updated");
        alerted += due.length;
    }

    // ── Pre-publicados estancados >7 días: recordatorio (un solo aviso, hito -1) ──
    const stale = await Niche.find({
        lifecycleStage: "pre-published",
        status: { $ne: "archived" },
        updatedAt: { $lt: new Date(Date.now() - 7 * 86_400_000) },
        lifecycleAlertsSent: { $ne: -1 },
    }).select("name").lean() as any[];

    if (stale.length > 0 && await shouldNotify("lifecycle.stale-prepublished")) {
        const names = stale.slice(0, 6).map(n => `· ${n.name}`).join("\n");
        await sendTelegram(`⏳ <b>Pre-publicados estancados (+7 días)</b>\n\n${names}\n\nCada día sin publicar es ranking perdido — el contenido ya está listo.`);
        await Niche.updateMany({ _id: { $in: stale.map(n => n._id) } }, { $addToSet: { lifecycleAlertsSent: -1 } });
        alerted += stale.length;
    }

    return { alerted };
}
