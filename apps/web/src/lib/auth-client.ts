const TOKEN_KEY = "emi_auth_token";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export function getTokenExpiry(): number | null {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp * 1000;
    } catch { return null; }
}

export function isAuthenticated(): boolean {
    const expiry = getTokenExpiry();
    return expiry !== null && expiry > Date.now();
}

export async function refreshToken(): Promise<boolean> {
    const token = getToken();
    if (!token) return false;
    try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        const { token: newToken } = await res.json() as { token: string };
        setToken(newToken);
        return true;
    } catch { return false; }
}

export function authHeaders(): Record<string, string> {
    const token = getToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function login(email: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al iniciar sesión");
    }
    return res.json() as Promise<{ token?: string; pendingToken?: string; twoFactorRequired?: boolean }>;
}

// Client-side fetch wrapper that automatically adds the JWT Bearer token
export async function clientFetch(input: string, init: RequestInit = {}): Promise<Response> {
    return fetch(input, {
        ...init,
        headers: {
            ...authHeaders(),
            ...(init.headers as Record<string, string> ?? {}),
        },
    });
}

export async function verify2fa(pendingToken: string, code: string) {
    const res = await fetch(`${API_URL}/auth/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Código incorrecto");
    }
    return res.json() as Promise<{ token: string }>;
}
