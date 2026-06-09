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

/** Devuelve el token de Pollinations si está configurado. */
export function getPollinationsToken(): string {
    return _cachedToken || process.env.POLLINATIONS_TOKEN || "";
}

/** @deprecated — Pollinations usa token en URL, no headers. Usar pollinationsFetch directamente. */
export function pollinationsAuthHeaders(): Record<string, string> {
    return {};
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Semáforo — máximo 1 request a Pollinations en vuelo al mismo tiempo.
// Sin esto, peticiones paralelas del autopilot llenan la cola (max 1 concurrent por IP).
let _inFlight = false;
const _waitQueue: Array<() => void> = [];

async function acquireSemaphore(): Promise<void> {
    if (!_inFlight) { _inFlight = true; return; }
    return new Promise(resolve => _waitQueue.push(resolve));
}

function releaseSemaphore(): void {
    const next = _waitQueue.shift();
    if (next) { next(); } else { _inFlight = false; }
}

/**
 * Fetch a Pollinations URL con token como query param (?token=sk_xxx).
 * Serializa todas las peticiones (semáforo) para no llenar la cola del servidor.
 * - Sin token + 402 → marca circuit breaker (IP bloqueada).
 * - 402 "Queue full" → reintenta hasta 3 veces con backoff (8s, 15s, 25s).
 */
export async function pollinationsFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const token = getPollinationsToken();
    const finalUrl = token
        ? (url.includes("?") ? `${url}&token=${token}` : `${url}?token=${token}`)
        : url;

    await acquireSemaphore();
    const delays = [8000, 15000, 25000];
    let lastRes: Response | null = null;

    try {
        for (let attempt = 0; attempt <= delays.length; attempt++) {
            if (attempt > 0) {
                console.warn(`[pollinations-circuit] Cola llena — reintento ${attempt}/${delays.length} en ${delays[attempt - 1] / 1000}s...`);
                await sleep(delays[attempt - 1]);
            }
            const res = await fetch(finalUrl, opts);
            if (res.status !== 402) return res;

            lastRes = res;
            if (!token) {
                markPollinationsBlocked();
                return res;
            }
            const body = await res.clone().text().catch(() => "");
            if (!body.includes("Queue full") || attempt === delays.length) return res;
        }
    } finally {
        releaseSemaphore();
    }

    return lastRes!;
}
