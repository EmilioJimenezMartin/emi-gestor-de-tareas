// Marcadores y extracción de sujeto para prompts de coloring-book, vivos en un
// módulo sin dependencias propias a propósito: tanto `routes/autopilot.ts`
// (dueño de la fórmula completa, buildColoringBookPrompt) como `lib/image-gen.ts`
// (que ya importa buildColoringBookPrompt/generateImage desde autopilot.ts vía
// otros archivos) necesitan extractColoringBookSubject. Ponerlo en autopilot.ts
// e importarlo desde image-gen.ts crearía un ciclo (autopilot.ts → image-gen.ts
// → autopilot.ts), que en ESM puede dejar un export como undefined en tiempo de
// carga según el orden de evaluación — justo el tipo de fallo silencioso que
// podría romper Telegram sin que typecheck lo detecte. `routes/autopilot.ts`
// re-exporta estos tres símbolos para no romper los imports existentes.

export const CB_FIDELITY = "depicting exactly and only the following subject, faithful to the description, intricate detail concentrated on the subject itself";

export const CB_ANATOMY = "ANATOMY: every creature drawn with its exact standard species limb count — 4 legs for mammals, 8 legs for spiders and scorpions, 6 legs for insects, 2 legs and 2 wings for birds, 4 limbs for reptiles, 2 arms and 2 legs for humans — never add or omit limbs, tails, or wings beyond the species standard";

/**
 * Extrae el sujeto real (particulars) de un prompt ya envuelto por
 * buildColoringBookPrompt, usando los marcadores CB_FIDELITY/CB_ANATOMY como
 * límites. Si no los encuentra (el prompt no viene de la fórmula — raw mode,
 * printable-poster, etc.), devuelve el prompt tal cual.
 */
export function extractColoringBookSubject(prompt: string): string {
    const fidelityMarker = `${CB_FIDELITY}: `;
    const anatomyMarker = `, ${CB_ANATOMY}`;
    const fIdx = prompt.indexOf(fidelityMarker);
    if (fIdx === -1) return prompt;
    const aIdx = prompt.indexOf(anatomyMarker, fIdx);
    if (aIdx === -1) return prompt;
    return prompt.slice(fIdx + fidelityMarker.length, aIdx);
}

/**
 * Construye un prompt corto y directo para modelos "schnell" (Cloudflare,
 * Pollinations, SiliconFlow, Segmind, HF por defecto, Together AI — ver
 * routes/IMAGE_PROVIDERS.md) a partir de un prompt ya envuelto por
 * buildColoringBookPrompt. Verificado empíricamente (2026-08-14) en LOS TRES:
 * la fórmula completa (~350 palabras) hace que estos modelos pierdan el
 * sujeto y dibujen algo genérico (repetidamente, un pájaro), incluso con el
 * sujeto extraído al frente — hace falta además destilarlo (quitar el ruido
 * de estilo repetido en theme/specs/details) para que quepa dentro de la
 * ventana de atención real del modelo.
 * Si el prompt no viene de la fórmula (no se encuentran los marcadores),
 * se devuelve tal cual — no hay nada que acortar.
 * Fail-safe heredado de distillVisualSubject: si el LLM de destilado falla,
 * usa el sujeto extraído sin destilar (sigue siendo mucho más corto que la
 * fórmula completa).
 */
export async function buildDistilledSchnellPrompt(prompt: string): Promise<string> {
    const rawSubject = extractColoringBookSubject(prompt);
    if (rawSubject === prompt) return prompt; // no es un prompt de fórmula — nada que hacer
    const { distillVisualSubject } = await import("./ai.js");
    const subject = await distillVisualSubject(rawSubject);
    return `black ink outline coloring book page, pure white background, no color, no shading, no gray fills, extra bold thick clean outlines, ready to color: ${subject}. Hands and paws hidden or obscured, no watermark, no text, no signature.`;
}

/**
 * Prompt específico para el endpoint anónimo de Pollinations (image.pollinations.ai,
 * modelo "sana" detrás según metadatos EXIF observados — distinto del "flux" del gateway
 * de pago). Verificado empíricamente (2026-08-14): con el mismo prompt que funciona bien
 * en el resto de proveedores, este pipeline devolvía ilustraciones realistas con textura
 * de lápiz/sombreado, incluso metidas dentro de un cuadro/caballete — ignoraba el estilo
 * por completo. Este template (probado en 3 iteraciones reales) mejora sustancialmente
 * el resultado — sujeto reconocible, fondo blanco correcto — pero el pipeline sigue
 * teniendo sesgos tercos hacia viñetas circulares y rellenos grises que ninguna
 * instrucción negativa elimina del todo. El gate de calidad/sujeto de jobs/catalog.ts
 * es la red de seguridad real para estos casos, no el prompt — ver routes/IMAGE_PROVIDERS.md.
 */
export async function buildAnonymousColoringBookPrompt(prompt: string): Promise<string> {
    const rawSubject = extractColoringBookSubject(prompt);
    if (rawSubject === prompt) return prompt; // no es un prompt de coloring-book — no forzar el estilo
    const { distillVisualSubject } = await import("./ai.js");
    const subject = await distillVisualSubject(rawSubject);
    return "simple cartoon coloring book page for children, black outline drawing only, pure white background, "
        + "bold thick black lines, flat 2D clean vector style, no shading, no color, no gray, no vignette, "
        + "no border, no frame, no circle, no globe, no background scenery beyond the subject: "
        + `${subject}, cartoon style, hand-drawn outline, isolated on plain white background`;
}

/**
 * Prompt por defecto de los modelos comunitarios gratis del gateway de Pollinations
 * (scriptsnsenses-sys/flux-2-dev-free y sdxl-lightning-free). El sujeto va entre
 * `prefix` y `suffix`. Verificado con generaciones reales (2026-10-07): con la
 * plantilla de buildDistilledSchnellPrompt estos modelos colorean la escena en
 * cuanto el sujeto trae una palabra con carga de color ("autumn" → árboles rojos
 * y naranjas). Describir la página como un objeto sin colorear, antes Y después
 * del sujeto, elimina la fuga de color con el mismo sujeto y seed.
 */
export const FREE_COMMUNITY_COLORING_TEMPLATE = {
    prefix: "uncolored black and white line art coloring page, only black outlines on a blank white page, "
        + "every area left empty white to be colored in later, bold clean lines: ",
    suffix: ". Monochrome, zero color, no fills, no shading, no dots, no hatching.",
} as const;

/**
 * Aplica FREE_COMMUNITY_COLORING_TEMPLATE. Si el prompt viene de la fórmula de
 * buildColoringBookPrompt se extrae y destila su sujeto. Si no viene de la
 * fórmula solo se envuelve cuando `wrapRaw` es true (el llamador sabe que es un
 * coloring-book); en otro caso se devuelve tal cual para no forzar blanco y
 * negro en pósters o patrones.
 */
export async function buildFreeCommunityColoringPrompt(prompt: string, opts: { wrapRaw?: boolean } = {}): Promise<string> {
    const { prefix, suffix } = FREE_COMMUNITY_COLORING_TEMPLATE;
    if (prompt.startsWith(prefix)) return prompt; // ya lleva la plantilla
    const rawSubject = extractColoringBookSubject(prompt);
    if (rawSubject === prompt && !opts.wrapRaw) return prompt;
    const { distillVisualSubject } = await import("./ai.js");
    const subject = (await distillVisualSubject(rawSubject)).trim().replace(/[.\s]+$/, "");
    return `${prefix}${subject}${suffix}`;
}
