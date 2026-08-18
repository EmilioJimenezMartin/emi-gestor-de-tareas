import { generateVisionWithLLMFromBuffer } from "./ai.js";

export interface SubjectCheckResult {
    ok: boolean;
    reason?: string;
}

const CHECK_TIMEOUT_MS = 20_000;

/**
 * Verifica con visión (Gemini) que la imagen generada muestra el sujeto
 * pedido. Existe porque los modelos "schnell" (Cloudflare, SiliconFlow,
 * Segmind, Hugging Face, Together AI — ver routes/IMAGE_PROVIDERS.md) son
 * probabilísticos: a veces ignoran el sujeto por completo y dibujan otra
 * cosa (verificado repetidamente: un loro, un gallo, un pájaro/mariposa,
 * pidiendo escenas de jardín japonés). El control de calidad por píxeles de
 * jobs/catalog.ts no detecta esto — una imagen bien entintada en blanco y
 * negro de un sujeto incorrecto pasa ese control igual — así que este es el
 * único check que compara la imagen contra lo que realmente se pidió.
 *
 * Fail-safe por diseño: cualquier fallo de la verificación en sí (cuota,
 * proveedor no-Google, timeout, respuesta rara) cuenta como "ok" — nunca debe
 * bloquear ni reintentar un catálogo por un problema de infraestructura ajeno
 * a si la imagen es correcta.
 */
export async function verifySubjectFidelity(imageBuffer: Buffer, subjectDescription: string): Promise<SubjectCheckResult> {
    const subject = subjectDescription.trim();
    if (subject.length < 8) return { ok: true }; // nada específico que verificar

    try {
        const system = "You are a strict visual QA checker for a coloring-book image generator. "
            + "You will be shown a black-and-white line-art coloring page and the subject it was "
            + "supposed to depict. Respond with ONLY compact JSON: "
            + '{"matches": boolean, "reason": "short explanation in Spanish"}. '
            + '"matches" must be false if the image\'s MAIN subject is clearly different from what '
            + "was requested (e.g. a different animal, object, or scene type — a bird when a garden "
            + "was requested, a generic pattern when a specific scene was requested), even if the "
            + "line-art style itself is correct. Minor omissions of secondary background details are "
            + "fine — judge only whether the main subject is right.";
        const userPrompt = `Sujeto pedido: "${subject.slice(0, 400)}"\n\n¿La imagen muestra este sujeto?`;

        const raw = await Promise.race([
            generateVisionWithLLMFromBuffer(system, userPrompt, imageBuffer, "image/png"),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error("subject-check timeout")), CHECK_TIMEOUT_MS)),
        ]);

        const parsed = JSON.parse(raw);
        if (typeof parsed?.matches !== "boolean") throw new Error(`respuesta inesperada: ${raw.slice(0, 120)}`);
        return { ok: parsed.matches, reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : undefined };
    } catch (e: any) {
        console.warn(`[subject-check] Saltado (fail-safe): ${e?.message ?? e}`);
        return { ok: true, reason: "subject-check-skipped" };
    }
}
