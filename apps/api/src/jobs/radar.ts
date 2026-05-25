import type { Agenda, Job } from "agenda";
import { RadarJob } from "../models/radar-job.js";
import { EtsyNicheResultSchema, NicheInsightSchema, ETSY_SYSTEM_PROMPT, getHFKey } from "../routes/radar.js";

export const RADAR_JOB_NAME = "run-radar-analysis";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Returns true if the error is a permanent free-tier exhaustion (limit: 0)
function isHardQuota(err: any): boolean {
    const msg: string = err?.message ?? err?.toString() ?? "";
    return /limit:\s*0/i.test(msg);
}

// Extracts retry delay from Gemini messages like "retry in 26.2s"
function parseRetryMs(err: any): number | null {
    const msg: string = err?.message ?? err?.toString() ?? "";
    const match = msg.match(/retry in ([0-9.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000;
    if (/quota exceeded|rate limit|429/i.test(msg)) return 45000;
    return null;
}

async function runWithRetry<T>(fn: () => Promise<T>, onWait: (secs: number, attempt: number) => void, maxRetries = 1): Promise<T> {
    let lastErr: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            if (isHardQuota(err)) throw err; // quota diaria agotada — no tiene sentido reintentar
            const waitMs = parseRetryMs(err);
            if (waitMs !== null && attempt < maxRetries) {
                onWait(Math.round(waitMs / 1000), attempt + 1);
                await delay(waitMs);
                lastErr = err;
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

async function getGoogleKey(): Promise<string> {
    let key = process.env.GOOGLE_API_KEY ?? "";
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "GOOGLE_API_KEY" }).lean();
        if (row?.value) key = row.value as string;
    } catch { /* fallback to env */ }
    return key;
}

async function analyzeWithHF(pageText: string, mode: string, hfKey: string): Promise<any> {
    const { HfInference } = await import("@huggingface/inference");
    const hf = new HfInference(hfKey);

    const schemaHint = mode === "etsy-niches"
        ? `{"nichos_detectados":[{"titulo_producto":"string — título completo del listado","precio":"string — precio visible ej: '4,99 €'","bestseller":true/false,"personas_carrito":number,"total_reseñas":number,"sub_nicho_estimado":"string — micronicho deducido del título"}]}`
        : `{"niche":"string","competition":"low|medium|high","demand":"low|medium|high","trend":"rising|stable|declining","topKeywords":["string"],"priceRange":"string","topCompetitors":["string"],"entryOpportunity":"string","buyerProfile":"string","summary":"string"}`;

    const systemContent = mode === "etsy-niches"
        ? `${ETSY_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con un objeto JSON válido sin markdown ni explicaciones, con esta estructura exacta:\n${schemaHint}`
        : `Analiza la siguiente página de marketplace para investigar el nicho de mercado. Responde ÚNICAMENTE con un objeto JSON válido sin markdown ni explicaciones, con esta estructura exacta:\n${schemaHint}`;

    // Clean up whitespace and truncate (~14k chars ≈ 3500 tokens, fits 8B context comfortably)
    const truncated = pageText.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 14000);

    const response = await hf.chatCompletion({
        model: "meta-llama/Llama-3.3-70B-Instruct",
        messages: [
            { role: "system", content: systemContent },
            { role: "user", content: `Contenido de la página:\n\n${truncated}` },
        ],
        max_tokens: 4096,
        temperature: 0.1,
    });

    const text = (response.choices[0]?.message?.content ?? "").trim();
    // Extract JSON block — handle markdown fences or raw JSON
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) throw new Error(`HuggingFace no devolvió JSON válido. Respuesta: ${text.slice(0, 200)}`);
    return JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
}

function pushLog(jobDoc: InstanceType<typeof RadarJob>, io: any, level: "info" | "success" | "error" | "warning", message: string) {
    const entry = { timestamp: new Date(), level, message };
    jobDoc.logs.push(entry);
    io?.emit("radar:log", entry);
}

export function defineRadarJob(agenda: Agenda, io: any) {
    agenda.define(RADAR_JOB_NAME, async (job: Job) => {
        const { jobId } = (job.attrs.data ?? {}) as { jobId: string };

        const jobDoc = await RadarJob.findOne({ jobId });
        if (!jobDoc) { console.error(`[radar-job] No encontrado jobId=${jobId}`); return; }

        const { url, mode, nicheName, context, geminiModel = "gemini-2.0-flash" } = jobDoc as any;
        let browser: any = null;

        try {
            pushLog(jobDoc, io, "info", `[BROWSER] Lanzando navegador headless...`);
            await jobDoc.save();

            const { chromium } = await import("playwright");
            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();

            await page.setExtraHTTPHeaders({
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            });

            pushLog(jobDoc, io, "info", `[FETCH] Cargando página: ${url}`);
            await jobDoc.save();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

            if (mode === "etsy-niches") {
                pushLog(jobDoc, io, "info", `[FETCH] Scroll para cargar resultados lazy...`);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)");
                await page.waitForTimeout(1500);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
                await page.waitForTimeout(1000);
            }

            // Poda del DOM: elimina scripts, estilos y elementos inútiles (~80% menos tokens)
            await page.evaluate(`
                ["script","style","header","footer","noscript","iframe",
                 ".wt-b-badge","nav","svg","picture source"].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });
            `);

            pushLog(jobDoc, io, "success", `[FETCH] ✓ Página cargada y DOM podado`);
            await jobDoc.save();

            // Extract plain text for HF fallback (before Gemini call, browser still open)
            const pageText: string = (await page.evaluate('document.body.innerText') as string) ?? "";

            const googleKey = await getGoogleKey();
            let data: any;

            if (googleKey) {
                pushLog(jobDoc, io, "info", `[AI] Analizando con Gemini · modo: ${mode}...`);
                await jobDoc.save();

                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { default: LLMScraper } = await import("llm-scraper");
                const { Output } = await import("ai");

                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const scraper = new LLMScraper(google(geminiModel));

                try {
                    if (mode === "etsy-niches") {
                        const output = Output.object(EtsyNicheResultSchema as any);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: ETSY_SYSTEM_PROMPT }),
                            (secs, attempt) => {
                                const msg = `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`;
                                pushLog(jobDoc, io, "warning", msg);
                                jobDoc.save().catch(() => { });
                            }
                        );
                        data = result.data;
                        const count = (data?.nichos_detectados ?? []).length;
                        pushLog(jobDoc, io, "success", `[AI] ✓ ${count} productos/nichos detectados`);
                    } else {
                        const contextHint = [
                            nicheName ? `Niche objetivo: "${nicheName}".` : "",
                            context ? `Contexto adicional: ${context}.` : "",
                            "Analiza esta página de marketplace para investigar el nicho de mercado.",
                        ].filter(Boolean).join(" ");
                        const output = Output.object(NicheInsightSchema as any);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: contextHint || undefined }),
                            (secs, attempt) => {
                                const msg = `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`;
                                pushLog(jobDoc, io, "warning", msg);
                                jobDoc.save().catch(() => { });
                            }
                        );
                        data = result.data;
                        pushLog(jobDoc, io, "success", `[AI] ✓ Análisis completado`);
                    }
                } catch (geminiErr: any) {
                    if (!isHardQuota(geminiErr)) throw geminiErr;
                    // Hard quota — fall through to HF below
                    pushLog(jobDoc, io, "warning", `[QUOTA] Cuota diaria de Gemini agotada · intentando HuggingFace como respaldo...`);
                    await jobDoc.save();
                    data = null; // signal to use HF
                }
            }

            // HF fallback: used when no Google key, or Gemini hard-quota
            if (!data) {
                const hfKey = await getHFKey();
                if (!hfKey) {
                    throw new Error("Cuota de Gemini agotada y no hay HuggingFace API key configurada. Añade una en Ajustes.");
                }
                pushLog(jobDoc, io, "info", `[AI] Analizando con HuggingFace (Llama 3.3-70B) · modo: ${mode}...`);
                pushLog(jobDoc, io, "warning", `[INFO] HuggingFace puede tardar entre 30-90s — el modelo 70B se carga bajo demanda. Por favor, espera...`);
                await jobDoc.save();
                data = await analyzeWithHF(pageText, mode, hfKey);
                const count = (data?.nichos_detectados ?? []).length;
                const msg = mode === "etsy-niches"
                    ? `[AI] ✓ HuggingFace · ${count} productos detectados`
                    : `[AI] ✓ HuggingFace · análisis completado`;
                pushLog(jobDoc, io, "success", msg);
            }

            jobDoc.status = "completed";
            jobDoc.result = data;
            await jobDoc.save();

            io?.emit("radar:result", { jobId, mode, data });
            await page.close();
        } catch (err: any) {
            const msg = `[ERROR] ${err?.message ?? "Error desconocido"}`;
            pushLog(jobDoc, io, "error", msg);
            jobDoc.status = "failed";
            jobDoc.error = msg;
            await jobDoc.save();

            io?.emit("radar:error", { jobId, message: msg });
        } finally {
            if (browser) { try { await browser.close(); } catch { /* ignore */ } }
            io?.emit("radar:done", { jobId });
        }
    });
}
