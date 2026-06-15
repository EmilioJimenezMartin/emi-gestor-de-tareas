import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { z } from "zod";
import { EtsyListing } from "../models/etsy-listing.js";

const ETSY_BASE = "https://openapi.etsy.com/v3";
const ETSY_AUTH = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN = "https://api.etsy.com/v3/public/oauth/token";

// ── Settings helpers ──────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key }).lean();
        return (row?.value as string) ?? process.env[key] ?? "";
    } catch { return process.env[key] ?? ""; }
}

async function setSetting(key: string, value: string) {
    const { Settings } = await import("../models/settings.js");
    await Settings.findOneAndUpdate(
        { key },
        { $set: { key, value, is_secret: true } },
        { upsert: true }
    );
}

// ── Etsy API fetch ────────────────────────────────────────────────────────────

async function etsyFetch<T>(
    path: string,
    options: RequestInit = {},
    useAuth = true
): Promise<T> {
    const apiKey = await getSetting("ETSY_API_KEY");
    if (!apiKey) throw new Error("ETSY_API_KEY no configurada");

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
    };

    if (useAuth) {
        const token = await getSetting("ETSY_ACCESS_TOKEN");
        if (!token) throw new Error("No autenticado con Etsy. Ve a Ajustes → Conectar Etsy.");
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${ETSY_BASE}${path}`;
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers as any ?? {}) } });

    // Try to refresh if 401
    if (res.status === 401) {
        const refreshed = await refreshEtsyToken();
        if (refreshed) {
            const newToken = await getSetting("ETSY_ACCESS_TOKEN");
            const res2 = await fetch(url, {
                ...options,
                headers: { ...headers, Authorization: `Bearer ${newToken}` },
            });
            if (!res2.ok) {
                const t = await res2.text().catch(() => "");
                throw new Error(`Etsy ${res2.status}: ${t}`);
            }
            return res2.json() as Promise<T>;
        }
        throw new Error("Sesión Etsy expirada. Reconecta desde Ajustes.");
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Etsy ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json() as Promise<T>;
}

async function refreshEtsyToken(): Promise<boolean> {
    try {
        const apiKey = await getSetting("ETSY_API_KEY");
        const apiSecret = await getSetting("ETSY_API_SECRET");
        const refreshToken = await getSetting("ETSY_REFRESH_TOKEN");
        if (!refreshToken) return false;

        const body = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: apiKey,
            refresh_token: refreshToken,
        });

        const res = await fetch(ETSY_TOKEN, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });

        if (!res.ok) return false;
        const data = await res.json() as any;
        await setSetting("ETSY_ACCESS_TOKEN", data.access_token);
        if (data.refresh_token) await setSetting("ETSY_REFRESH_TOKEN", data.refresh_token);
        return true;
    } catch { return false; }
}

// In-memory PKCE state store (short-lived)
const pkceStore = new Map<string, { verifier: string; expiresAt: number }>();

export async function registerEtsyRoutes(app: FastifyInstance) {

    // ── OAuth PKCE flow ───────────────────────────────────────────────────────

    // Step 1: Generate auth URL → redirect user to Etsy
    app.get("/etsy/auth/url", async (_req, reply) => {
        const apiKey = await getSetting("ETSY_API_KEY");
        if (!apiKey) return reply.status(400).send({ error: "ETSY_API_KEY no configurada en Ajustes" });

        const redirectUri = await getSetting("ETSY_REDIRECT_URI") || `${process.env.CORS_ORIGIN}/etsy/callback`;

        // PKCE
        const verifier = crypto.randomBytes(64).toString("base64url");
        const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
        const state = crypto.randomBytes(16).toString("hex");

        pkceStore.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 });

        const scopes = [
            "listings_r", "listings_w", "listings_d",
            "shops_r", "shops_w",
            "transactions_r",
        ].join("%20");

        const url = `${ETSY_AUTH}?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&client_id=${apiKey}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

        return reply.send({ url, state });
    });

    // Step 2: Exchange code for tokens (called after Etsy redirect)
    app.post("/etsy/auth/callback", async (req: any, reply) => {
        const { code, state } = req.body || {};
        if (!code || !state) return reply.status(400).send({ error: "code y state son requeridos" });

        const pkce = pkceStore.get(state);
        if (!pkce || pkce.expiresAt < Date.now()) {
            return reply.status(400).send({ error: "state inválido o expirado" });
        }
        pkceStore.delete(state);

        const apiKey = await getSetting("ETSY_API_KEY");
        const redirectUri = await getSetting("ETSY_REDIRECT_URI") || `${process.env.CORS_ORIGIN}/etsy/callback`;

        try {
            const body = new URLSearchParams({
                grant_type: "authorization_code",
                client_id: apiKey,
                redirect_uri: redirectUri,
                code,
                code_verifier: pkce.verifier,
            });

            const res = await fetch(ETSY_TOKEN, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });

            if (!res.ok) {
                const t = await res.text();
                return reply.status(400).send({ error: `Etsy token error: ${t}` });
            }

            const tokens = await res.json() as any;
            await setSetting("ETSY_ACCESS_TOKEN", tokens.access_token);
            await setSetting("ETSY_REFRESH_TOKEN", tokens.refresh_token ?? "");

            // Auto-detect shop ID
            const me = await etsyFetch<any>("/application/users/me") as any;
            const shopId = me?.shop?.shop_id?.toString() ?? "";
            if (shopId) await setSetting("ETSY_SHOP_ID", shopId);

            return reply.send({ success: true, shopId });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Status: are we connected?
    app.get("/etsy/auth/status", async (_req, reply) => {
        const token = await getSetting("ETSY_ACCESS_TOKEN");
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!token) return reply.send({ connected: false });
        try {
            const me = await etsyFetch<any>("/application/users/me");
            return reply.send({ connected: true, shopId, user: me });
        } catch {
            return reply.send({ connected: false });
        }
    });

    // Disconnect
    app.post("/etsy/auth/disconnect", async (_req, reply) => {
        await setSetting("ETSY_ACCESS_TOKEN", "");
        await setSetting("ETSY_REFRESH_TOKEN", "");
        return reply.send({ success: true });
    });

    // ── Shop ──────────────────────────────────────────────────────────────────
    app.get("/etsy/shop", async (_req, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });
        try {
            const data = await etsyFetch<any>(`/application/shops/${shopId}`);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Listings ──────────────────────────────────────────────────────────────

    // List all listings in shop
    app.get("/etsy/listings", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });

        const { state = "active", limit = 25, offset = 0 } = req.query || {};
        try {
            const data = await etsyFetch<any>(
                `/application/shops/${shopId}/listings?state=${state}&limit=${limit}&offset=${offset}`
            );

            // Sync to MongoDB
            if (data?.results?.length) {
                for (const l of data.results) {
                    await EtsyListing.findOneAndUpdate(
                        { etsyListingId: l.listing_id.toString() },
                        {
                            $set: {
                                etsyListingId: l.listing_id.toString(),
                                shopId,
                                title: l.title,
                                description: l.description ?? "",
                                price: l.price?.amount / l.price?.divisor || 0,
                                currency: l.price?.currency_code ?? "EUR",
                                quantity: l.quantity,
                                tags: l.tags ?? [],
                                listingType: l.listing_type === "download" ? "download" : "physical",
                                status: l.state,
                                views: l.views,
                                favCount: l.num_favorers,
                                etsyData: l,
                            }
                        },
                        { upsert: true }
                    );
                }
            }

            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Get our synced listings from MongoDB
    app.get("/etsy/my-listings", async (req: any, reply) => {
        const { listingType, status, catalogId, nicheId } = req.query || {};
        const filter: any = {};
        if (listingType) filter.listingType = listingType;
        if (status) filter.status = status;
        if (catalogId) filter.catalogId = catalogId;
        if (nicheId) filter.nicheId = nicheId;
        const listings = await EtsyListing.find(filter).sort({ createdAt: -1 });
        return reply.send({ listings });
    });

    app.get("/etsy/listings/:listingId", async (req: any, reply) => {
        try {
            const data = await etsyFetch<any>(`/application/listings/${req.params.listingId}`);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Create listing ────────────────────────────────────────────────────────
    const CreateListingSchema = z.object({
        title: z.string().min(1).max(140),
        description: z.string().min(1),
        price: z.number().positive(),
        quantity: z.number().int().positive().default(999),
        tags: z.array(z.string()).max(13).default([]),
        listingType: z.enum(["physical", "download"]).default("download"),
        whoMade: z.enum(["i_did", "someone_else", "collective"]).default("i_did"),
        whenMade: z.string().default("made_to_order"),
        taxonomyId: z.number().optional(),         // Etsy category ID
        shippingProfileId: z.number().optional(),  // required for physical
        // Internal refs
        catalogId: z.string().optional(),
        nicheId: z.string().optional(),
        gelatoProductId: z.string().optional(),
    });

    app.post("/etsy/listings", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });

        const body = CreateListingSchema.parse(req.body);

        const etsyBody: any = {
            title: body.title,
            description: body.description,
            price: body.price,
            quantity: body.quantity,
            tags: body.tags,
            who_made: body.whoMade,
            when_made: body.whenMade,
            is_digital: body.listingType === "download",
            state: "draft",
        };
        if (body.taxonomyId) etsyBody.taxonomy_id = body.taxonomyId;
        if (body.shippingProfileId) etsyBody.shipping_profile_id = body.shippingProfileId;

        try {
            const created = await etsyFetch<any>(`/application/shops/${shopId}/listings`, {
                method: "POST",
                body: JSON.stringify(etsyBody),
            }) as any;

            const listing = await EtsyListing.create({
                etsyListingId: created.listing_id.toString(),
                shopId,
                title: body.title,
                description: body.description,
                price: body.price,
                currency: "EUR",
                quantity: body.quantity,
                tags: body.tags,
                listingType: body.listingType,
                status: "draft",
                catalogId: body.catalogId,
                nicheId: body.nicheId,
                gelatoProductId: body.gelatoProductId,
                etsyData: created,
            });

            return reply.send({ success: true, listing, etsyData: created });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Update listing
    app.patch("/etsy/listings/:listingId", async (req: any, reply) => {
        try {
            const data = await etsyFetch<any>(`/application/listings/${req.params.listingId}`, {
                method: "PATCH",
                body: JSON.stringify(req.body || {}),
            });
            await EtsyListing.findOneAndUpdate(
                { etsyListingId: req.params.listingId },
                { $set: { ...(req.body || {}), etsyData: data } }
            );
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Publish draft listing → active
    app.post("/etsy/listings/:listingId/publish", async (req: any, reply) => {
        try {
            const data = await etsyFetch<any>(`/application/listings/${req.params.listingId}`, {
                method: "PATCH",
                body: JSON.stringify({ state: "active" }),
            });
            await EtsyListing.findOneAndUpdate(
                { etsyListingId: req.params.listingId },
                { $set: { status: "active", etsyData: data } }
            );
            return reply.send({ success: true, data });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // Delete listing
    app.delete("/etsy/listings/:listingId", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });
        try {
            await etsyFetch<any>(`/application/shops/${shopId}/listings/${req.params.listingId}`, {
                method: "DELETE",
            });
            await EtsyListing.findOneAndDelete({ etsyListingId: req.params.listingId });
            return reply.send({ success: true });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Digital file upload ───────────────────────────────────────────────────
    // Upload a PDF file to an Etsy digital listing
    // The frontend sends: { fileUrl: string (Cloudinary URL), filename: string, rank: number }
    app.post("/etsy/listings/:listingId/files", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });

        const { fileUrl, filename, rank = 1 } = req.body || {};
        if (!fileUrl || !filename) return reply.status(400).send({ error: "fileUrl y filename son requeridos" });

        try {
            // Download the file from Cloudinary
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) throw new Error(`No se pudo descargar el archivo: ${fileRes.status}`);
            const buffer = await fileRes.arrayBuffer();

            // Etsy requires multipart/form-data for file uploads
            const { FormData, Blob } = await import("node:buffer") as any;
            // Node 18+ has FormData in globalThis
            const form = new (globalThis.FormData ?? FormData)();
            form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
            form.append("rank", String(rank));

            const apiKey = await getSetting("ETSY_API_KEY");
            const token = await getSetting("ETSY_ACCESS_TOKEN");

            const uploadRes = await fetch(
                `${ETSY_BASE}/application/shops/${shopId}/listings/${req.params.listingId}/files`,
                {
                    method: "POST",
                    headers: {
                        "x-api-key": apiKey,
                        Authorization: `Bearer ${token}`,
                        // DO NOT set Content-Type — let fetch set it with boundary
                    },
                    body: form,
                }
            );

            if (!uploadRes.ok) {
                const t = await uploadRes.text();
                throw new Error(`Etsy file upload error: ${uploadRes.status} ${t}`);
            }

            const fileData = await uploadRes.json() as any;

            await EtsyListing.findOneAndUpdate(
                { etsyListingId: req.params.listingId },
                {
                    $push: {
                        digitalFiles: {
                            fileId: fileData.listing_file_id?.toString() ?? "",
                            filename,
                            rank,
                        }
                    }
                }
            );

            return reply.send({ success: true, fileData });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Upload listing image ──────────────────────────────────────────────────
    app.post("/etsy/listings/:listingId/images", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });

        const { imageUrl, rank = 1, overwrite = true } = req.body || {};
        if (!imageUrl) return reply.status(400).send({ error: "imageUrl es requerida" });

        try {
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error(`No se pudo descargar la imagen: ${imgRes.status}`);
            const buffer = await imgRes.arrayBuffer();
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";

            const form = new globalThis.FormData();
            form.append("image", new Blob([buffer], { type: contentType }), `listing-image-${rank}.jpg`);
            form.append("rank", String(rank));
            form.append("overwrite", String(overwrite));

            const apiKey = await getSetting("ETSY_API_KEY");
            const token = await getSetting("ETSY_ACCESS_TOKEN");

            const uploadRes = await fetch(
                `${ETSY_BASE}/application/shops/${shopId}/listings/${req.params.listingId}/images`,
                {
                    method: "POST",
                    headers: { "x-api-key": apiKey, Authorization: `Bearer ${token}` },
                    body: form,
                }
            );

            if (!uploadRes.ok) {
                const t = await uploadRes.text();
                throw new Error(`Etsy image upload error: ${uploadRes.status} ${t}`);
            }

            const imgData = await uploadRes.json() as any;
            await EtsyListing.findOneAndUpdate(
                { etsyListingId: req.params.listingId },
                { $push: { images: { url: imageUrl, listingImageId: imgData.listing_image_id?.toString() } } }
            );

            return reply.send({ success: true, imgData });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Taxonomy (categories) ─────────────────────────────────────────────────
    app.get("/etsy/taxonomy", async (_req, reply) => {
        try {
            const data = await etsyFetch<any>("/application/seller-taxonomy/nodes", {}, false);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Shipping profiles ─────────────────────────────────────────────────────
    app.get("/etsy/shipping-profiles", async (_req, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });
        try {
            const data = await etsyFetch<any>(`/application/shops/${shopId}/shipping-profiles`);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Transactions / orders ─────────────────────────────────────────────────
    app.get("/etsy/transactions", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });
        const { limit = 25, offset = 0 } = req.query || {};
        try {
            const data = await etsyFetch<any>(`/application/shops/${shopId}/transactions?limit=${limit}&offset=${offset}`);
            return reply.send(data);
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });

    // ── Receipts summary (for earnings sync) ─────────────────────────────────
    // Returns revenue grouped by listing so user can map to digital products
    app.get("/etsy/receipts-summary", async (req: any, reply) => {
        const shopId = await getSetting("ETSY_SHOP_ID");
        if (!shopId) return reply.status(400).send({ error: "ETSY_SHOP_ID no configurado" });
        const { limit = 100 } = req.query || {};
        try {
            // Fetch paid receipts
            const data = await etsyFetch<any>(
                `/application/shops/${shopId}/receipts?status=paid&limit=${Math.min(Number(limit), 100)}`
            ) as any;

            const receipts: any[] = data?.results ?? [];

            // Aggregate by listing_id across all transactions in receipts
            const map = new Map<string, { listingId: string; title: string; sales: number; revenue: number }>();

            for (const receipt of receipts) {
                const transactions: any[] = receipt.transactions ?? [];
                for (const tx of transactions) {
                    const listingId = String(tx.listing_id ?? "unknown");
                    const title     = tx.title ?? "Sin título";
                    const price     = (tx.price?.amount ?? 0) / (tx.price?.divisor ?? 100);
                    const qty       = tx.quantity ?? 1;

                    const existing = map.get(listingId);
                    if (existing) {
                        existing.sales   += qty;
                        existing.revenue += price * qty;
                    } else {
                        map.set(listingId, { listingId, title, sales: qty, revenue: price * qty });
                    }
                }
            }

            const summary = [...map.values()].sort((a, b) => b.revenue - a.revenue);
            const totalRevenue = summary.reduce((s, e) => s + e.revenue, 0);

            return reply.send({ summary, totalRevenue, receiptsCount: receipts.length });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message });
        }
    });
}
