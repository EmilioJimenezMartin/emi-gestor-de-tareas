/**
 * Gumroad API v2 — publicación automática de productos digitales.
 * Requiere GUMROAD_ACCESS_TOKEN y GUMROAD_ENABLED=1 en Settings.
 */

export interface GumroadProduct {
    id: string;
    shortUrl: string;
    editUrl: string;
}

export async function createGumroadProduct(params: {
    accessToken: string;
    name: string;
    description: string;
    priceInCents: number;
    contentUrl: string;
    previewUrl?: string;
}): Promise<GumroadProduct | null> {
    try {
        const body = new URLSearchParams({
            name: params.name,
            description: params.description,
            price: String(params.priceInCents),
            url: params.contentUrl,
            published: "true",
        });
        if (params.previewUrl) body.set("preview_url", params.previewUrl);

        const res = await fetch("https://api.gumroad.com/v2/products", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${params.accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
            signal: AbortSignal.timeout(15_000),
        });

        const data = await res.json() as any;
        if (!res.ok || !data.success) {
            console.warn(`[gumroad] Create product failed: ${data?.message ?? res.status}`);
            return null;
        }

        return {
            id: data.product.id,
            shortUrl: data.product.short_url,
            editUrl: `https://app.gumroad.com/products/${data.product.id}/edit`,
        };
    } catch (e: any) {
        console.warn(`[gumroad] Exception: ${e?.message}`);
        return null;
    }
}
