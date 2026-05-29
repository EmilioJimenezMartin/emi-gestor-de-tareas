import type { Agenda, Job } from "agenda";
import { RadarJob } from "../models/radar-job.js";
import { EtsyNicheResultSchema, NicheInsightSchema, ETSY_SYSTEM_PROMPT, AMAZON_SYSTEM_PROMPT } from "../routes/radar.js";
import { analyzePageForRadar } from "../lib/ai.js";

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

function buildRadarSystemPrompt(mode: string, nicheName?: string, context?: string): string {
    const isListingMode = mode === "etsy-niches" || mode === "amazon-niches";
    const schemaHint = isListingMode
        ? `{"nichos_detectados":[{"titulo_producto":"string","precio":"string","bestseller":true/false,"personas_carrito":number,"total_reseñas":number,"sub_nicho_estimado":"string","url_producto":"string|undefined"}]}`
        : `{"niche":"string","competition":"low|medium|high","demand":"low|medium|high","trend":"rising|stable|declining","topKeywords":["string"],"priceRange":"string","topCompetitors":["string"],"entryOpportunity":"string","buyerProfile":"string","summary":"string"}`;

    if (mode === "amazon-niches") return `${AMAZON_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    if (mode === "etsy-niches") return `${ETSY_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`;
    return [
        nicheName ? `Niche objetivo: "${nicheName}".` : "",
        context ? `Contexto adicional: ${context}.` : "",
        `Analiza la página de marketplace. Responde ÚNICAMENTE con JSON válido sin markdown:\n${schemaHint}`,
    ].filter(Boolean).join(" ");
}

async function getActiveProvider(): Promise<string> {
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: "DEFAULT_LLM_PROVIDER" }).lean();
        return (row as any)?.value ?? "google";
    } catch { return "google"; }
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

        const { url, mode, nicheName, context, geminiModel = "gemini-2.0-flash", storageKey = "RADAR_ETSY_RESULT" } = jobDoc as any;
        let browser: any = null;

        try {
            pushLog(jobDoc, io, "info", `[BROWSER] Lanzando navegador headless (modo stealth)...`);
            await jobDoc.save();

            const { chromium } = await import("playwright");
            browser = await chromium.launch({
                headless: true,
                args: [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                ],
            });

            // Create a context with realistic browser fingerprint
            const browserCtx = await browser.newContext({
                viewport: { width: 1440, height: 900 },
                locale: "es-ES",
                timezoneId: "Europe/Madrid",
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                extraHTTPHeaders: {
                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"macOS"',
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Upgrade-Insecure-Requests": "1",
                },
            });

            // Mask all bot-detection signals before any page script runs
            await browserCtx.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", { get: () => undefined });
                // @ts-ignore
                window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
                Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, "languages", { get: () => ["es-ES", "es", "en-US", "en"] });
                Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
            });

            const page = await browserCtx.newPage();

            pushLog(jobDoc, io, "info", `[FETCH] Cargando página: ${url}`);
            await jobDoc.save();
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

            // Wait for JS hydration (SPAs like Etsy render after domcontentloaded)
            await page.waitForTimeout(2500);

            // Detect anti-bot / CAPTCHA screens before wasting time
            const pageTitle: string = await page.title().catch(() => "");
            if (/captcha|attention required|just a moment|checking|ddos-guard/i.test(pageTitle)) {
                throw new Error(`Página bloqueada por anti-bot: "${pageTitle}". Intenta de nuevo en unos minutos.`);
            }

            if (mode === "etsy-niches" || mode === "amazon-niches") {
                pushLog(jobDoc, io, "info", `[FETCH] Scroll para cargar resultados lazy...`);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)");
                await page.waitForTimeout(1500);
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
                await page.waitForTimeout(1500);
            }

            // Capture full HTML BEFORE pruning — this is what the HF fallback uses
            const rawHtml: string = await page.content().catch(() => "");
            const pageText = rawHtml
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/&[a-z#0-9]+;/gi, " ")
                .replace(/\s{2,}/g, " ")
                .trim();

            if (pageText.length < 500) {
                pushLog(jobDoc, io, "warning", `[FETCH] ⚠ Contenido corto (${pageText.length} chars) — posible bloqueo anti-bot`);
            } else {
                pushLog(jobDoc, io, "info", `[FETCH] ✓ ${pageText.length.toLocaleString()} chars extraídos`);
            }

            // Prune DOM for LLMScraper (Gemini) — after text capture, reduces token count
            await page.evaluate(`
                ["script","style","header","footer","noscript","iframe",
                 ".wt-b-badge","nav","svg","picture source"].forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });
            `);

            pushLog(jobDoc, io, "success", `[FETCH] ✓ DOM podado — listo para análisis`);
            await jobDoc.save();

            const activeProvider = await getActiveProvider();
            let data: any;

            // Google provider → use llm-scraper (structured DOM extraction, most accurate)
            if (activeProvider === "google") {
                const googleKey = await getGoogleKey();
                if (!googleKey) throw new Error("Google API key no configurada. Añádela en Ajustes.");
                pushLog(jobDoc, io, "info", `[AI] Analizando con Gemini (${geminiModel}) · modo: ${mode}...`);
                await jobDoc.save();

                const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
                const { default: LLMScraper } = await import("llm-scraper");
                const { Output } = await import("ai");

                const google = createGoogleGenerativeAI({ apiKey: googleKey });
                const scraper = new LLMScraper(google(geminiModel));

                try {
                    if (mode === "etsy-niches" || mode === "amazon-niches") {
                        const systemPrompt = mode === "amazon-niches" ? AMAZON_SYSTEM_PROMPT : ETSY_SYSTEM_PROMPT;
                        const output = Output.object(EtsyNicheResultSchema as any);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: systemPrompt }),
                            (secs, attempt) => {
                                pushLog(jobDoc, io, "warning", `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`);
                                jobDoc.save().catch(() => {});
                            }
                        );
                        data = result.data;
                    } else {
                        const output = Output.object(NicheInsightSchema as any);
                        const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                        const result = await runWithRetry(
                            () => scraper.run(page, output, { format: "markdown", system: systemPrompt }),
                            (secs, attempt) => {
                                pushLog(jobDoc, io, "warning", `[QUOTA] Límite RPM · esperando ${secs}s (intento ${attempt}/1)...`);
                                jobDoc.save().catch(() => {});
                            }
                        );
                        data = result.data;
                    }
                    const count = (data?.nichos_detectados ?? []).length;
                    pushLog(jobDoc, io, "success",
                        (mode === "etsy-niches" || mode === "amazon-niches")
                            ? `[AI] ✓ Gemini · ${count} productos detectados`
                            : `[AI] ✓ Gemini · análisis completado`
                    );
                } catch (geminiErr: any) {
                    if (!isHardQuota(geminiErr)) throw geminiErr;
                    pushLog(jobDoc, io, "warning", `[QUOTA] Cuota diaria de Gemini agotada → buscando siguiente provider...`);
                    await jobDoc.save();
                    // Fall through to text-based chain, skip google since it's exhausted
                    const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                    data = await analyzePageForRadar(pageText, systemPrompt, {
                        skipProviders: ["google"],
                        onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                    });
                }
            } else {
                // Any other provider (openrouter, groq, huggingface) → text-based extraction with fallback
                if (activeProvider === "huggingface") {
                    pushLog(jobDoc, io, "warning", `[INFO] HuggingFace puede tardar entre 30-90s. Por favor, espera...`);
                }
                await jobDoc.save();
                const systemPrompt = buildRadarSystemPrompt(mode, nicheName, context);
                pushLog(jobDoc, io, "info", `[AI] Analizando con ${activeProvider} · modo: ${mode}...`);
                data = await analyzePageForRadar(pageText, systemPrompt, {
                    onLog: (msg) => { pushLog(jobDoc, io, "warning", msg); void jobDoc.save(); },
                });
            }

            if (data) {
                const count = (data?.nichos_detectados ?? []).length;
                if (mode === "etsy-niches" || mode === "amazon-niches") {
                    pushLog(jobDoc, io, "success", `[AI] ✓ ${count} productos detectados`);
                } else {
                    pushLog(jobDoc, io, "success", `[AI] ✓ Análisis completado`);
                }
            }

            // Stamp detection date and source on every listing
            if (data?.nichos_detectados) {
                const ts = new Date().toISOString();
                const fuente = mode === "amazon-niches" ? "amazon" : mode === "etsy-niches" ? "etsy" : "general";
                data.nichos_detectados = (data.nichos_detectados as any[]).map(n => ({ ...n, fecha_detectado: ts, fuente: n.fuente ?? fuente }));
            }

            jobDoc.status = "completed";
            jobDoc.result = data;
            await jobDoc.save();

            // Merge with existing saved results and persist — frontend may not be mounted
            let dataToEmit = data;
            try {
                const { Settings } = await import("../models/settings.js");

                if (data?.nichos_detectados) {
                    // Merge: preserve existing rows not in this scan, keep _nichoCreado flags
                    const existing = await Settings.findOne({ key: storageKey }).lean() as any;
                    if (existing?.value) {
                        try {
                            const saved = JSON.parse(existing.value);
                            if (saved?.nichos_detectados?.length) {
                                const incoming: any[] = data.nichos_detectados;
                                const incomingTitles = new Set(incoming.map((r: any) => r.titulo_producto));
                                const preserved = (saved.nichos_detectados as any[]).filter(
                                    r => !incomingTitles.has(r.titulo_producto)
                                );
                                const merged = incoming.map((r: any) => ({
                                    ...r,
                                    _nichoCreado: (saved.nichos_detectados as any[]).find(
                                        (s: any) => s.titulo_producto === r.titulo_producto
                                    )?._nichoCreado ?? r._nichoCreado,
                                }));
                                dataToEmit = { ...data, nichos_detectados: [...merged, ...preserved] };
                            }
                        } catch { /* keep dataToEmit = data */ }
                    }
                }

                await Settings.findOneAndUpdate(
                    { key: storageKey },
                    { key: storageKey, value: JSON.stringify(dataToEmit) },
                    { upsert: true }
                );
            } catch (settingsErr) {
                console.warn("[radar-job] No se pudo guardar en Settings:", settingsErr);
            }

            io?.emit("radar:result", { jobId, mode, storageKey, data: dataToEmit });

            // Send Telegram summary on success
            try {
                const { sendTelegram } = await import("../lib/telegram.js");
                const count = (dataToEmit?.nichos_detectados ?? []).length;
                const modeLabel = mode === "etsy-niches" ? "Etsy" : mode === "amazon-niches" ? "Amazon" : "General";
                await sendTelegram(
                    `✅ <b>Radar completado — ${modeLabel}</b>\n\n` +
                    (count > 0
                        ? `🔍 <b>${count} productos detectados</b>\n`
                        : `📊 Análisis completado\n`) +
                    `<b>URL:</b> ${url}`
                );
            } catch { /* Telegram not configured — ignore */ }

            await page.close();
        } catch (err: any) {
            const msg = `[ERROR] ${err?.message ?? "Error desconocido"}`;
            pushLog(jobDoc, io, "error", msg);
            jobDoc.status = "failed";
            jobDoc.error = msg;
            await jobDoc.save();

            io?.emit("radar:error", { jobId, message: msg });

            // Notify via Telegram if configured
            try {
                const { sendTelegram } = await import("../lib/telegram.js");
                await sendTelegram(
                    `⚠️ <b>Radar — Todos los providers fallaron</b>\n\n` +
                    `<b>URL:</b> ${url}\n` +
                    `<b>Modo:</b> ${mode}\n` +
                    `<b>Error:</b> ${err?.message ?? "Desconocido"}`
                );
            } catch { /* Telegram not configured — ignore */ }
        } finally {
            if (browser) { try { await browser.close(); } catch { /* ignore */ } }
            io?.emit("radar:done", { jobId });
        }
    });
}
