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

export function isAuthenticated(): boolean {
    const token = getToken();
    if (!token) return false;
    try {
        // Decode JWT payload (no verify — just check exp client-side)
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
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
