import { FastifyInstance } from "fastify";
import { z } from "zod";
import { GelatoProduct } from "../models/gelato-product.js";
import * as gelato from "../lib/gelato-client.js";

async function getStoreId(): Promise<string | null> {
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "GELATO_STORE_ID" }).lean();
        return (row?.value as string) || null;
    } catch { return null; }
}

export async function registerGelatoRoutes(app: FastifyInstance) {

    // ── Health / auth check ───────────────────────────────────────────────────
    app.get("/gelato/ping", async (_req, reply) => {
        try {
            const stores = await gelato.getStores();
            return reply.send({ ok: true, stores });
        } catch (err: any) {
            return reply.status(400).send({ ok: false, error: err.message });
        }
    });

    // ── Catalog / product catalog ─────────────────────────────────────────────
    app.get("/gelato/catalogs", async (_req, reply) => {
        try {
            const data = await gelato.getCatalogs();
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/catalogs/:catalogUid", async (req: any, reply) => {
        try {
            const data = await gelato.getCatalog(req.params.catalogUid);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.post("/gelato/catalogs/:catalogUid/search", async (req: any, reply) => {
        try {
            const data = await gelato.searchCatalogProducts(req.params.catalogUid, req.body || {});
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/products/:productUid", async (req: any, reply) => {
        try {
            const data = await gelato.getProduct(req.params.productUid);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/products/:productUid/prices", async (req: any, reply) => {
        try {
            const data = await gelato.getProductPrices(req.params.productUid);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/shipment-methods", async (_req, reply) => {
        try {
            const data = await gelato.getShipmentMethods();
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Store / ecommerce products ────────────────────────────────────────────
    app.get("/gelato/store/products", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado. Ve a Ajustes." });
        try {
            const { offset = 0, limit = 50 } = req.query || {};
            const data = await gelato.getStoreProducts(storeId, { offset: Number(offset), limit: Number(limit) });
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/store/products/:productId", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });
        try {
            const data = await gelato.getStoreProduct(storeId, req.params.productId);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/store/templates", async (_req, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });
        try {
            const data = await gelato.getStoreTemplates(storeId);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/store/templates/:templateId", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });
        try {
            const data = await gelato.getStoreTemplate(storeId, req.params.templateId);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // POST /gelato/store/products — create product from template
    const CreateProductSchema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        templateId: z.string().min(1),
        variants: z.array(z.object({
            templateVariantId: z.string(),
            imagePlaceholders: z.record(z.string(), z.string()).optional(),
        })),
        retailPrice: z.number().positive().optional(),
        currency: z.string().default("EUR"),
        // Our internal refs
        catalogId: z.string().optional(),
        nicheId: z.string().optional(),
        printFileUrl: z.string().optional(),
        coverFileUrl: z.string().optional(),
    });

    app.post("/gelato/store/products", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });

        const body = CreateProductSchema.parse(req.body);

        try {
            const gelatoRes = await gelato.createProductFromTemplate(storeId, {
                title: body.title,
                description: body.description,
                templateId: body.templateId,
                variants: body.variants,
            });

            const product = await GelatoProduct.create({
                storeId,
                gelatoProductId: gelatoRes.id ?? gelatoRes.productId ?? `gelato-${Date.now()}`,
                templateId: body.templateId,
                title: body.title,
                description: body.description,
                status: "draft",
                productType: "physical",
                catalogId: body.catalogId,
                nicheId: body.nicheId,
                printFileUrl: body.printFileUrl,
                coverFileUrl: body.coverFileUrl,
                retailPrice: body.retailPrice,
                currency: body.currency,
                gelatoData: gelatoRes,
            });

            return reply.send({ success: true, product, gelatoData: gelatoRes });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.patch("/gelato/store/products/:productId", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });
        try {
            const data = await gelato.updateStoreProduct(storeId, req.params.productId, req.body || {});
            await GelatoProduct.findOneAndUpdate(
                { gelatoProductId: req.params.productId },
                { gelatoData: data, ...req.body }
            );
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.delete("/gelato/store/products/:productId", async (req: any, reply) => {
        const storeId = await getStoreId();
        if (!storeId) return reply.status(400).send({ error: "GELATO_STORE_ID no configurado" });
        try {
            await gelato.deleteStoreProduct(storeId, req.params.productId);
            await GelatoProduct.findOneAndUpdate({ gelatoProductId: req.params.productId }, { status: "deleted" });
            return reply.send({ success: true });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // GET /gelato/my-products — nuestros productos guardados en MongoDB
    app.get("/gelato/my-products", async (req: any, reply) => {
        const { catalogId, nicheId, status } = req.query || {};
        const filter: any = {};
        if (catalogId) filter.catalogId = catalogId;
        if (nicheId) filter.nicheId = nicheId;
        if (status) filter.status = status;
        const products = await GelatoProduct.find(filter).sort({ createdAt: -1 });
        return reply.send({ products });
    });

    // ── Orders ────────────────────────────────────────────────────────────────
    app.get("/gelato/orders", async (req: any, reply) => {
        const { offset = 0, limit = 20 } = req.query || {};
        try {
            const data = await gelato.listOrders({ offset: Number(offset), limit: Number(limit) });
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.get("/gelato/orders/:orderId", async (req: any, reply) => {
        try {
            const data = await gelato.getOrder(req.params.orderId);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.post("/gelato/orders/quote", async (req: any, reply) => {
        try {
            const data = await gelato.quoteOrder(req.body || {});
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.post("/gelato/orders/:orderId/cancel", async (req: any, reply) => {
        try {
            const data = await gelato.cancelOrder(req.params.orderId);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Webhooks ──────────────────────────────────────────────────────────────
    app.get("/gelato/webhooks", async (_req, reply) => {
        try {
            const data = await gelato.listWebhooks();
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.post("/gelato/webhooks/register", async (req: any, reply) => {
        const { url, event } = req.body || {};
        if (!url || !event) return reply.status(400).send({ error: "url y event son requeridos" });
        try {
            const data = await gelato.registerWebhook({ url, event });
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    app.delete("/gelato/webhooks/:webhookId", async (req: any, reply) => {
        try {
            await gelato.deleteWebhook(req.params.webhookId);
            return reply.send({ success: true });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Gelato → our server webhook receiver ──────────────────────────────────
    // Gelato calls this endpoint when order status changes
    app.post("/gelato/webhook", async (req: any, reply) => {
        const payload = req.body || {};
        app.log.info({ gelatoWebhook: payload }, "[gelato-webhook] received");

        // Update GelatoProduct with etsyListingId if order contains it
        const event = payload.type ?? payload.event ?? "";
        if (event === "order.status_updated" || event === "item.shipped") {
            const data = payload.data ?? {};
            app.log.info({ event, orderId: data.orderId, status: data.status }, "[gelato-webhook] order update");
        }

        return reply.send({ ok: true });
    });
}
