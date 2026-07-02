/**
 * Pinterest API v5 client — Option A (full automation).
 *
 * Requires a Pinterest Developer App with pins:write + boards:read scope.
 * Tokens are stored in MongoDB Settings:
 *   PINTEREST_ACCESS_TOKEN  — Bearer token
 *   PINTEREST_REFRESH_TOKEN — for refreshing
 *   PINTEREST_APP_ID        — client_id
 *   PINTEREST_APP_SECRET    — client_secret
 */

import { Settings } from "../models/settings.js";

const BASE = "https://api.pinterest.com/v5";
const AUTH_URL = "https://www.pinterest.com/oauth/";
const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";

export interface PinterestBoard {
    id: string;
    name: string;
    description?: string;
    pin_count?: number;
}

export interface PinterestTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

async function getSetting(key: string): Promise<string> {
    const doc = await Settings.findOne({ key }).lean() as any;
    return doc?.value ?? "";
}

async function saveSetting(key: string, value: string) {
    await Settings.updateOne({ key }, { $set: { key, value, is_secret: true } }, { upsert: true });
}

export async function getAuthUrl(redirectUri: string): Promise<string> {
    const clientId = await getSetting("PINTEREST_APP_ID");
    if (!clientId) throw new Error("PINTEREST_APP_ID no configurado en Ajustes");
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "boards:read,pins:write,boards:write",
    });
    return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<PinterestTokens> {
    const clientId = await getSetting("PINTEREST_APP_ID");
    const clientSecret = await getSetting("PINTEREST_APP_SECRET");
    if (!clientId || !clientSecret) throw new Error("Credenciales Pinterest no configuradas");

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
    if (!res.ok) throw new Error(`Pinterest token exchange failed: ${await res.text()}`);
    const data = await res.json() as any;
    await saveSetting("PINTEREST_ACCESS_TOKEN", data.access_token);
    await saveSetting("PINTEREST_REFRESH_TOKEN", data.refresh_token ?? "");
    return data as PinterestTokens;
}

export async function refreshToken(): Promise<string> {
    const clientId = await getSetting("PINTEREST_APP_ID");
    const clientSecret = await getSetting("PINTEREST_APP_SECRET");
    const refreshTok = await getSetting("PINTEREST_REFRESH_TOKEN");
    if (!refreshTok) throw new Error("No hay refresh token. Reconecta tu cuenta Pinterest.");

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshTok }),
    });
    if (!res.ok) throw new Error(`Pinterest refresh failed: ${await res.text()}`);
    const data = await res.json() as any;
    await saveSetting("PINTEREST_ACCESS_TOKEN", data.access_token);
    return data.access_token as string;
}

async function apiCall(method: string, path: string, body?: object): Promise<any> {
    let token = await getSetting("PINTEREST_ACCESS_TOKEN");
    if (!token) throw new Error("Pinterest no conectado. Configura la cuenta en Ajustes.");

    const doRequest = async (tok: string) => fetch(`${BASE}${path}`, {
        method,
        headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
    });

    let res = await doRequest(token);

    // Auto-refresh on 401
    if (res.status === 401) {
        token = await refreshToken();
        res = await doRequest(token);
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Pinterest API ${res.status}: ${err}`);
    }
    return res.json();
}

export async function listBoards(): Promise<PinterestBoard[]> {
    const data = await apiCall("GET", "/boards?page_size=50");
    return (data.items ?? []) as PinterestBoard[];
}

export async function createPin(params: {
    boardId: string;
    imageUrl: string;
    title: string;
    description: string;
    link: string;
}): Promise<string> {
    const data = await apiCall("POST", "/pins", {
        board_id: params.boardId,
        title: params.title.slice(0, 100),
        description: params.description.slice(0, 500),
        link: params.link,
        media_source: {
            source_type: "image_url",
            url: params.imageUrl,
        },
    });
    return data.id as string;
}

export async function isConnected(): Promise<boolean> {
    const token = await getSetting("PINTEREST_ACCESS_TOKEN");
    return !!token;
}
