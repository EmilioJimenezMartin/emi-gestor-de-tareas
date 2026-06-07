/**
 * Circuit breaker for Pollinations.
 * When the IP is blocked (HTTP 402), skip all further requests for
 * BLOCK_TTL_MS to avoid wasting time and slots.
 * Auto-resets after the TTL so we try again periodically.
 */

const BLOCK_TTL_MS = 15 * 60 * 1000; // 15 min

let blockedUntil = 0;

export function markPollinationsBlocked() {
    blockedUntil = Date.now() + BLOCK_TTL_MS;
    console.warn(`[pollinations-circuit] IP bloqueada — Pollinations desactivado por ${BLOCK_TTL_MS / 60000} min`);
}

export function isPollinationsBlocked(): boolean {
    // With a token, IP blocking doesn't apply — token bypasses rate limits
    if (_cachedToken || process.env.POLLINATIONS_TOKEN) return false;
    if (blockedUntil && Date.now() > blockedUntil) {
        blockedUntil = 0;
    }
    return blockedUntil > 0;
}

export function getPollinationsStatus(): { blocked: boolean; unblockAt: number | null } {
    return {
        blocked: isPollinationsBlocked(),
        unblockAt: blockedUntil > 0 ? blockedUntil : null,
    };
}

export function resetPollinationsBlock() {
    blockedUntil = 0;
    console.log("[pollinations-circuit] Circuit breaker reseteado manualmente");
}

let _cachedToken = "";

/** Llamar después de cargar settings desde MongoDB para cachear el token. */
export function setPollinationsToken(token: string) {
    _cachedToken = token;
    if (token) {
        blockedUntil = 0; // con token la IP da igual — limpiar bloqueo existente
        console.log("[pollinations-circuit] Token configurado — bloqueo de IP eliminado");
    }
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
    const authHeaders = pollinationsAuthHeaders();
    const sentToken = !!authHeaders.Authorization;
    const headers = { ...authHeaders, ...(opts.headers as Record<string, string> ?? {}) };
    const res = await fetch(url, { ...opts, headers });
    // Only mark IP-blocked when no token was sent — with a token, 402 means something else (invalid token, etc.)
    if (res.status === 402 && !sentToken) {
        markPollinationsBlocked();
    }
    return res;
}
