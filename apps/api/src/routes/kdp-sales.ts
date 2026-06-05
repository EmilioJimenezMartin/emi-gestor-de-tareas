import { FastifyInstance } from "fastify";
import { KdpSale } from "../models/kdp-sale.js";
import { Niche } from "../models/niche.js";

// KDP Royalties CSV columns (flexible — detect by header)
interface ParsedSale {
    title: string;
    asin: string;
    marketplace: string;
    unitsSold: number;
    royaltiesUsd: number;
}

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseKdpCsv(csv: string): ParsedSale[] {
    const lines = csv.split(/\r?\n/).filter(l => l.trim());
    // Find the header row (must contain "asin" somewhere)
    const headerIdx = lines.findIndex(l => /asin/i.test(l));
    if (headerIdx === -1) throw new Error("No se encontró columna ASIN en el CSV");

    const headers = lines[headerIdx].split(",").map(h => normalizeHeader(h.replace(/^"|"$/g, "").trim()));

    const col = (name: string) => {
        const idx = headers.findIndex(h => h.includes(name));
        return idx;
    };

    const titleIdx = col("title");
    const asinIdx = col("asin");
    const marketIdx = col("marketplace");
    // Various column names across KDP report types
    const unitsIdx = headers.findIndex(h => h.includes("netunitssold") || h.includes("unitssold") || h.includes("netsales"));
    const royIdx = headers.findIndex(h => h.includes("royalt") || h.includes("earnings") || h.includes("revenue"));

    if (asinIdx === -1) throw new Error("Columna ASIN no encontrada");

    const results: ParsedSale[] = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw.trim()) continue;
        // Simple CSV split — handles basic quoted fields
        const cols = raw.match(/(".*?"|[^,]*),?/g)?.map(c =>
            c.replace(/,$/, "").replace(/^"|"$/g, "").trim()
        ) ?? [];

        const asin = cols[asinIdx]?.trim();
        if (!asin || asin.length < 5 || asin === "ASIN") continue;

        const units = unitsIdx >= 0 ? parseFloat(cols[unitsIdx]?.replace(/[^0-9.-]/g, "") || "0") : 0;
        const royalties = royIdx >= 0 ? parseFloat(cols[royIdx]?.replace(/[^0-9.-]/g, "") || "0") : 0;
        const title = titleIdx >= 0 ? cols[titleIdx] ?? "" : "";
        const marketplace = marketIdx >= 0 ? cols[marketIdx] ?? "" : "";

        results.push({ title, asin, marketplace, unitsSold: isNaN(units) ? 0 : units, royaltiesUsd: isNaN(royalties) ? 0 : royalties });
    }

    return results;
}

async function matchNicheByAsin(asin: string): Promise<string | null> {
    const niche = await Niche.findOne({ asin }).select("_id").lean();
    return niche ? String((niche as any)._id) : null;
}

export async function registerKdpSalesRoutes(app: FastifyInstance) {
    // POST /kdp-sales/import — parse and store CSV
    app.post("/kdp-sales/import", async (request: any, reply) => {
        try {
            const { csv, period } = request.body ?? {};
            if (!csv || typeof csv !== "string") return reply.status(400).send({ error: "csv es requerido" });

            const rows = parseKdpCsv(csv);
            if (!rows.length) return reply.status(400).send({ error: "No se encontraron filas válidas en el CSV" });

            // Detect period from filename/header or use provided
            const usePeriod = (period ?? new Date().toISOString().slice(0, 7)).trim();

            let imported = 0, linked = 0;
            for (const row of rows) {
                const nicheId = await matchNicheByAsin(row.asin);
                if (nicheId) linked++;
                try {
                    await KdpSale.findOneAndUpdate(
                        { period: usePeriod, asin: row.asin, marketplace: row.marketplace },
                        {
                            $set: {
                                title: row.title,
                                unitsSold: row.unitsSold,
                                royaltiesUsd: row.royaltiesUsd,
                                nicheId,
                            },
                        },
                        { upsert: true }
                    );
                    imported++;
                } catch { /* skip duplicate */ }
            }

            return reply.send({ ok: true, imported, linked, period: usePeriod });
        } catch (e: any) {
            app.log.error(e);
            return reply.status(500).send({ error: e.message ?? "Error importando ventas" });
        }
    });

    // GET /kdp-sales — list with optional ?period= or ?nicheId=
    app.get("/kdp-sales", async (request: any, reply) => {
        try {
            const { period, nicheId, limit = "200" } = request.query ?? {};
            const filter: any = {};
            if (period) filter.period = period;
            if (nicheId) filter.nicheId = nicheId;

            const sales = await KdpSale.find(filter).sort({ period: -1 }).limit(parseInt(limit) || 200).lean();

            // Aggregate summary
            const byPeriod: Record<string, { units: number; royalties: number; asins: number }> = {};
            for (const s of sales as any[]) {
                const key = s.period;
                if (!byPeriod[key]) byPeriod[key] = { units: 0, royalties: 0, asins: 0 };
                byPeriod[key].units += s.unitsSold ?? 0;
                byPeriod[key].royalties += s.royaltiesUsd ?? 0;
                byPeriod[key].asins++;
            }

            return reply.send({ sales, summary: byPeriod });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // GET /kdp-sales/periods — list distinct periods
    app.get("/kdp-sales/periods", async (_req, reply) => {
        try {
            const periods = await KdpSale.distinct("period");
            return reply.send({ periods: (periods as string[]).sort().reverse() });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // PATCH /kdp-sales/:id — update nicheId (manual linking)
    app.patch("/kdp-sales/:id", async (request: any, reply) => {
        try {
            const { nicheId } = request.body ?? {};
            const sale = await KdpSale.findByIdAndUpdate(
                request.params.id,
                { $set: { nicheId: nicheId || null } },
                { new: true }
            );
            if (!sale) return reply.status(404).send({ error: "Venta no encontrada" });
            return reply.send({ ok: true, sale });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /kdp-sales/:id
    app.delete("/kdp-sales/:id", async (request: any, reply) => {
        try {
            await KdpSale.findByIdAndDelete(request.params.id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /kdp-sales/period/:period — delete all entries for a period
    app.delete("/kdp-sales/period/:period", async (request: any, reply) => {
        try {
            const { deletedCount } = await KdpSale.deleteMany({ period: request.params.period });
            return reply.send({ ok: true, deleted: deletedCount });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
