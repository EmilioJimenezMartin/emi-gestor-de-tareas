const LULU_BASE = "https://api.lulu.com";
const LULU_TOKEN_URL = "https://api.lulu.com/auth/realms/glasslane/protocol/openid-connect/token";

// In-memory token cache
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getLuluCredentials(): Promise<{ clientKey: string; clientSecret: string }> {
    let clientKey = process.env.LULU_CLIENT_KEY ?? "";
    let clientSecret = process.env.LULU_CLIENT_SECRET ?? "";
    try {
        const { Settings } = await import("../models/settings.js");
        const [keyRow, secretRow] = await Promise.all([
            Settings.findOne({ key: "LULU_CLIENT_KEY" }).lean(),
            Settings.findOne({ key: "LULU_CLIENT_SECRET" }).lean(),
        ]);
        if (keyRow?.value) clientKey = keyRow.value as string;
        if (secretRow?.value) clientSecret = secretRow.value as string;
    } catch { /* fallback to env */ }
    return { clientKey, clientSecret };
}

async function getLuluToken(): Promise<string> {
    if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) return _cachedToken;

    const { clientKey, clientSecret } = await getLuluCredentials();
    if (!clientKey || !clientSecret) throw new Error("LULU_CLIENT_KEY / LULU_CLIENT_SECRET no configuradas");

    const res = await fetch(LULU_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientKey,
            client_secret: clientSecret,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Lulu Auth ${res.status}: ${text}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    _cachedToken = data.access_token;
    _tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return _cachedToken;
}

async function luluFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getLuluToken();
    const url = `${LULU_BASE}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Lulu ${res.status} ${res.statusText}: ${text}`);
    }

    return res.json() as Promise<T>;
}

// ── POD Package IDs ───────────────────────────────────────────────────────────
// Format: {width}{height}{color}{quality}{binding}{paper}{interior}{weight}{trim}
// B&W = BW, Color = FC; STD = standard; PB = paperback; 060 = cream 60lb; UW = US/Canada
export const POD_PACKAGES: Record<string, { id: string; label: string; inches: string }> = {
    "8.5x11_bw":  { id: "0850X1100BWSTDPB060UW444GXX", label: '8.5"×11" B&N Paperback',   inches: "8.5x11" },
    "8.5x11_fc":  { id: "0850X1100FCSTDPB060UW444GXX", label: '8.5"×11" Color Paperback',  inches: "8.5x11" },
    "6x9_bw":     { id: "0600X0900BWSTDPB060UW444GXX", label: '6"×9" B&N Paperback',       inches: "6x9"    },
    "6x9_fc":     { id: "0600X0900FCSTDPB060UW444GXX", label: '6"×9" Color Paperback',     inches: "6x9"    },
    "8x10_bw":    { id: "0800X1000BWSTDPB060UW444GXX", label: '8"×10" B&N Paperback',      inches: "8x10"   },
    "8x10_fc":    { id: "0800X1000FCSTDPB060UW444GXX", label: '8"×10" Color Paperback',    inches: "8x10"   },
    "5x8_bw":     { id: "0500X0800BWSTDPB060UW444GXX", label: '5"×8" B&N Paperback',       inches: "5x8"    },
    "a4_bw":      { id: "0827X1169BWSTDPB060UW444GXX", label: "A4 B&N Paperback",          inches: "a4"     },
    "a4_fc":      { id: "0827X1169FCSTDPB060UW444GXX", label: "A4 Color Paperback",        inches: "a4"     },
};

// ── API Calls ─────────────────────────────────────────────────────────────────

export function pingLulu() {
    return getLuluToken().then(t => ({ ok: true, hasToken: !!t }));
}

export interface LuluCostRequest {
    pod_package_id: string;
    page_count: number;
    quantity: number;
    shipping_country: string;
    shipping_option?: string;
}

export function calculateCost(req: LuluCostRequest) {
    return luluFetch<any>("/print-jobs/cost-calculations/", {
        method: "POST",
        body: JSON.stringify({
            line_items: [{
                pod_package_id: req.pod_package_id,
                page_count: req.page_count,
                quantity: req.quantity,
            }],
            shipping_address: { country_code: req.shipping_country },
            shipping_option: req.shipping_option ?? "MAIL",
        }),
    });
}

export interface LuluPrintJobRequest {
    title: string;
    interior_url: string;
    cover_url: string;
    pod_package_id: string;
    page_count: number;
    quantity: number;
    contact_email: string;
    shipping_address: {
        name: string;
        street1: string;
        city: string;
        state_code?: string;
        postcode: string;
        country_code: string;
        phone_number?: string;
        email?: string;
    };
    shipping_option?: string;
}

export function createPrintJob(req: LuluPrintJobRequest) {
    return luluFetch<any>("/print-jobs/", {
        method: "POST",
        body: JSON.stringify({
            contact_email: req.contact_email,
            line_items: [{
                title: req.title,
                cover: { source_url: req.cover_url },
                interior: { source_url: req.interior_url },
                pod_package_id: req.pod_package_id,
                page_count: req.page_count,
                quantity: req.quantity,
            }],
            shipping_address: req.shipping_address,
            shipping_option: req.shipping_option ?? "MAIL",
        }),
    });
}

export function getPrintJob(id: string) {
    return luluFetch<any>(`/print-jobs/${id}/`);
}

export function listPrintJobs(params?: { offset?: number; limit?: number }) {
    const qs = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return luluFetch<any>(`/print-jobs/${qs}`);
}

export function getPrintJobCosts(id: string) {
    return luluFetch<any>(`/print-jobs/${id}/costs/`);
}
