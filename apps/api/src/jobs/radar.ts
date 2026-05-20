import type { Agenda, Job } from "agenda";
import { RadarJob } from "../models/radar-job.js";
import { EtsyNicheResultSchema, NicheInsightSchema, ETSY_SYSTEM_PROMPT } from "../routes/radar.js";

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
            pushLog(jobDoc, io, "info", `[AI] Analizando con Gemini · modo: ${mode}...`);
            await jobDoc.save();

            const googleKey = await getGoogleKey();
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const { default: LLMScraper } = await import("llm-scraper");
            const { Output } = await import("ai");

            const google = createGoogleGenerativeAI({ apiKey: googleKey });
            const scraper = new LLMScraper(google(geminiModel));

            let data: any;

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

            jobDoc.status = "completed";
            jobDoc.result = data;
            await jobDoc.save();

            io?.emit("radar:result", { jobId, mode, data });
            await page.close();
        } catch (err: any) {
            const msg = isHardQuota(err)
                ? `[QUOTA] Cuota diaria de Gemini agotada. Vuelve mañana o activa facturación en Google AI Studio.`
                : `[ERROR] ${err?.message ?? "Error desconocido"}`;

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
