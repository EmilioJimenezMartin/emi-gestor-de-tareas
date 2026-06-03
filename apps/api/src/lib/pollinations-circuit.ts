/**
 * Circuit breaker for Pollinations.
 * When the IP is blocked (HTTP 402), skip all further requests for
 * BLOCK_TTL_MS to avoid wasting time and slots.
 * Auto-resets after the TTL so we try again periodically.
 */

const BLOCK_TTL_MS = 60 * 60 * 1000; // 1 hour

let blockedUntil = 0;

export function markPollinationsBlocked() {
    blockedUntil = Date.now() + BLOCK_TTL_MS;
    console.warn(`[pollinations-circuit] IP bloqueada — Pollinations desactivado por ${BLOCK_TTL_MS / 60000} min`);
}

export function isPollinationsBlocked(): boolean {
    if (blockedUntil && Date.now() > blockedUntil) {
        blockedUntil = 0; // TTL expirado, intentar de nuevo
    }
    return blockedUntil > 0;
}

export function getPollinationsStatus(): { blocked: boolean; unblockAt: number | null } {
    return {
        blocked: isPollinationsBlocked(),
        unblockAt: blockedUntil > 0 ? blockedUntil : null,
    };
}

let _cachedToken = "";

/** Llamar después de cargar settings desde MongoDB para cachear el token. */
export function setPollinationsToken(token: string) {
    _cachedToken = token;
}

/** Headers de autenticación para Pollinations. Con sk_ token → sin x402, sin rate limit. */
export function pollinationsAuthHeaders(): Record<string, string> {
    const token = _cachedToken || process.env.POLLINATIONS_TOKEN || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch a Pollinations URL con auth si está configurada.
 * Si devuelve 402 y NO hay token → marca el circuit breaker.
 * Con token la 402 no debería ocurrir.
 */
export async function pollinationsFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const headers = { ...pollinationsAuthHeaders(), ...(opts.headers as Record<string, string> ?? {}) };
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 402 && !_cachedToken && !process.env.POLLINATIONS_TOKEN) {
        markPollinationsBlocked();
    }
    return res;
}
