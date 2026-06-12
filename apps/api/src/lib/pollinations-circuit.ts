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
    // Modelos del selector del frontend que el gateway no conoce
    "cf-flux-schnell": { model: "flux" },
    "openjourney-v4": { model: "flux", promptSuffix: ", artistic illustration style, painterly detail" },
    "coloringbook-redmond-v2": { model: "flux", promptSuffix: ", coloring book line art style" },
};

/** Modelos válidos en gen.pollinations.ai — cualquier otro se mapea a flux. */
const VALID_GATEWAY_MODELS = new Set(["flux", "zimage", "klein", "kontext", "gptimage", "gptimage-large", "nova-canvas"]);

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
    const requestedModel = parsed.searchParams.get("model") ?? "";
    const legacy = LEGACY_MODEL_MAP[requestedModel];
    if (legacy) {
        parsed.searchParams.set("model", legacy.model);
        if (legacy.promptSuffix && path.startsWith("/image/")) {
            const rawPrompt = path.slice("/image/".length);
            path = `/image/${rawPrompt}${encodeURIComponent(legacy.promptSuffix)}`;
        }
    } else if (requestedModel && !VALID_GATEWAY_MODELS.has(requestedModel)) {
        // Catch-all: modelo desconocido → flux (evita 400 Query parameter validation failed)
        console.warn(`[pollinations-circuit] Modelo desconocido "${requestedModel}" → flux`);
        parsed.searchParams.set("model", "flux");
    }

    // Cap universal del prompt — protege todas las rutas que llaman al gateway
    if (path.startsWith("/image/")) {
        const rawPrompt = decodeURIComponent(path.slice("/image/".length));
        const capped = capPollinationsPrompt(rawPrompt);
        if (capped !== rawPrompt) path = `/image/${encodeURIComponent(capped)}`;
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
// 503/429 del gateway = cola llena (transitorio). Reintento ACOTADO: máx 2 extra
// con espera fija — nunca bucle infinito.
const TRANSIENT_RETRIES = 2;
const TRANSIENT_WAIT_MS = 8_000;

// Fireworks (upstream de flux en el gateway) usa T5 con límite de 512 TOKENS.
// Si el prompt tokeniza por encima, falla con "negative dimension" (400).
// Estimación conservadora: ~1.4 tokens por palabra + 1 por coma. Presupuesto 460
// tokens (margen bajo 512). Se recortan cláusulas enteras desde el FINAL (las
// exclusiones, peso mínimo) — el opener, estilo y sujeto nunca se pierden.
const MAX_PROMPT_TOKENS = 460;

function estimateTokens(text: string): number {
    // Medido contra el T5 real de Fireworks: este estilo de prompt (comas, guiones,
    // palabras cortas) tokeniza a ~2.1 chars/token. Divisor 2.0 = margen seguro.
    const words = text.split(/\s+/).filter(Boolean).length;
    const commas = (text.match(/,/g) ?? []).length;
    return Math.ceil(Math.max(words * 1.4 + commas, text.length / 2.0));
}

export function capPollinationsPrompt(prompt: string): string {
    if (estimateTokens(prompt) <= MAX_PROMPT_TOKENS) return prompt;
    const clauses = prompt.split(",");
    while (clauses.length > 1 && estimateTokens(clauses.join(",")) > MAX_PROMPT_TOKENS) {
        clauses.pop();
    }
    const capped = clauses.join(",").trim();
    console.warn(`[pollinations-circuit] Prompt ~${estimateTokens(prompt)} tokens > ${MAX_PROMPT_TOKENS} — recortado a ~${estimateTokens(capped)} tokens (límite T5 de Fireworks)`);
    return capped;
}

export async function pollinationsFetch(url: string, opts: RequestInit = {}): Promise<Response> {
    const token = getPollinationsToken();
    const finalUrl = toGenPollinationsUrl(url);

    if (!token) {
        // Sin key el gateway rechaza todo — no quemar tiempo en la petición
        markPollinationsBlocked();
    }

    await acquireSemaphore();
    try {
        let res: Response;
        for (let attempt = 0; ; attempt++) {
            res = await fetch(finalUrl, {
                ...opts,
                headers: {
                    ...(opts.headers as Record<string, string> | undefined),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok && res.status !== 401 && res.status !== 402) {
                const body = await res.clone().text().catch(() => "");
                console.warn(`[pollinations-circuit] HTTP ${res.status}: ${body.slice(0, 200)}`);
                // Transitorios: 503/429 siempre; 400 solo si el cuerpo indica
                // rate-limit/concurrencia (el gateway devuelve 400 al pillar 2 peticiones
                // simultáneas con la misma key). Reintento ACOTADO — nunca bucle infinito.
                const transient400 = res.status === 400 && /rate|queue|concurren|limit|busy|overload|too many/i.test(body);
                if ((res.status === 503 || res.status === 429 || transient400) && attempt < TRANSIENT_RETRIES) {
                    await res.body?.cancel().catch(() => {});
                    console.warn(`[pollinations-circuit] Transitorio — reintento ${attempt + 1}/${TRANSIENT_RETRIES} en ${TRANSIENT_WAIT_MS / 1000}s`);
                    await new Promise(r => setTimeout(r, TRANSIENT_WAIT_MS));
                    continue;
                }
            }
            break;
        }
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
