/**
 * Circuit breaker for Pollinations (gateway gen.pollinations.ai).
 * Ante 401 (key inválida/ausente) o 402 (pollen agotado) se saltan todas las
 * peticiones durante BLOCK_TTL_MS para no quemar tiempo ni slots.
 * Auto-resetea pasado el TTL para reintentar periódicamente.
 */

const BLOCK_TTL_MS = 15 * 60 * 1000; // 15 min

let blockedUntil = 0;

export function markPollinationsBlocked() {
    blockedUntil = Date.now() + BLOCK_TTL_MS;
    console.warn(`[pollinations-circuit] Pollinations desactivado por ${BLOCK_TTL_MS / 60000} min (key inválida o pollen agotado)`);
}

export function isPollinationsBlocked(): boolean {
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

let _relayUrl = "";

/** Configura la URL del Worker relay (CF). Si está seteada, todas las peticiones van por ahí. */
export function setPollinationsRelayUrl(url: string) {
    _relayUrl = url.replace(/\/$/, "");
    if (url) {
        blockedUntil = 0;
        console.log(`[pollinations-circuit] Relay Worker configurado: ${url}`);
    }
}

export function getPollinationsRelayUrl(): string {
    return _relayUrl || process.env.POLLINATIONS_RELAY_URL || "";
}

// Modelos del API antiguo que ya no existen en gen.pollinations.ai.
// Se mapean al modelo más cercano y se inyecta el estilo en el prompt.
const LEGACY_MODEL_MAP: Record<string, { model: string; promptSuffix?: string }> = {
    "flux-anime": { model: "flux", promptSuffix: ", anime style illustration" },
    "flux-realism": { model: "flux", promptSuffix: ", photorealistic, high detail" },
    "flux-3d": { model: "flux", promptSuffix: ", 3d render style" },
    "flux-pro": { model: "flux" },
    "flux-schnell": { model: "flux" },
    "turbo": { model: "zimage" },
};

/**
 * Reescribe URLs del API antiguo al gateway nuevo gen.pollinations.ai.
 * `image.pollinations.ai/prompt/X` ya no funciona: pasa por un Worker de CF
 * con IP de salida compartida → 402 "Queue full" permanente para todos.
 * El gateway nuevo es `gen.pollinations.ai/image/X` con API key Bearer.
 */
export function toGenPollinationsUrl(url: string): string {
    const parsed = new URL(url);
    if (parsed.hostname === "gen.pollinations.ai") return url;
    let path = parsed.pathname;
    if (parsed.hostname.startsWith("image.")) path = path.replace(/^\/prompt\//, "/image/");
    else if (parsed.hostname.startsWith("text.")) path = `/text${path}`;
    parsed.searchParams.delete("token");

    // Mapear modelos legacy que el gateway nuevo rechaza con 400
    const legacy = LEGACY_MODEL_MAP[parsed.searchParams.get("model") ?? ""];
    if (legacy) {
        parsed.searchParams.set("model", legacy.model);
        if (legacy.promptSuffix && path.startsWith("/image/")) {
            const rawPrompt = path.slice("/image/".length);
            path = `/image/${rawPrompt}${encodeURIComponent(legacy.promptSuffix)}`;
        }
    }

    const qs = parsed.searchParams.toString();
    return `https://gen.pollinations.ai${path}${qs ? `?${qs}` : ""}`;
}

/**
 * Fetch contra el gateway nuevo gen.pollinations.ai con API key por Bearer.
 * Acepta URLs en formato antiguo (image.pollinations.ai/prompt/...) y las reescribe.
 * Serializa las peticiones (semáforo) para no saturar el gateway.
 * - Sin API key → el gateway devuelve 401 (ya no existe acceso anónimo); se marca
 *   el circuit breaker para que la cadena de fallback salte a otro proveedor.
 * - 402 con key → pollen agotado; se marca el circuit breaker (sin reintentos).
 */
export async function pollinationsFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const token = getPollinationsToken();
    const finalUrl = toGenPollinationsUrl(url);

    if (!token) {
        // Sin key el gateway rechaza todo — no quemar tiempo en la petición
        markPollinationsBlocked();
    }

    await acquireSemaphore();
    try {
        const res = await fetch(finalUrl, {
            ...opts,
            headers: {
                ...(opts.headers as Record<string, string> | undefined),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        if (res.status === 401 || res.status === 402) {
            // 401 = key inválida/ausente · 402 = pollen agotado
            const body = await res.clone().text().catch(() => "");
            console.warn(`[pollinations-circuit] HTTP ${res.status}: ${body.slice(0, 160)}`);
            markPollinationsBlocked();
        }
        return res;
    } finally {
        releaseSemaphore();
    }
}
