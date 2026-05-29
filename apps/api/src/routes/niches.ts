import { FastifyInstance } from "fastify";
import { Niche } from "../models/niche.js";
import { getMongoStatus } from "../lib/mongo.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerNicheRoutes(app: FastifyInstance) {
    app.get("/niches", async (_req, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const niches = await Niche.find().sort({ createdAt: -1 }).lean();
            return reply.send({ niches });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/niches", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { name, description, tags, status, competition, demand, productType, styleCategory, styleCategories, notes, etsyUrl, _sourceTitulo } = request.body as any;
            if (!name?.trim()) return reply.status(400).send({ error: "name required" });
            const resolvedStyles: string[] = Array.isArray(styleCategories) && styleCategories.length > 0
                ? styleCategories
                : styleCategory ? [styleCategory] : ["generic"];
            const niche = await Niche.create({
                name: name.trim(),
                description: description?.trim() ?? "",
                tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
                status: status ?? "found",
                competition: competition ?? "unknown",
                demand: demand ?? "unknown",
                productType: productType ?? "coloring-book",
                styleCategory: resolvedStyles[0],
                styleCategories: resolvedStyles,
                notes: notes?.trim() ?? "",
                etsyUrl: etsyUrl?.trim() ?? "",
                sourceTitulo: _sourceTitulo?.trim() ?? "",
            });
            // If created from radar table, stamp _nichoCreado on the saved etsy result
            if (_sourceTitulo) {
                try {
                    const { Settings } = await import("../models/settings.js");
                    const row = await Settings.findOne({ key: "RADAR_ETSY_RESULT" }).lean();
                    if (row?.value) {
                        const saved = JSON.parse(row.value as string);
                        if (saved?.nichos_detectados) {
                            saved.nichos_detectados = saved.nichos_detectados.map((r: any) =>
                                r.titulo_producto === _sourceTitulo ? { ...r, _nichoCreado: true } : r
                            );
                            await Settings.findOneAndUpdate(
                                { key: "RADAR_ETSY_RESULT" },
                                { $set: { value: JSON.stringify(saved) } },
                                { upsert: true }
                            );
                        }
                    }
                } catch { /* silently ignore radar update failure */ }
            }
            // Auto-trigger discovery if new niche is interesting (status "found")
            if (niche.status === "found") {
                const nicheId = String(niche._id);
                setImmediate(async () => {
                    try {
                        const port = process.env.PORT || 3001;
                        await fetch(`http://localhost:${port}/autopilot/discover/${nicheId}`, { method: "POST" });
                    } catch { /* non-critical — discovery is best-effort */ }
                });
            }

            return reply.status(201).send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/niches/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { name, description, tags, status, competition, demand, productType, styleCategory, styleCategories, notes, generatedPrompt, catalogIds } = request.body as any;
            const update: Record<string, any> = {};
            if (name?.trim()) update.name = name.trim();
            if (description !== undefined) update.description = description.trim();
            if (Array.isArray(tags)) update.tags = tags.map((t: string) => t.trim()).filter(Boolean);
            if (status) update.status = status;
            if (competition) update.competition = competition;
            if (demand) update.demand = demand;
            if (productType) update.productType = productType;
            if (Array.isArray(styleCategories) && styleCategories.length > 0) {
                update.styleCategories = styleCategories;
                update.styleCategory = styleCategories[0];
            } else if (styleCategory) {
                update.styleCategory = styleCategory;
                update.styleCategories = [styleCategory];
            }
            if (notes !== undefined) update.notes = notes.trim();
            if (generatedPrompt !== undefined) update.generatedPrompt = generatedPrompt;
            if (Array.isArray(catalogIds)) update.catalogIds = catalogIds;
            if (request.body.phase) update.phase = request.body.phase;
            if (request.body.publishedAt !== undefined) update.publishedAt = request.body.publishedAt ? new Date(request.body.publishedAt) : null;
            if (request.body.asin !== undefined) update.asin = request.body.asin;
            if (request.body.etsyUrl !== undefined) update.etsyUrl = request.body.etsyUrl;
            if (request.body.gumroadUrl !== undefined) update.gumroadUrl = request.body.gumroadUrl;
            const niche = await Niche.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/niches/:id/royalties", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const { month, sales, revenue } = request.body as any;
            if (!month?.trim()) return reply.status(400).send({ error: "month required" });
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $push: { royalties: { month: month.trim(), sales: Number(sales) || 0, revenue: Number(revenue) || 0 } } },
                { new: true }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/niches/:id/royalties/:month", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id, month } = request.params as { id: string; month: string };
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $pull: { royalties: { month: decodeURIComponent(month) } } },
                { new: true }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/niches/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            await Niche.findByIdAndDelete(id);
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/:id/listings — generate (optionally via AI) + save a KDP listing to the niche
    app.post("/niches/:id/listings", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body as {
                title?: string; subtitle?: string; description?: string; keywords?: string[];
                generate?: boolean;
            };

            let listingData: { title: string; subtitle: string; description: string; keywords: string[] };

            if (body.generate || (!body.title && !body.description)) {
                // Auto-generate using AI from niche context
                const niche = await Niche.findById(id).lean();
                if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });

                const { generateTextWithLLM } = await import("../lib/ai.js");

                const KDP_SYSTEM = `Eres un especialista en SEO y copywriting para Amazon KDP. Genera metadatos de alta conversión para un libro de colorear/actividades.
Responde SOLO con JSON válido (sin markdown): { "title": string, "subtitle": string, "description": string, "keywords": string[] }
- title: 50-80 chars, empieza por la keyword de mayor volumen. Atractivo y orientado a la conversión, NO simple lista de keywords. Formato: "[Keyword]: [Beneficio emocional] for [Audiencia]"
- subtitle: 60-90 chars, keywords secundarias no repetidas del título, menciona cantidad de páginas/diseños y audiencia
- description: HTML para Amazon KDP. Estructura: (1) <p> hook emocional con <strong> en 2-3 keywords, (2) <ul><li> 4-5 beneficios concretos, (3) <p> llamada a la acción + para quién es ideal. 450-650 chars visibles
- keywords: exactamente 7 frases de cola larga (2-5 palabras c/u), sin repetir palabras del título, mezcla temática + audiencia + regalo + uso`;

                const context = [
                    `Nicho: ${niche.name}`,
                    niche.productType === "coloring-book" ? "Tipo: Libro de colorear KDP" : `Tipo: ${niche.productType}`,
                    (niche.tags as string[]).length > 0 ? `Tags: ${(niche.tags as string[]).join(", ")}` : "",
                    niche.styleCategory && niche.styleCategory !== "generic" ? `Estilo: ${niche.styleCategory}` : "",
                    niche.description ? `Descripción: ${niche.description}` : "",
                ].filter(Boolean).join("\n");

                const text = await generateTextWithLLM(KDP_SYSTEM, context);
                const match = text.match(/\{[\s\S]*\}/);
                if (!match) throw new Error("La IA no devolvió JSON válido");
                const parsed = JSON.parse(match[0]);
                listingData = {
                    title: parsed.title ?? niche.name,
                    subtitle: parsed.subtitle ?? "",
                    description: parsed.description ?? "",
                    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: string) => k.trim()).filter(Boolean) : [],
                };
            } else {
                listingData = {
                    title: body.title?.trim() ?? "",
                    subtitle: body.subtitle?.trim() ?? "",
                    description: body.description?.trim() ?? "",
                    keywords: Array.isArray(body.keywords) ? body.keywords.map((k: string) => k.trim()).filter(Boolean) : [],
                };
            }

            const niche = await Niche.findByIdAndUpdate(
                id,
                { $push: { listings: { ...listingData, generatedAt: new Date() } } },
                { new: true }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // DELETE /niches/:id/listings/:listingId — remove a saved KDP listing
    app.delete("/niches/:id/listings/:listingId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id, listingId } = request.params as { id: string; listingId: string };
            const niche = await Niche.findByIdAndUpdate(
                id,
                { $pull: { listings: { _id: listingId } } },
                { new: true }
            ).lean();
            if (!niche) return reply.status(404).send({ error: "Nicho no encontrado" });
            return reply.send({ niche });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    // POST /niches/suggest-description — AI-suggested description, tags and notes
    app.post("/niches/suggest-description", async (request: any, reply) => {
        const { nicheName, productType, style, etsyUrl } = request.body ?? {};
        if (!nicheName?.trim()) return reply.status(400).send({ error: "nicheName requerido" });

        const context = [
            `Niche: ${nicheName}`,
            productType ? `Product type: ${productType}` : "",
            style && style !== "generic" ? `Art style: ${style}` : "",
            etsyUrl ? `Reference Etsy URL: ${etsyUrl}` : "",
        ].filter(Boolean).join("\n");

        const systemPrompt = `You are a KDP publishing expert. Given a niche name, generate concise, useful metadata for tracking and publishing a self-published book (coloring book, journal, activity book).
Respond ONLY with valid JSON (no markdown):
{
  "description": "2-3 sentence niche overview — target audience, market angle, why it sells (max 200 chars)",
  "tags": ["tag1", "tag2", ...up to 8 relevant lowercase tags],
  "notes": "1-2 sentences with actionable publishing tip or market insight for this niche (max 160 chars)"
}`;

        try {
            const { generateTextWithLLM } = await import("../lib/ai.js");
            const text = await generateTextWithLLM(systemPrompt, context);
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("AI no devolvió JSON válido");
            const json = JSON.parse(match[0]);
            return reply.send({
                description: json.description ?? "",
                tags: Array.isArray(json.tags) ? json.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
                notes: json.notes ?? "",
            });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error generando sugerencia" });
        }
    });

    // POST /niches/suggest-prompt — AI-suggested catalog prompt from niche context
    app.post("/niches/suggest-prompt", async (request: any, reply) => {
        const { nicheName, tags, description, productType, style, sourceTitulo } = request.body ?? {};
        if (!nicheName?.trim()) return reply.status(400).send({ error: "nicheName requerido" });

        const context = [
            `Niche: ${nicheName}`,
            sourceTitulo ? `Original Etsy product: "${sourceTitulo}"` : "",
            description ? `Description: ${description}` : "",
            Array.isArray(tags) && tags.length ? `Tags: ${tags.join(", ")}` : "",
            productType === "coloring-book" ? "Product type: coloring book (black and white line art)" : "",
            style ? `Art style: ${style}` : "",
        ].filter(Boolean).join("\n");

        const systemPrompt = `You are an expert at writing image generation prompts for Amazon KDP coloring books and printable products.
Generate an optimized prompt that will produce beautiful, unique images for this niche.
Respond ONLY with valid JSON (no markdown): { "theme": "string", "particulars": "string" }
- theme: specific main subject in English, evocative and detailed (60-120 chars)
- particulars: creative variation details to differentiate images in this niche, English (50-140 chars)`;

        try {
            const { generateTextWithLLM } = await import("../lib/ai.js");
            const text = await generateTextWithLLM(systemPrompt, context);
            const match = text.match(/\{[\s\S]*?\}/);
            if (!match) throw new Error("AI no devolvió JSON válido");
            const json = JSON.parse(match[0]);
            return reply.send({ theme: json.theme ?? nicheName, particulars: json.particulars ?? "" });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error generando sugerencia" });
        }
    });
}
