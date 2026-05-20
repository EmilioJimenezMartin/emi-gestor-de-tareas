const PRODUCT_BASE = "https://product.gelatoapis.com";
const ECOMMERCE_BASE = "https://ecommerce.gelatoapis.com";
const ORDER_BASE = "https://order.gelatoapis.com";

async function getGelatoKey(): Promise<string> {
    let key = process.env.GELATO_API_KEY ?? "";
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "GELATO_API_KEY" }).lean();
        if (row?.value) key = row.value as string;
    } catch { /* fallback to env */ }
    return key;
}

async function gelatoFetch<T>(
    base: string,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const apiKey = await getGelatoKey();
    if (!apiKey) throw new Error("GELATO_API_KEY no configurada");

    const url = `${base}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gelato ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json() as Promise<T>;
}

// ── Products / Catalog ────────────────────────────────────────────────────────

export function getCatalogs() {
    return gelatoFetch<any>(PRODUCT_BASE, "/v3/catalogs");
}

export function getCatalog(catalogUid: string) {
    return gelatoFetch<any>(PRODUCT_BASE, `/v3/catalogs/${catalogUid}`);
}

export function searchCatalogProducts(catalogUid: string, body: Record<string, any> = {}) {
    return gelatoFetch<any>(PRODUCT_BASE, `/v3/catalogs/${catalogUid}/products:search`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function getProduct(productUid: string) {
    return gelatoFetch<any>(PRODUCT_BASE, `/v3/products/${productUid}`);
}

export function getProductPrices(productUid: string) {
    return gelatoFetch<any>(PRODUCT_BASE, `/v3/products/${productUid}/prices`);
}

// ── Ecommerce / Store ─────────────────────────────────────────────────────────

export function getStores() {
    return gelatoFetch<any>(ECOMMERCE_BASE, "/v1/stores");
}

export function getStoreProducts(storeId: string, params?: { offset?: number; limit?: number }) {
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/products${qs}`);
}

export function getStoreProduct(storeId: string, productId: string) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/products/${productId}`);
}

export function getStoreTemplates(storeId: string) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/templates`);
}

export function getStoreTemplate(storeId: string, templateId: string) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/templates/${templateId}`);
}

export function createProductFromTemplate(storeId: string, body: Record<string, any>) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/products:create-from-template`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function updateStoreProduct(storeId: string, productId: string, body: Record<string, any>) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

export function deleteStoreProduct(storeId: string, productId: string) {
    return gelatoFetch<any>(ECOMMERCE_BASE, `/v1/stores/${storeId}/products/${productId}`, {
        method: "DELETE",
    });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function createOrder(body: Record<string, any>) {
    return gelatoFetch<any>(ORDER_BASE, "/v3/orders", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function createDraftOrder(opts: {
    productUid: string;
    pageCount: number;
    fileUrl: string;
    quantity: number;
    shippingAddress: Record<string, any>;
}) {
    const ref = `kdp-draft-${Date.now()}`;
    return gelatoFetch<any>(ORDER_BASE, "/v3/orders", {
        method: "POST",
        body: JSON.stringify({
            orderType: "draft",
            orderReferenceId: ref,
            currency: "EUR",
            items: [{
                itemReferenceId: `item-${ref}`,
                productUid: opts.productUid,
                pageCount: opts.pageCount,
                files: [{ type: "default", url: opts.fileUrl }],
                quantity: opts.quantity,
                shippingAddress: opts.shippingAddress,
            }],
        }),
    });
}

export function getOrder(orderId: string) {
    return gelatoFetch<any>(ORDER_BASE, `/v3/orders/${orderId}`);
}

export function listOrders(params?: { offset?: number; limit?: number }) {
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return gelatoFetch<any>(ORDER_BASE, `/v3/orders${qs}`);
}

export function quoteOrder(body: Record<string, any>) {
    return gelatoFetch<any>(ORDER_BASE, "/v2/orders:quote", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function cancelOrder(orderId: string) {
    return gelatoFetch<any>(ORDER_BASE, `/v3/orders/${orderId}:cancel`, {
        method: "POST",
    });
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export function listWebhooks() {
    return gelatoFetch<any>(ORDER_BASE, "/v3/webhooks");
}

export function registerWebhook(body: { url: string; event: string }) {
    return gelatoFetch<any>(ORDER_BASE, "/v3/webhooks", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

export function deleteWebhook(webhookId: string) {
    return gelatoFetch<any>(ORDER_BASE, `/v3/webhooks/${webhookId}`, {
        method: "DELETE",
    });
}

// ── Shipment methods ──────────────────────────────────────────────────────────

export function getShipmentMethods() {
    return gelatoFetch<any>(ORDER_BASE, "/v3/shipment-methods");
}
