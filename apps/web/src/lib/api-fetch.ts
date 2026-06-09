// Server-side fetch helper — used by Server Actions and lib/tasks.ts
// Uses the internal SERVER_API_KEY, NOT the user JWT (which is client-side only)

function getApiUrl(): string {
    return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");
}

function serverAuthHeaders(): Record<string, string> {
    const key = process.env.SERVER_API_KEY;
    if (!key) return {};
    return { Authorization: `Bearer ${key}` };
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${getApiUrl()}${path}`;
    return fetch(url, {
        ...init,
        headers: {
            ...serverAuthHeaders(),
            ...(init.headers as Record<string, string> ?? {}),
        },
    });
}
