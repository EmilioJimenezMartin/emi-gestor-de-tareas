import type { Agenda, Job } from "agenda";
import { chromium } from "playwright";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { sendTelegram, shouldNotify } from "../lib/telegram.js";
import path from "path";
import os from "os";
import fs from "fs/promises";

export const KDP_PUBLISHER_JOB_NAME = "kdp-publish";

const SESSION_FILE = path.join(os.tmpdir(), "kdp-browser-session.json");

async function getKdpConfig(): Promise<{
    email: string; password: string; authorName: string; price: string;
} | null> {
    try {
        const rows = await Settings.find({
            key: { $in: ["KDP_EMAIL", "KDP_PASSWORD", "KDP_AUTHOR_NAME", "KDP_DEFAULT_PRICE"] },
        }).lean();
        const map = new Map((rows as any[]).map((r: any) => [r.key, r.value]));
        const email = ((map.get("KDP_EMAIL") as string)?.trim()) || process.env.KDP_EMAIL?.trim() || "";
        const password = ((map.get("KDP_PASSWORD") as string)?.trim()) || process.env.KDP_PASSWORD?.trim() || "";
        const authorName = ((map.get("KDP_AUTHOR_NAME") as string)?.trim()) || "Author";
        const price = ((map.get("KDP_DEFAULT_PRICE") as string)?.trim()) || "8.99";
        if (!email || !password) return null;
        return { email, password, authorName, price };
    } catch {
        return null;
    }
}

async function downloadToFile(url: string, dest: string): Promise<void> {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function waitForOtp(timeoutMs = 5 * 60_000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 5_000));
        const row = await Settings.findOne({ key: "KDP_OTP_CODE" }).lean();
        const code = (row as any)?.value?.trim();
        if (code) {
            await Settings.deleteOne({ key: "KDP_OTP_CODE" });
            return code;
        }
    }
    return null;
}

export function defineKdpPublisherJob(agenda: Agenda, io: any): void {
    const handler = async (job: Job) => {
        const { nicheId } = (job.attrs.data ?? {}) as { nicheId: string };
        const tag = `[kdp-publisher][${nicheId}]`;

        const niche = await Niche.findById(nicheId).lean();
        if (!niche) { console.error(`${tag} Niche not found`); return; }

        const n = niche as any;
        const listing = n.listings?.[0];

        if (!listing?.title) {
            if (await shouldNotify("kdp.error")) await sendTelegram(`❌ <b>KDP</b> · <b>${n.name}</b>\nFalta el listing SEO (título, descripción, keywords)`);
            return;
        }
        if (!n.bookPdfUrl) {
            if (await shouldNotify("kdp.error")) await sendTelegram(`❌ <b>KDP</b> · <b>${n.name}</b>\nFalta el PDF del libro`);
            return;
        }

        const cfg = await getKdpConfig();
        if (!cfg) {
            if (await shouldNotify("kdp.error")) {
                await sendTelegram(
                    `❌ <b>KDP sin credenciales</b>\n` +
                    `Configura en Ajustes:\n` +
                    `<code>KDP_EMAIL</code> · <code>KDP_PASSWORD</code>\n` +
                    `<code>KDP_AUTHOR_NAME</code> · <code>KDP_DEFAULT_PRICE</code>`
                );
            }
            return;
        }

        const tmpFiles: string[] = [];
        let browser: any;

        try {
            io?.emit("kdp:status", { nicheId, status: "starting" });
            const notifyProgress = await shouldNotify("kdp.progress");
            if (notifyProgress) await sendTelegram(`⏳ <b>KDP Upload iniciado</b>\n📚 <b>${n.name}</b>\nDescargando archivos…`);

            // ── Download PDF and cover to temp files ──────────────────────────
            const pdfPath  = path.join(os.tmpdir(), `kdp-${nicheId}-interior.pdf`);
            const covPath  = path.join(os.tmpdir(), `kdp-${nicheId}-cover.jpg`);
            tmpFiles.push(pdfPath, covPath);

            await downloadToFile(n.bookPdfUrl, pdfPath);
            console.log(`${tag} PDF downloaded: ${pdfPath}`);

            if (n.coverUrl) {
                await downloadToFile(n.coverUrl, covPath).catch(e =>
                    console.warn(`${tag} Cover download failed (will skip): ${e.message}`)
                );
            }

            // ── Launch browser ────────────────────────────────────────────────
            let storageState: any;
            try { storageState = JSON.parse(await fs.readFile(SESSION_FILE, "utf-8")); } catch { /* fresh */ }

            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({
                storageState,
                userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            });
            const page = await context.newPage();

            // ── Login if needed ───────────────────────────────────────────────
            await page.goto("https://kdp.amazon.com/en_US/title-setup/paperback/new/details", {
                waitUntil: "networkidle",
                timeout: 30_000,
            });

            // If redirected to login page
            if (page.url().includes("signin") || page.url().includes("ap/signin")) {
                console.log(`${tag} Logging in…`);
                io?.emit("kdp:status", { nicheId, status: "login" });
                if (notifyProgress) await sendTelegram(`🔑 <b>KDP</b> · Iniciando sesión…`);

                await page.locator("#ap_email").fill(cfg.email);
                await page.locator("#continue").click();
                await page.waitForTimeout(2_000);
                await page.locator("#ap_password").fill(cfg.password);
                await page.locator("#signInSubmit").click();
                await page.waitForTimeout(3_000);

                // OTP / 2FA
                const otpVisible = await page.locator("#auth-mfa-otpcode").isVisible().catch(() => false);
                if (otpVisible) {
                    // 2FA is always sent — user must receive this to proceed
                    await sendTelegram(
                        `🔐 <b>KDP requiere verificación 2FA</b>\n\n` +
                        `Envía el código con:\n<code>/kdpotp XXXXXX</code>\n\n` +
                        `<i>Tienes 5 minutos</i>`
                    );
                    io?.emit("kdp:status", { nicheId, status: "awaiting-otp" });

                    const otp = await waitForOtp(5 * 60_000);
                    if (!otp) throw new Error("Timeout esperando código OTP (5 min)");

                    await page.locator("#auth-mfa-otpcode").fill(otp);
                    await page.locator("#auth-signin-button").click();
                    await page.waitForTimeout(3_000);
                }

                // Persist session after successful login
                const session = await context.storageState();
                await fs.writeFile(SESSION_FILE, JSON.stringify(session));
                console.log(`${tag} Session saved`);

                // Navigate to new paperback form
                await page.goto("https://kdp.amazon.com/en_US/title-setup/paperback/new/details", {
                    waitUntil: "networkidle",
                    timeout: 30_000,
                });
            }

            io?.emit("kdp:status", { nicheId, status: "filling-form" });
            await page.waitForTimeout(2_000);

            // ── Book Details ──────────────────────────────────────────────────
            // Title
            await page.locator("#data-print-book-title").fill(listing.title.slice(0, 200)).catch(async () => {
                await page.locator('input[name="title"]').fill(listing.title.slice(0, 200)).catch(() => {});
            });

            // Subtitle
            if (listing.subtitle) {
                await page.locator("#data-print-book-subtitle").fill(listing.subtitle.slice(0, 200)).catch(() => {});
            }

            // Author name split
            const parts = cfg.authorName.trim().split(/\s+/);
            const firstName = parts.slice(0, -1).join(" ") || cfg.authorName;
            const lastName  = parts.slice(-1)[0] || "";
            await page.locator("#data-print-book-contributors-0-first-name").fill(firstName).catch(() => {});
            await page.locator("#data-print-book-contributors-0-last-name").fill(lastName).catch(() => {});

            // Description — KDP uses a contenteditable rich-text area
            const descSelectors = [
                ".book-description-editor [contenteditable]",
                "#data-print-book-description",
                "textarea[name='description']",
            ];
            for (const sel of descSelectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await el.click();
                    await page.keyboard.press("Control+A");
                    await page.keyboard.type(listing.description.slice(0, 4_000), { delay: 2 });
                    break;
                }
            }

            // Keywords (7 fields)
            const keywords: string[] = listing.keywords ?? [];
            for (let k = 0; k < Math.min(keywords.length, 7); k++) {
                await page.locator(`#data-print-book-keywords-${k}`).fill(keywords[k]).catch(() => {});
            }

            // Save and continue → Content tab
            await page.locator("button[data-action='save-and-continue'], button:has-text('Save and Continue')").first().click();
            await page.waitForTimeout(4_000);
            io?.emit("kdp:status", { nicheId, status: "uploading-pdf" });

            // ── Content tab ───────────────────────────────────────────────────
            // Interior PDF upload
            const fileInputs = await page.locator("input[type='file']").all();
            if (fileInputs.length > 0) {
                await fileInputs[0].setInputFiles(pdfPath);
                if (notifyProgress) await sendTelegram(`📤 <b>KDP</b> · Subiendo PDF interior…`);
                // Wait for upload progress to settle (up to 3 min for large PDFs)
                await page.waitForTimeout(20_000);
                try {
                    await page.waitForSelector(".upload-complete, .upload-success, [data-status='complete']", {
                        timeout: 3 * 60_000,
                    });
                } catch { /* continue regardless */ }
            }

            // Cover upload (if cover exists)
            const coverExists = await fs.stat(covPath).then(() => true).catch(() => false);
            if (coverExists && fileInputs.length > 1) {
                await fileInputs[1].setInputFiles(covPath);
                if (notifyProgress) await sendTelegram(`🎨 <b>KDP</b> · Subiendo portada…`);
                await page.waitForTimeout(15_000);
            }

            // Save and continue → Pricing tab
            await page.locator("button[data-action='save-and-continue'], button:has-text('Save and Continue')").first().click();
            await page.waitForTimeout(4_000);
            io?.emit("kdp:status", { nicheId, status: "setting-price" });

            // ── Rights & Pricing ──────────────────────────────────────────────
            // US price
            await page.locator("#data-print-book-price-us, input[name='listPrice']").first().fill(cfg.price).catch(() => {});

            // Save as draft
            await page.locator("button[data-action='save-and-continue'], button:has-text('Save as Draft'), button:has-text('Save')").first().click();
            await page.waitForTimeout(3_000);

            // Persist updated session
            const finalSession = await context.storageState();
            await fs.writeFile(SESSION_FILE, JSON.stringify(finalSession));

            // Try to extract ASIN from current URL
            const finalUrl = page.url();
            const asinMatch = finalUrl.match(/\/([A-Z0-9]{10})\//);
            const asin = asinMatch?.[1];

            await Niche.findByIdAndUpdate(nicheId, {
                $set: { ...(asin ? { asin } : {}), phase: "published" },
            });
            io?.emit("niches:updated");
            io?.emit("kdp:status", { nicheId, status: "done" });

            if (await shouldNotify("kdp.done")) {
                await sendTelegram(
                    `✅ <b>KDP borrador guardado</b>\n` +
                    `📚 <b>${n.name}</b>\n` +
                    `📝 ${listing.title}\n` +
                    (asin ? `🆔 ASIN: <code>${asin}</code>\n` : "") +
                    `\n🔗 <a href="https://kdp.amazon.com/en_US/bookshelf">Revisar y publicar →</a>`
                );
            }
            console.log(`${tag} Done${asin ? ` — ASIN: ${asin}` : ""}`);

        } catch (e: any) {
            console.error(`${tag} Error:`, e.message);
            io?.emit("kdp:status", { nicheId, status: "error", message: e.message });
            if (await shouldNotify("kdp.error")) await sendTelegram(
                `❌ <b>KDP error</b>\n📚 <b>${n.name}</b>\n\n` +
                `<i>${e.message.slice(0, 300)}</i>\n\n` +
                `Intenta de nuevo con <code>/kdp ${String(nicheId).slice(-8)}</code>`
            ).catch(() => {});
        } finally {
            if (browser) { try { await browser.close(); } catch { /* ignore */ } }
            for (const f of tmpFiles) { fs.unlink(f).catch(() => {}); }
        }
    };

    agenda.define(KDP_PUBLISHER_JOB_NAME, handler, { lockLifetime: 20 * 60 * 1000 });
}
