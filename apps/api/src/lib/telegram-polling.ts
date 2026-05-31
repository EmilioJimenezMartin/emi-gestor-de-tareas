import { getUpdates, answerCallbackQuery, editTelegramMessage, sendTelegram, pinTelegramMessage, sendTelegramImageBinary, sendTelegramButtons } from "./telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";
import { activateNextQueued } from "./catalog-queue.js";
import { withImageSlot } from "./ai-semaphore.js";

// ── Command registry — add entries here to auto-include them in /ayuda ────────
// Use &lt; &gt; instead of < > to avoid Telegram HTML parse errors
const COMMANDS: Array<{ cmd?: string; desc?: string; section?: string }> = [
    { section: "📚 Nichos" },
    { cmd: "/crear <code>nombre</code>",   desc: "Crea nicho. Prefijos: <code>printable</code> · <code>patron</code> · <code>ilustracion</code> · <code>foto</code> · <code>libro de colorear</code>" },
    { cmd: "/img <code>prompt</code>",    desc: "Genera imagen de prueba. Prefijos: <code>anime</code> · <code>realista</code>. Ej: /img anime A fox in a forest" },
    { cmd: "/nichos",                      desc: "Lista nichos activos con ID corto" },
    { cmd: "/nicho <code>id</code>",       desc: "Detalle de un nicho por ID" },
    { cmd: "/pdf <code>id</code>",         desc: "Abre el PDF de un nicho en la app" },
    { section: "🖼️ Catálogos" },
    { cmd: "/catalogo",                    desc: "Lista catálogos recientes con ID corto" },
    { cmd: "/catalogo <code>id</code>",    desc: "Detalle de un catálogo por ID" },
    { cmd: "/cat <code>id</code> [imgs] [prompt]",  desc: "Crea catálogo para un nicho. Ej: /cat a3b2 8 A dragon with thick outlines" },
    { cmd: "/retry <code>id</code>",       desc: "Reintenta catálogos fallidos de un nicho" },
    { section: "⚙️ Pipeline" },
    { cmd: "/estado",                      desc: "Lista rápida: nicho + ID + fase actual" },
    { cmd: "/pipeline",                    desc: "Estado detallado con progreso de imágenes" },
    { cmd: "/run",                         desc: "Lanza Auto-Pilot ahora" },
    { cmd: "/avanzar <code>id</code> [fase]", desc: "Avanza nicho a siguiente fase o a fase concreta. Fases: catalog libro seo cover published" },
    { cmd: "/parar",                       desc: "Detiene todo el pipeline" },
    { cmd: "/parar <code>id</code>",       desc: "Detiene solo ese nicho" },
    { cmd: "/cola",                        desc: "Cola de generación de catálogos" },
    { cmd: "/config",                        desc: "Ver configuración del Auto-Pilot" },
    { cmd: "/config <code>cats imgs [nichos]</code>", desc: "Ej: /config 1 1 1 (prueba) · /config 8 5 3 (prod)" },
    { cmd: "/status",                      desc: "Acciones de Telegram pendientes" },
    { section: "🔮 Descubrimiento" },
    { cmd: "/sugerir",                       desc: "IA sugiere un nicho con potencial no explorado (cualquier tipo)" },
    { cmd: "/sugerir <code>tipo</code>",     desc: "Sugiere para un tipo concreto: <code>colorear</code> · <code>poster</code> · <code>patron</code>" },
    { section: "📦 KDP" },
    { cmd: "/kdp <code>id</code>",            desc: "Sube el libro a KDP (requiere PDF + SEO + credenciales)" },
    { cmd: "/kdpotp <code>XXXXXX</code>",     desc: "Envía código OTP si KDP solicita verificación 2FA" },
    { section: "❓ Ayuda" },
    { cmd: "/ayuda",                       desc: "Este mensaje de ayuda" },
];

function formatElapsed(date: Date | string | undefined): string {
    if (!date) return "fecha desconocida";
    const ms = Date.now() - new Date(date).getTime();
    if (ms < 0) return "ahora mismo";
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr  = Math.floor(min / 60);
    const days = Math.floor(hr / 24);
    if (days >= 2)  return `${days} días`;
    if (days === 1) return `1 día ${hr % 24}h`;
    if (hr >= 1)    return `${hr}h ${min % 60}min`;
    if (min >= 1)   return `${min}min`;
    return `${sec}s`;
}

function buildHelpText(): string {
    const lines: string[] = [`🤖 <b>Emi Gestor — Comandos</b>\n`];
    for (const entry of COMMANDS) {
        if (entry.section) {
            lines.push(`\n${entry.section}`);
        } else {
            lines.push(`<code>${entry.cmd}</code> — ${entry.desc}`);
        }
    }
    return lines.join("\n");
}

let offset = 0;
let running = false;
let pollTimer: NodeJS.Timeout | null = null;
let _io: any = null;
let _agenda: any = null;

async function getAutoPilotConfig() {
    try {
        const rows = await Settings.find({
            key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG", "AUTOPILOT_MAX_NICHES"] },
        }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        return {
            catalogsPerNiche: parseInt((map.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "8") || 8,
            imagesPerCatalog: parseInt((map.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5,
            maxNichesPerRun: parseInt((map.get("AUTOPILOT_MAX_NICHES") as string) ?? "3") || 3,
        };
    } catch {
        return { catalogsPerNiche: 8, imagesPerCatalog: 5, maxNichesPerRun: 3 };
    }
}

async function handleNicheDiscovery(
    tAction: InstanceType<typeof TelegramAction>,
    decision: "continuar" | "omitir" | "descartar"
): Promise<string> {
    if (decision === "continuar") {
        const cfg = await getAutoPilotConfig();
        const niche = await Niche.findByIdAndUpdate(
            tAction.nicheId,
            { $set: { autoPilotEnabled: true, status: "active", phase: "catalog" } },
            { new: true }
        ).lean();

        _io?.emit("niches:updated");
        _io?.emit("telegram:notification", {
            message: `🚀 Pipeline lanzado desde Telegram · ${tAction.nicheName}`,
            type: "success",
        });
        await sendTelegram(
            `🚀 <b>Pipeline lanzado</b>\n` +
            `📚 <b>${tAction.nicheName}</b>\n\n` +
            `Creando <b>${cfg.catalogsPerNiche} catálogos</b> × <b>${cfg.imagesPerCatalog} imágenes</b>…`
        );

        // Directly create catalogs without relying on the autopilot scheduler
        setImmediate(async () => {
            try {
                const port = process.env.PORT || 3001;
                const base = `http://localhost:${port}`;
                const n = niche as any;

                // Mirror the model selection from autopilot.ts styleToAiModel
                const styleCategory = n?.styleCategory ?? "generic";
                const modelIds: Record<string, string> = {
                    anime: "flux-anime", realistic: "flux-realism",
                    illustration: "flux-realism", "wall-art": "flux-realism",
                    affirmation: "flux-realism", geometric: "flux-realism",
                    celestial: "flux-realism",
                };
                const modelId = modelIds[styleCategory] ?? "flux";
                const aiModel = { id: `pollinations-${modelId}`, name: "FLUX (Pollinations)", provider: "Pollinations", modelId };

                let created = 0;
                for (let i = 0; i < cfg.catalogsPerNiche; i++) {
                    try {
                        const res = await fetch(`${base}/catalogs`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: `${tAction.nicheName} — v${i + 1}`,
                                prompt: n?.generatedPrompt || tAction.nicheName,
                                totalImages: cfg.imagesPerCatalog,
                                aiModel,
                                nicheIds: [String(tAction.nicheId)],
                                productType: n?.productType ?? "coloring-book",
                            }),
                        });
                        if (res.ok) created++;
                    } catch { /* continue on error */ }
                    // Small delay so catalogs queue up cleanly
                    await new Promise(r => setTimeout(r, 300));
                }

                _io?.emit("niches:updated");
                _io?.emit("catalogs:updated");
                console.log(`[telegram-poll] Created ${created}/${cfg.catalogsPerNiche} catalogs for niche ${tAction.nicheName}`);

                if (created > 0) {
                    await sendTelegram(`🏭 <b>${tAction.nicheName}</b>\n🖼️ ${created} catálogos en generación · ${created * cfg.imagesPerCatalog} imágenes totales`).catch(() => {});
                } else {
                    // Fallback: schedule autopilot run to handle it
                    try {
                        if (_agenda) await _agenda.now("autopilot-run", {});
                        else await fetch(`${base}/autopilot/run`, { method: "POST" });
                    } catch { /* non-critical */ }
                }
            } catch (e) {
                console.error("[telegram-poll] Error creating catalogs after approval:", e);
            }
        });

        return `✅ Lanzado — ${cfg.catalogsPerNiche} catálogos en producción`;
    }

    if (decision === "omitir") {
        await sendTelegram(`⏭️ <b>Nicho omitido</b>\n<b>${tAction.nicheName}</b> — quedará para la próxima ejecución`);
        return "⏭️ Omitido — volvemos en la próxima ejecución";
    }

    if (decision === "descartar") {
        const niche = await Niche.findById(tAction.nicheId).lean();

        if (niche) {
            // Delete Cloudinary sample image linked to this niche
            try {
                const port = process.env.PORT || 3001;
                const base = `http://localhost:${port}`;
                const imagesRes = await fetch(`${base}/cloudinary/images`);
                if (imagesRes.ok) {
                    const { images } = await imagesRes.json() as { images: any[] };
                    const linked = images.find(img => img.nicheId === String((niche as any)._id));
                    if (linked?.publicId) {
                        await fetch(`${base}/cloudinary/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ publicId: linked.publicId }),
                        });
                    }
                }
            } catch { /* non-critical */ }

            // Remove entry from radar settings
            if ((niche as any).sourceTitulo) {
                try {
                    const radarKeys = ["RADAR_ETSY_RESULT", "RADAR_AMAZON_RESULT", "RADAR_GENERAL_RESULT"];
                    for (const key of radarKeys) {
                        const row = await Settings.findOne({ key }).lean();
                        if (row?.value) {
                            const saved = JSON.parse(row.value as string);
                            if (Array.isArray(saved?.nichos_detectados)) {
                                saved.nichos_detectados = saved.nichos_detectados.filter(
                                    (r: any) => r.titulo_producto !== (niche as any).sourceTitulo
                                );
                                await Settings.findOneAndUpdate({ key }, { $set: { value: JSON.stringify(saved) } });
                            }
                        }
                    }
                } catch { /* non-critical */ }
            }
        }

        // Delete niche entirely
        await Niche.findByIdAndDelete(tAction.nicheId);
        _io?.emit("niches:updated");
        _io?.emit("telegram:notification", { message: `🗑️ Nicho eliminado desde Telegram · ${tAction.nicheName}`, type: "info" });
        await sendTelegram(`🗑️ <b>Nicho eliminado</b>\n<b>${tAction.nicheName}</b> — borrado definitivamente`);
        return "🗑️ Eliminado";
    }

    return "";
}

async function handlePhaseApproval(
    tAction: InstanceType<typeof TelegramAction>,
    approved: boolean
): Promise<string> {
    if (approved) {
        await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { phase: tAction.targetPhase } });
        _io?.emit("niches:updated");
        _io?.emit("telegram:notification", {
            message: `✅ Fase aprobada desde Telegram · ${tAction.nicheName} → ${tAction.targetPhase}`,
            type: "success",
        });
        await sendTelegram(`🚀 <b>Pipeline avanzado</b>\n<b>${tAction.nicheName}</b> → fase <b>${tAction.targetPhase}</b>`);
        // Trigger next pipeline step
        setImmediate(async () => {
            try {
                if (_agenda) { await _agenda.now("autopilot-run", {}); }
            } catch { /* non-critical */ }
        });
        return `✅ Avanzando a ${tAction.targetPhase}`;
    } else {
        await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { autoPilotEnabled: false } });
        _io?.emit("niches:updated");
        _io?.emit("telegram:notification", {
            message: `⏸️ Pipeline pausado desde Telegram · ${tAction.nicheName}`,
            type: "warning",
        });
        await sendTelegram(`⏸️ <b>Pipeline pausado</b>\n<b>${tAction.nicheName}</b> — Auto-Pilot desactivado`);
        return "❌ Pipeline pausado";
    }
}

// Returns true if the sender is whitelisted (or no whitelist is configured)
async function isAllowedUser(update: any): Promise<boolean> {
    try {
        const row = await Settings.findOne({ key: "ALLOWED_TELEGRAM_USER_IDS" }).lean();
        const raw = (row as any)?.value as string | undefined;
        if (!raw?.trim()) return true; // no whitelist — allow all
        const allowed = raw.split(",").map(s => s.trim()).filter(Boolean);
        const userId = String(
            update.message?.from?.id ?? update.callback_query?.from?.id ?? ""
        );
        return allowed.includes(userId);
    } catch {
        return true; // fail open
    }
}

async function processUpdate(update: any): Promise<void> {
    // Privacy guard
    if (!(await isAllowedUser(update))) return;

    // Handle inline keyboard button presses
    if (update.callback_query) {
        const cq = update.callback_query;
        const data: string = cq.data ?? "";
        const colonIdx = data.indexOf(":");
        if (colonIdx === -1) return;
        const action = data.slice(0, colonIdx);
        const actionId = data.slice(colonIdx + 1);

        // ── Quick niche picker for /cat ──────────────────────────────────────
        if (action === "cat_niche") {
            try {
                const { Catalog } = await import("../models/catalog.js");
                const niche = await Niche.findById(actionId).select("name styleCategory productType generatedPrompt").lean();
                if (!niche) {
                    await answerCallbackQuery(cq.id, "Nicho no encontrado");
                    return;
                }
                const cfg = await getAutoPilotConfig();
                const modelIds: Record<string, string> = {
                    anime: "flux-anime", realistic: "flux-realism",
                    illustration: "flux-realism", "wall-art": "flux-realism",
                    affirmation: "flux-realism", geometric: "flux-realism", celestial: "flux-realism",
                };
                const modelId = modelIds[(niche as any).styleCategory ?? "generic"] ?? "flux";
                const existingCount = await Catalog.countDocuments({ nicheIds: String((niche as any)._id) });
                const port = process.env.PORT || 3001;
                const res = await fetch(`http://localhost:${port}/catalogs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `${(niche as any).name} — v${existingCount + 1}`,
                        prompt: (niche as any).generatedPrompt || (niche as any).name,
                        totalImages: cfg.imagesPerCatalog,
                        aiModel: { id: `pollinations-${modelId}`, name: "FLUX (Pollinations)", provider: "Pollinations", modelId },
                        nicheIds: [String((niche as any)._id)],
                        productType: (niche as any).productType ?? "coloring-book",
                    }),
                });
                const msg = res.ok
                    ? `✅ Catálogo creado para <b>${(niche as any).name}</b>`
                    : `❌ Error al crear catálogo`;
                await answerCallbackQuery(cq.id, res.ok ? "Catálogo creado" : "Error");
                await sendTelegram(msg);
            } catch (e) {
                await answerCallbackQuery(cq.id, "Error interno");
            }
            return;
        }

        // ── "Otra sugerencia" from /sugerir ──────────────────────────────────
        if (action === "sug_again") {
            await answerCallbackQuery(cq.id, "Generando nueva sugerencia…");
            // Re-run discover with the stored productType
            try {
                const port = process.env.PORT || 3001;
                const res = await fetch(`http://localhost:${port}/ai/discover-niche`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ platform: "etsy", productType: actionId }),
                    signal: AbortSignal.timeout(30_000),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json() as {
                    niche: string; productType?: string; style?: string;
                    url: string; searchTerm: string; competition?: string; reasoning: string;
                };
                const finalType = data.productType || actionId || "coloring-book";
                const finalStyle = data.style || "generic";
                const competitionIcon = data.competition === "baja" ? "🟢" : data.competition === "media" ? "🟡" : "🔴";
                const typeIcon = finalType === "printable-poster" ? "🖼️" : finalType === "seamless-pattern" ? "🔁" : "📚";
                const typeNameLabel = finalType === "printable-poster" ? "Póster imprimible" : finalType === "seamless-pattern" ? "Patrón seamless" : "Libro de colorear";
                const msgLines = [
                    `💡 <b>Nicho sugerido por IA</b>`,
                    ``,
                    `🎯 <b>${data.niche}</b>`,
                    `${typeIcon} ${typeNameLabel} · 🎨 ${finalStyle}`,
                    `${competitionIcon} Competencia ${data.competition ?? "?"}`,
                    ``,
                    `📝 ${data.reasoning}`,
                    ``,
                    `🔍 <a href="${data.url}">Ver en Etsy →</a>`,
                    ``,
                    `<i>Pulsa el botón para crear este nicho directamente</i>`,
                ].join("\n");
                const callbackPayload = `${finalType}|${finalStyle}|${data.niche}`;
                const callbackData = `sug_create:${callbackPayload}`;
                if (callbackData.length <= 64) {
                    await sendTelegramButtons(msgLines, [
                        [{ text: "✅ Crear este nicho", callback_data: callbackData }],
                        [{ text: "🔄 Otra sugerencia", callback_data: `sug_again:${actionId}` }],
                    ]);
                } else {
                    await sendTelegram(msgLines);
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message ?? "Error desconocido"}`);
            }
            return;
        }

        // ── Create niche from /sugerir inline button ─────────────────────────
        if (action === "sug_create") {
            // actionId encodes "productType|style|niche name" (pipe-separated)
            const parts = actionId.split("|");
            const sugProductType = parts[0] ?? "coloring-book";
            const sugStyle = parts[1] ?? "generic";
            const sugName = parts.slice(2).join("|").trim();
            if (!sugName) {
                await answerCallbackQuery(cq.id, "Datos de sugerencia inválidos");
                return;
            }
            try {
                await answerCallbackQuery(cq.id, "Creando nicho…");
                const niche = await Niche.create({
                    name: sugName,
                    status: "found",
                    productType: sugProductType as "coloring-book" | "printable-poster" | "seamless-pattern",
                    styleCategory: sugStyle as any,
                    styleCategories: [sugStyle as any],
                });
                _io?.emit("niches:updated");
                _io?.emit("telegram:notification", { message: `📚 Nicho creado desde sugerencia IA · ${sugName}`, type: "info" });
                await sendTelegram(
                    `✅ <b>Nicho creado</b>\n📚 <b>${sugName}</b>\n\n⏳ Iniciando discovery — recibirás la imagen de muestra en breve…`
                );
                const port = process.env.PORT || 3001;
                setImmediate(async () => {
                    try { await fetch(`http://localhost:${port}/autopilot/discover/${niche._id}`, { method: "POST" }); }
                    catch { /* non-critical */ }
                });
            } catch (e: any) {
                await sendTelegram(`❌ Error creando nicho: ${e.message}`);
            }
            return;
        }

        const tAction = await TelegramAction.findById(actionId);
        if (!tAction || tAction.status !== "pending") {
            await answerCallbackQuery(cq.id, "Esta acción ya fue procesada");
            return;
        }

        let resultText = "";

        if (tAction.type === "niche-discovery" && ["continuar", "omitir", "descartar"].includes(action)) {
            tAction.status = action as "continuar" | "omitir" | "descartar";
            tAction.resolvedAt = new Date();
            await tAction.save();
            resultText = await handleNicheDiscovery(tAction, action as "continuar" | "omitir" | "descartar");
        } else if (tAction.type === "phase-approve" && ["approve", "reject"].includes(action)) {
            tAction.status = action === "approve" ? "approved" : "rejected";
            tAction.resolvedAt = new Date();
            await tAction.save();
            resultText = await handlePhaseApproval(tAction, action === "approve");
        } else {
            await answerCallbackQuery(cq.id, "Acción desconocida");
            return;
        }

        await answerCallbackQuery(cq.id, resultText);

        // Update the original message to remove buttons and show result
        if (tAction.messageId) {
            await editTelegramMessage(
                tAction.messageId,
                `${tAction.type === "niche-discovery" ? "🔍" : "📦"} <b>${tAction.nicheName}</b>\n\n${resultText}`
            );
        }
        return;
    }

    // Handle text commands
    if (update.message?.text) {
        const raw: string = update.message.text.trim();
        // Strip @botname suffix from commands (e.g. /ayuda@MyBot → /ayuda) then lowercase for matching
        const normalized = raw.replace(/@\w+/, "").trim();
        const text = normalized.toLowerCase();

        if (text === "/ayuda" || text === "/help" || text === "ayuda" || text === "help") {
            await sendTelegram(buildHelpText());
            return;
        }

        if (text.startsWith("/crear ")) {
            const rawArg = normalized.slice(7).trim();
            if (!rawArg) {
                await sendTelegram("❌ Indica el nombre: <code>/crear nombre del nicho</code>");
                return;
            }
            // Detect product type from prefix
            let nicheName = rawArg;
            let productType = "coloring-book";
            let styleCategory = "generic";
            const argLower = rawArg.toLowerCase();
            if (argLower.startsWith("printable ")) {
                productType = "printable-poster";
                styleCategory = "wall-art";
                nicheName = rawArg.slice("printable ".length).trim();
            } else if (argLower.startsWith("patron ") || argLower.startsWith("patrón ")) {
                productType = "seamless-pattern";
                styleCategory = "geometric";
                nicheName = rawArg.slice(argLower.startsWith("patron ") ? "patron ".length : "patrón ".length).trim();
            } else if (argLower.startsWith("libro para colorear ")) {
                productType = "coloring-book";
                styleCategory = "generic";
                nicheName = rawArg.slice("libro para colorear ".length).trim();
            } else if (argLower.startsWith("libro de colorear ")) {
                productType = "coloring-book";
                styleCategory = "generic";
                nicheName = rawArg.slice("libro de colorear ".length).trim();
            } else if (argLower.startsWith("ilustracion 8k ") || argLower.startsWith("ilustración 8k ")) {
                productType = "printable-poster";
                styleCategory = "illustration";
                const prefixLen = argLower.startsWith("ilustracion 8k ") ? "ilustracion 8k ".length : "ilustración 8k ".length;
                nicheName = rawArg.slice(prefixLen).trim();
            } else if (argLower.startsWith("ilustracion ") || argLower.startsWith("ilustración ")) {
                productType = "printable-poster";
                styleCategory = "illustration";
                nicheName = rawArg.slice(argLower.startsWith("ilustracion ") ? "ilustracion ".length : "ilustración ".length).trim();
            } else if (argLower.startsWith("foto ") || argLower.startsWith("fotografía ") || argLower.startsWith("fotografia ")) {
                productType = "printable-poster";
                styleCategory = "realistic";
                nicheName = rawArg.slice(rawArg.indexOf(" ") + 1).trim();
            } else if (argLower.startsWith("anime ")) {
                productType = "coloring-book";
                styleCategory = "anime";
                nicheName = rawArg.slice("anime ".length).trim();
            }
            if (!nicheName) {
                await sendTelegram("❌ Indica el nombre del nicho después del prefijo");
                return;
            }
            try {
                const niche = await Niche.create({
                    name: nicheName,
                    status: "found",
                    productType: productType as "coloring-book" | "printable-poster" | "seamless-pattern",
                    styleCategory: styleCategory as "generic" | "wall-art" | "geometric",
                    styleCategories: [styleCategory as "generic" | "wall-art" | "geometric"],
                });
                _io?.emit("niches:updated");
                _io?.emit("telegram:notification", { message: `📚 Nuevo nicho creado desde Telegram · ${nicheName}`, type: "info" });
                const typeTag = productType === "seamless-pattern" ? "🔁 Patrón continuo"
                    : productType === "printable-poster" && styleCategory === "illustration" ? "🎨 Ilustración"
                    : productType === "printable-poster" && styleCategory === "realistic" ? "📷 Fotografía / Realista"
                    : productType === "printable-poster" ? "🖼️ Póster imprimible"
                    : styleCategory === "anime" ? "✏️ Colorear · Anime"
                    : "📚 Libro de colorear";
                await sendTelegram(
                    `✅ <b>Nicho creado</b>\n${typeTag} · <b>${nicheName}</b>\n\n⏳ Iniciando discovery — recibirás la imagen de muestra en breve…`
                );
                // Trigger single-niche discovery
                const port = process.env.PORT || 3001;
                setImmediate(async () => {
                    try {
                        await fetch(`http://localhost:${port}/autopilot/discover/${niche._id}`, { method: "POST" });
                    } catch { /* non-critical */ }
                });
            } catch (e: any) {
                await sendTelegram(`❌ Error creando nicho: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/img ") || text === "/img") {
            const rawArg = normalized.slice(5).trim();
            if (!rawArg) {
                await sendTelegram(
                    "❌ Uso: <code>/img prompt de la imagen</code>\n\n" +
                    "Prefijos de modelo (opcional):\n" +
                    "  <code>anime</code> · <code>realista</code> · <code>flux</code>\n\n" +
                    "Ejemplos:\n" +
                    "<code>/img A dragon breathing fire</code>\n" +
                    "<code>/img anime A cute fox in a magical forest</code>\n" +
                    "<code>/img realista Portrait of a woman in neon city lights</code>"
                );
                return;
            }

            const MODEL_ALIASES: Record<string, string> = {
                anime: "flux-anime",
                realista: "flux-realism",
                realismo: "flux-realism",
                realistic: "flux-realism",
                flux: "flux",
                turbo: "turbo",
            };

            const parts = rawArg.split(/\s+/);
            let model = "flux-realism";
            let prompt = rawArg;
            const firstWord = parts[0].toLowerCase();
            if (MODEL_ALIASES[firstWord]) {
                model = MODEL_ALIASES[firstWord];
                prompt = parts.slice(1).join(" ").trim();
                if (!prompt) {
                    await sendTelegram(`❌ Indica el prompt después del modelo: <code>/img ${firstWord} descripción aquí</code>`);
                    return;
                }
            }

            const seed = Math.floor(Math.random() * 99999);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${model}&width=1024&height=1024&nologo=true&seed=${seed}&enhance=true`;

            await sendTelegram(`🎨 <b>Generando imagen...</b>\n<code>${prompt.slice(0, 100)}${prompt.length > 100 ? "…" : ""}</code>\n<i>modelo: ${model}</i>`);

            setImmediate(async () => {
                try {
                    const imgBuffer = await withImageSlot(`/img:${Date.now()}`, async () => {
                        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(90_000) });
                        if (!imgRes.ok) throw new Error(`Pollinations HTTP ${imgRes.status}`);
                        return Buffer.from(await imgRes.arrayBuffer());
                    });

                    const msgId = await sendTelegramImageBinary(
                        imgBuffer,
                        `🖼️ <b>${prompt.slice(0, 100)}${prompt.length > 100 ? "…" : ""}</b>\n<i>modelo: ${model}</i>`
                    );

                    if (!msgId) {
                        await sendTelegram(`🖼️ <b>Imagen lista</b>\n<a href="${imageUrl}">Ver imagen →</a>`).catch(() => {});
                    }
                } catch (e: any) {
                    console.error("[telegram-poll /img] Error:", e.message);
                    await sendTelegram(`🖼️ <b>Imagen lista</b>\n<a href="${imageUrl}">Ver imagen →</a>\n<i>${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}</i>`).catch(() => {});
                }
            });
            return;
        }

        if (text === "/nichos") {
            try {
                const phaseIcon: Record<string, string> = {
                    niche: "🏭", catalog: "🖼️", libro: "📖", seo: "📝", pdf: "📝", cover: "🎨", published: "✅",
                };
                const statusIcon: Record<string, string> = {
                    active: "⚡", found: "🔍", archived: "🗄️", discarded: "🗑️",
                };
                // Active niches in pipeline (most relevant)
                const active = await Niche.find({ status: "active" })
                    .sort({ updatedAt: -1 })
                    .limit(20)
                    .select("name phase autoPilotEnabled")
                    .lean();
                // Found niches (in queue)
                const foundCount = await Niche.countDocuments({ status: "found" });

                if (active.length === 0 && foundCount === 0) {
                    await sendTelegram("📭 No hay nichos activos ni en cola");
                    return;
                }

                const lines: string[] = [`📚 <b>Nichos</b>`, ``];
                if (active.length > 0) {
                    lines.push(`⚡ <b>En pipeline (${active.length}):</b>`);
                    for (const n of active as any[]) {
                        const shortId = String(n._id).slice(-8);
                        const phase = n.phase ?? "niche";
                        const icon = phaseIcon[phase] ?? "❓";
                        const ap = n.autoPilotEnabled ? " · AP" : "";
                        lines.push(`${icon} <code>${shortId}</code> — ${(n.name as string).slice(0, 32)}${(n.name as string).length > 32 ? "…" : ""}${ap}`);
                    }
                }
                if (foundCount > 0) {
                    lines.push(``);
                    lines.push(`🔍 <b>${foundCount}</b> en cola de discovery`);
                }
                lines.push(``);
                lines.push(`<i>Usa /nicho &lt;id&gt; para más detalle</i>`);
                await sendTelegram(lines.join("\n"));
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/run") {
            try {
                if (_agenda) {
                    await _agenda.now("autopilot-run", {});
                    await sendTelegram("🚀 <b>Auto-Pilot lanzado</b>\nRevisando nichos pendientes…");
                } else {
                    const port = process.env.PORT || 3001;
                    const res = await fetch(`http://localhost:${port}/autopilot/run`, { method: "POST" });
                    if (res.ok) {
                        await sendTelegram("🚀 <b>Auto-Pilot lanzado</b>\nRevisando nichos pendientes…");
                    } else {
                        await sendTelegram("❌ No se pudo lanzar el Auto-Pilot — agenda no disponible");
                    }
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/nicho ")) {
            const idArg = normalized.slice(7).trim();
            try {
                const allNiches = await Niche.find()
                    .select("name status phase autoPilotEnabled productType listings tags description")
                    .lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );
                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>\n<i>Usa /nichos para ver los IDs</i>`);
                    return;
                }
                const { Catalog } = await import("../models/catalog.js");
                const catalogs = await Catalog.find({ nicheIds: String(niche._id) }).lean();
                const totalImages = catalogs.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
                const completedCats = catalogs.filter((c: any) => c.status === "completed").length;
                const runningCats = catalogs.filter((c: any) => c.status === "running" || c.status === "pending").length;
                const listingCount = (niche.listings ?? []).length;

                const phaseLabel: Record<string, string> = {
                    niche: "🏭 Generando catálogos", catalog: "🖼️ Catálogos en proceso",
                    libro: "📖 Generando libro PDF",
                    seo: "📝 Generando SEO", pdf: "📝 Generando SEO",
                    cover: "🎨 Generando portada", published: "✅ Publicado",
                };
                const statusLabel: Record<string, string> = {
                    found: "🔍 En cola de discovery", active: "⚡ Activo en pipeline",
                    archived: "🗄️ Archivado", discarded: "🗑️ Descartado",
                };
                const catStatusLines = catalogs.length > 0
                    ? [`\n📦 Catálogos: <b>${completedCats}</b> listos · <b>${runningCats}</b> en progreso · <b>${catalogs.length}</b> total`]
                    : [];

                const lines = [
                    `📚 <b>${niche.name}</b>`,
                    `🆔 <code>${String(niche._id).slice(-8)}</code>`,
                    ``,
                    `${statusLabel[niche.status] ?? niche.status}${niche.autoPilotEnabled ? " · <b>AutoPilot ON</b>" : ""}`,
                    niche.phase ? phaseLabel[niche.phase] ?? `Fase: ${niche.phase}` : null,
                    ...catStatusLines,
                    `🖼️ <b>${totalImages}</b> imágenes generadas`,
                    listingCount > 0 ? `📝 <b>${listingCount}</b> listing${listingCount > 1 ? "s" : ""} SEO` : `📝 Sin listing SEO`,
                    niche.productType ? `📦 ${niche.productType}` : null,
                    niche.tags?.length > 0 ? `🏷️ ${(niche.tags as string[]).slice(0, 5).join(", ")}` : null,
                    `🆔 Full: <code>${String(niche._id)}</code>`,
                ].filter(Boolean).join("\n");
                await sendTelegram(lines);
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/pdf ")) {
            const idArg = normalized.slice(5).trim();
            try {
                const allNiches = await Niche.find().select("name").lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );
                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>\n<i>Usa /nichos para ver los IDs</i>`);
                    return;
                }
                const { Catalog } = await import("../models/catalog.js");
                const catalogs = await Catalog.find({
                    nicheIds: String((niche as any)._id),
                    status: "completed",
                }).lean();
                if (catalogs.length === 0) {
                    await sendTelegram(`⚠️ <b>${(niche as any).name}</b> no tiene catálogos completados todavía`);
                    return;
                }
                const totalImages = catalogs.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
                _io?.emit("telegram:open-pdf", {
                    nicheId: String((niche as any)._id),
                    nicheName: (niche as any).name,
                    catalogIds: catalogs.map((c: any) => String(c._id)),
                });
                await sendTelegram(
                    `📄 <b>Generando PDF</b>\n` +
                    `📚 <b>${(niche as any).name}</b>\n` +
                    `🖼️ ${totalImages} imágenes de ${catalogs.length} catálogo${catalogs.length > 1 ? "s" : ""}\n\n` +
                    `<i>Abre la app para continuar con el editor de PDF</i>`
                );
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/cat ") || text === "/cat") {
            // Syntax: /cat <id> [imgs] [prompt text...]
            // Second token is imgs only if it's a number; otherwise rest is prompt
            const rawArgs = normalized.slice(5).trim();
            const tokens = rawArgs.split(/\s+/);
            const idArg = tokens[0] ?? "";
            let imgsArg: number | null = null;
            let customPrompt: string | null = null;

            if (tokens.length > 1) {
                const second = tokens[1];
                const secondNum = parseInt(second);
                if (!isNaN(secondNum) && secondNum > 0) {
                    imgsArg = secondNum;
                    if (tokens.length > 2) customPrompt = tokens.slice(2).join(" ");
                } else {
                    customPrompt = tokens.slice(1).join(" ");
                }
            }

            if (!idArg) {
                const allNichesList = await Niche.find({ status: { $ne: "archived" } })
                    .select("name status phase")
                    .sort({ updatedAt: -1 })
                    .limit(20)
                    .lean() as any[];
                if (allNichesList.length === 0) {
                    await sendTelegram("❌ No hay nichos activos. Crea uno con /crear &lt;nombre&gt;");
                    return;
                }
                const phaseEmoji: Record<string, string> = { niche: "🏭", catalog: "🖼️", libro: "📖", seo: "📝", cover: "🎨", published: "✅" };
                const rows: { text: string; callback_data: string }[][] = [];
                for (let i = 0; i < allNichesList.length; i += 2) {
                    const row = [allNichesList[i], allNichesList[i + 1]].filter(Boolean).map(n => ({
                        text: `${phaseEmoji[n.phase] ?? "📦"} ${n.name.slice(0, 25)}`,
                        callback_data: `cat_niche:${String(n._id)}`,
                    }));
                    rows.push(row);
                }
                await sendTelegramButtons("🖼️ <b>Selecciona el nicho para crear un catálogo:</b>", rows);
                return;
            }

            try {
                const { Catalog } = await import("../models/catalog.js");
                const allNiches = await Niche.find()
                    .select("name styleCategory productType generatedPrompt phase status")
                    .lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );

                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>\n<i>Usa /nichos para ver los IDs</i>`);
                    return;
                }

                const cfg = await getAutoPilotConfig();
                const totalImages = (imgsArg && imgsArg > 0) ? Math.min(imgsArg, 25) : cfg.imagesPerCatalog;

                const modelIds: Record<string, string> = {
                    anime: "flux-anime", realistic: "flux-realism",
                    illustration: "flux-realism", "wall-art": "flux-realism",
                    affirmation: "flux-realism", geometric: "flux-realism",
                    celestial: "flux-realism",
                };
                const modelId = modelIds[(niche as any).styleCategory ?? "generic"] ?? "flux";
                const aiModel = {
                    id: `pollinations-${modelId}`,
                    name: "FLUX (Pollinations)",
                    provider: "Pollinations",
                    modelId,
                };

                // Count existing catalogs to name this one
                const existingCount = await Catalog.countDocuments({ nicheIds: String((niche as any)._id) });
                const port = process.env.PORT || 3001;
                const res = await fetch(`http://localhost:${port}/catalogs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `${(niche as any).name} — v${existingCount + 1}`,
                        prompt: customPrompt || (niche as any).generatedPrompt || (niche as any).name,
                        totalImages,
                        aiModel,
                        nicheIds: [String((niche as any)._id)],
                        productType: (niche as any).productType ?? "coloring-book",
                    }),
                });

                if (res.ok) {
                    _io?.emit("catalogs:updated");
                    _io?.emit("niches:updated");
                    _io?.emit("telegram:notification", {
                        message: `🖼️ Catálogo creado desde Telegram · ${(niche as any).name}`,
                        type: "info",
                    });
                    await sendTelegram(
                        `✅ <b>Catálogo creado</b>\n` +
                        `📚 Nicho: <b>${(niche as any).name}</b>\n` +
                        `🖼️ ${totalImages} imágenes · modelo <code>${modelId}</code>\n\n` +
                        `⚙️ Encolado — se generará automáticamente`
                    );
                } else {
                    const err = await res.json().catch(() => ({})) as any;
                    await sendTelegram(`❌ Error creando catálogo: ${err.error ?? res.status}`);
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/retry ") || text === "/retry") {
            const idArg = normalized.slice(7).trim();

            if (!idArg) {
                await sendTelegram("❌ Uso: <code>/retry &lt;id_nicho&gt;</code>\n<i>Usa /nichos o /pipeline para ver los IDs</i>");
                return;
            }

            try {
                const { Catalog } = await import("../models/catalog.js");
                const allNiches = await Niche.find().select("name phase").lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );

                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>`);
                    return;
                }

                const { modifiedCount } = await Catalog.updateMany(
                    { nicheIds: String((niche as any)._id), status: "failed" },
                    { $set: { status: "queued" }, $unset: { lastError: "" } }
                );

                if (modifiedCount === 0) {
                    const activeCats = await Catalog.countDocuments({
                        nicheIds: String((niche as any)._id),
                        status: { $in: ["running", "pending", "queued"] },
                    });
                    await sendTelegram(
                        activeCats > 0
                            ? `ℹ️ <b>${(niche as any).name}</b>\n${activeCats} catálogo${activeCats !== 1 ? "s" : ""} ya en cola, no hay fallidos que reintentar`
                            : `ℹ️ <b>${(niche as any).name}</b>\nNo hay catálogos fallidos que reintentar`
                    );
                    return;
                }

                _io?.emit("catalogs:updated");

                // Activate queued catalogs respecting the concurrency limit
                if (_agenda) {
                    await activateNextQueued(_agenda, _io).catch(() => {});
                }

                await sendTelegram(
                    `🔄 <b>Reintentando catálogos</b>\n` +
                    `📚 <b>${(niche as any).name}</b>\n` +
                    `📦 ${modifiedCount} catálogo${modifiedCount !== 1 ? "s" : ""} reactivado${modifiedCount !== 1 ? "s" : ""}\n\n` +
                    `<i>La cola retoma la generación automáticamente</i>`
                );
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/avanzar ") || text === "/avanzar") {
            const parts = normalized.slice(9).trim().split(/\s+/);
            const idArg = parts[0] ?? "";
            const faseArg = parts[1]?.toLowerCase();

            if (!idArg) {
                await sendTelegram(
                    "❌ Uso: <code>/avanzar &lt;id&gt; [fase]</code>\n" +
                    "Fases válidas: <code>catalog libro seo cover published</code>\n" +
                    "Sin fase → avanza automáticamente a la siguiente\n" +
                    "<i>Usa /pipeline para ver los IDs</i>"
                );
                return;
            }

            try {
                const allNiches = await Niche.find().select("name phase").lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );

                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>\n<i>Usa /pipeline para ver los IDs</i>`);
                    return;
                }

                const port = process.env.PORT || 3001;
                const res = await fetch(`http://localhost:${port}/autopilot/niche/${String((niche as any)._id)}/advance`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(faseArg ? { phase: faseArg } : {}),
                });

                if (res.ok) {
                    const data = await res.json() as any;
                    await sendTelegram(
                        `⏩ <b>Nicho avanzado</b>\n` +
                        `📚 <b>${(niche as any).name}</b>\n` +
                        `📍 <b>${(niche as any).phase ?? "niche"}</b> → <b>${data.phase}</b>\n\n` +
                        `<i>Auto-Pilot retomará en 3 segundos</i>`
                    );
                } else {
                    const err = await res.json().catch(() => ({})) as any;
                    await sendTelegram(`❌ Error: ${err.error ?? res.status}`);
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/catalogo" || text.startsWith("/catalogo ")) {
            const idArg = text.startsWith("/catalogo ") ? normalized.slice(10).trim() : "";
            try {
                const { Catalog } = await import("../models/catalog.js");
                if (!idArg) {
                    // List recent catalogs
                    const catalogs = await Catalog.find()
                        .sort({ createdAt: -1 })
                        .limit(15)
                        .select("name status images skippedImages totalImages nicheIds createdAt")
                        .lean();
                    if (catalogs.length === 0) {
                        await sendTelegram("📭 No hay catálogos todavía");
                        return;
                    }
                    const statusIcons: Record<string, string> = {
                        completed: "✅", running: "⚙️", pending: "⏳", queued: "🔲", failed: "❌", cancelled: "🚫",
                    };
                    const lines = [
                        `🖼️ <b>Catálogos recientes</b>`,
                        ``,
                        ...catalogs.map((c: any) => {
                            const shortId = String(c._id).slice(-8);
                            const icon = statusIcons[c.status] ?? "❓";
                            const imgs = c.images?.length ?? 0;
                            return `${icon} <code>${shortId}</code> — ${c.name.slice(0, 30)}${c.name.length > 30 ? "…" : ""} <i>(${imgs}/${c.totalImages} imgs)</i>`;
                        }),
                        ``,
                        `<i>Usa /catalogo &lt;id&gt; para más detalle</i>`,
                    ];
                    await sendTelegram(lines.join("\n"));
                } else {
                    // Detail by partial ID (last 8 chars match)
                    const allCatalogs = await Catalog.find()
                        .select("name status images skippedImages totalImages nicheIds prompt createdAt updatedAt lastError")
                        .lean();
                    const catalog = (allCatalogs as any[]).find(c =>
                        String(c._id).endsWith(idArg.toLowerCase()) || String(c._id) === idArg
                    );
                    if (!catalog) {
                        await sendTelegram(`❌ No encontré catálogo con ID <code>${idArg}</code>`);
                        return;
                    }
                    const imgs = catalog.images?.length ?? 0;
                    const statusIcons: Record<string, string> = { completed: "✅", running: "⚙️", pending: "⏳", queued: "🔲", failed: "❌", cancelled: "🚫" };
                    const icon = statusIcons[catalog.status] ?? "❓";
                    // Fetch linked niche names
                    const nicheNames: string[] = [];
                    if (catalog.nicheIds?.length > 0) {
                        const niches = await Niche.find({ _id: { $in: catalog.nicheIds } }).select("name").lean();
                        for (const n of niches as any[]) nicheNames.push(n.name);
                    }
                    const lines = [
                        `🖼️ <b>${catalog.name}</b>`,
                        ``,
                        `${icon} Estado: <b>${catalog.status}</b>`,
                        `📊 Imágenes: <b>${imgs}/${catalog.totalImages}</b>`,
                        catalog.skippedImages > 0 ? `⏭️ Saltadas: <b>${catalog.skippedImages}</b>` : null,
                        nicheNames.length > 0 ? `📚 Nicho: <b>${nicheNames.join(", ")}</b>` : null,
                        catalog.lastError ? `❌ Último error: <i>${catalog.lastError.slice(0, 120)}</i>` : null,
                        `🆔 ID completo: <code>${String(catalog._id)}</code>`,
                    ].filter(Boolean).join("\n");
                    await sendTelegram(lines);
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/parar" || text.startsWith("/parar ")) {
            const idArg = text.startsWith("/parar ") ? normalized.slice(7).trim() : "";
            try {
                const { Catalog } = await import("../models/catalog.js");

                if (idArg) {
                    // ── Stop a single niche ──────────────────────────────────
                    const allNiches = await Niche.find().select("name autoPilotEnabled").lean();
                    const niche = (allNiches as any[]).find(n =>
                        String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                    );
                    if (!niche) {
                        await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>\n<i>Usa /pipeline para ver los IDs</i>`);
                        return;
                    }

                    // Disable autopilot for this niche
                    await Niche.findByIdAndUpdate(niche._id, { $set: { autoPilotEnabled: false } });

                    // Cancel its catalogs
                    const cats = await Catalog.find({
                        nicheIds: String(niche._id),
                        status: { $in: ["running", "pending", "queued"] },
                    }).select("_id").lean();
                    const catIds = (cats as any[]).map(c => String(c._id));

                    let cancelledJobs = 0;
                    if (_agenda && catIds.length > 0) {
                        try {
                            const result = await _agenda.cancel({
                                name: "generate-catalog-image",
                                "data.catalogId": { $in: catIds },
                            });
                            cancelledJobs = result ?? 0;
                        } catch { /* non-critical */ }
                    }

                    const { modifiedCount } = await Catalog.updateMany(
                        { _id: { $in: catIds } },
                        { $set: { status: "cancelled" } }
                    );

                    _io?.emit("niches:updated");
                    _io?.emit("catalogs:updated");

                    await sendTelegram(
                        `🛑 <b>Nicho detenido</b>\n📚 <b>${niche.name}</b>\n\n` +
                        `📦 ${modifiedCount} catálogo${modifiedCount !== 1 ? "s" : ""} cancelado${modifiedCount !== 1 ? "s" : ""}\n` +
                        `🗂️ ${cancelledJobs} job${cancelledJobs !== 1 ? "s" : ""} de Agenda eliminado${cancelledJobs !== 1 ? "s" : ""}\n` +
                        `⏸️ Auto-Pilot desactivado para este nicho\n\n` +
                        `El resto del pipeline sigue activo.`
                    );
                } else {
                    // ── Full stop ────────────────────────────────────────────
                    await Settings.findOneAndUpdate(
                        { key: "AUTOPILOT_ABORT" },
                        { key: "AUTOPILOT_ABORT", value: "1" },
                        { upsert: true }
                    );

                    let cancelledJobs = 0;
                    if (_agenda) {
                        try {
                            const result = await _agenda.cancel({ name: "generate-catalog-image" });
                            cancelledJobs = result ?? 0;
                        } catch { /* non-critical */ }
                    }

                    const { modifiedCount } = await Catalog.updateMany(
                        { status: { $in: ["running", "pending", "queued"] } },
                        { $set: { status: "cancelled" } }
                    );

                    _io?.emit("autopilot:error", { message: "⛔ Pipeline detenido completamente desde Telegram" });
                    _io?.emit("catalogs:updated");

                    await sendTelegram(
                        `🛑 <b>Pipeline detenido</b>\n\n` +
                        `📦 ${modifiedCount} catálogo${modifiedCount !== 1 ? "s" : ""} cancelado${modifiedCount !== 1 ? "s" : ""}\n` +
                        `🗂️ ${cancelledJobs} job${cancelledJobs !== 1 ? "s" : ""} de Agenda eliminado${cancelledJobs !== 1 ? "s" : ""}\n\n` +
                        `Usa /run para reanudar cuando quieras.`
                    );
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/cola") {
            try {
                const { Catalog } = await import("../models/catalog.js");
                const [running, pending, queued] = await Promise.all([
                    Catalog.find({ status: "running" }).sort({ queueOrder: 1 }).select("name images totalImages nicheIds").lean(),
                    Catalog.find({ status: "pending" }).sort({ queueOrder: 1 }).limit(10).select("name totalImages").lean(),
                    Catalog.find({ status: "queued" }).sort({ queueOrder: 1 }).limit(10).select("name totalImages").lean(),
                ]);
                const total = running.length + pending.length + queued.length;
                if (total === 0) {
                    await sendTelegram("✅ Cola vacía — no hay catálogos en generación ni pendientes");
                    return;
                }
                const lines = [`🏭 <b>Cola de catálogos</b> (${total})`, ``];
                if (running.length > 0) {
                    lines.push(`⚙️ <b>Generando (${running.length}):</b>`);
                    for (const c of running as any[]) {
                        const imgs = c.images?.length ?? 0;
                        lines.push(`  · ${c.name.slice(0, 30)} — ${imgs}/${c.totalImages} imgs`);
                    }
                }
                if (pending.length > 0) {
                    lines.push(`\n⏳ <b>Pendientes (${pending.length}):</b>`);
                    for (const c of pending as any[]) lines.push(`  · ${c.name.slice(0, 35)}`);
                }
                if (queued.length > 0) {
                    lines.push(`\n🔲 <b>En cola (${queued.length}):</b>`);
                    for (const c of queued as any[]) lines.push(`  · ${c.name.slice(0, 35)}`);
                }
                await sendTelegram(lines.join("\n"));
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/config" || text.startsWith("/config ")) {
            try {
                const args = normalized.slice(7).trim().split(/\s+/).filter(Boolean);
                if (args.length >= 2) {
                    const cats = parseInt(args[0]);
                    const imgs = parseInt(args[1]);
                    const nichos = args[2] ? parseInt(args[2]) : null;
                    if (isNaN(cats) || cats < 1 || isNaN(imgs) || imgs < 1 || (nichos !== null && (isNaN(nichos) || nichos < 1))) {
                        await sendTelegram("❌ Valores inválidos. Ejemplo: <code>/config 8 5 3</code>");
                        return;
                    }
                    const updates: Promise<any>[] = [
                        Settings.findOneAndUpdate(
                            { key: "AUTOPILOT_CATALOGS_PER_NICHE" },
                            { key: "AUTOPILOT_CATALOGS_PER_NICHE", value: String(cats) },
                            { upsert: true }
                        ),
                        Settings.findOneAndUpdate(
                            { key: "AUTOPILOT_IMAGES_PER_CATALOG" },
                            { key: "AUTOPILOT_IMAGES_PER_CATALOG", value: String(imgs) },
                            { upsert: true }
                        ),
                    ];
                    if (nichos !== null) {
                        updates.push(Settings.findOneAndUpdate(
                            { key: "AUTOPILOT_MAX_NICHES" },
                            { key: "AUTOPILOT_MAX_NICHES", value: String(nichos) },
                            { upsert: true }
                        ));
                    }
                    await Promise.all(updates);
                    _io?.emit("telegram:notification", {
                        message: `⚙️ Config actualizada: ${cats} catálogos × ${imgs} imágenes${nichos !== null ? ` · ${nichos} nichos/run` : ""}`,
                        type: "info",
                    });
                    const cfg = await getAutoPilotConfig();
                    await sendTelegram(
                        `✅ <b>Configuración guardada</b>\n\n` +
                        `📦 Catálogos por nicho: <b>${cfg.catalogsPerNiche}</b>\n` +
                        `🖼️ Imágenes por catálogo: <b>${cfg.imagesPerCatalog}</b>\n` +
                        `🔁 Nichos por ejecución: <b>${cfg.maxNichesPerRun}</b>\n\n` +
                        `<i>Aplicado en la próxima ejecución de Auto-Pilot</i>`
                    );
                } else {
                    // Show current config
                    const cfg = await getAutoPilotConfig();
                    await sendTelegram(
                        `⚙️ <b>Configuración Auto-Pilot</b>\n\n` +
                        `📦 Catálogos por nicho: <b>${cfg.catalogsPerNiche}</b>\n` +
                        `🖼️ Imágenes por catálogo: <b>${cfg.imagesPerCatalog}</b>\n` +
                        `🔁 Nichos por ejecución: <b>${cfg.maxNichesPerRun}</b>\n\n` +
                        `Para cambiar: <code>/config &lt;cats&gt; &lt;imgs&gt; [nichos]</code>\n` +
                        `Ej. prueba rápida: <code>/config 1 1 1</code>\n` +
                        `Ej. producción: <code>/config 8 5 3</code>`
                    );
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/estado") {
            try {
                const { Catalog } = await import("../models/catalog.js");

                const phaseIcon: Record<string, string> = {
                    niche: "🏭", catalog: "🖼️", libro: "📖", seo: "📝", pdf: "📝", cover: "🎨", published: "✅",
                };
                const phaseDesc: Record<string, string> = {
                    niche: "Creando catálogos",
                    catalog: "Generando imágenes",
                    libro: "Generando libro PDF",
                    seo: "Generando SEO",
                    pdf: "Generando SEO",
                    cover: "Generando portada",
                    published: "Listo para publicar",
                };

                const allNiches = await Niche.find({
                    status: "active",
                    phase: { $in: ["niche", "catalog", "libro", "seo", "cover"] },
                })
                    .sort({ updatedAt: -1 })
                    .limit(20)
                    .select("name phase autoPilotEnabled listings updatedAt createdAt")
                    .lean();

                if (allNiches.length === 0) {
                    await sendTelegram("💤 <b>Pipeline vacío</b>\nNingún nicho activo.\n\nUsa /run para lanzar el Auto-Pilot.");
                    return;
                }

                const lines: string[] = [`📋 <b>Estado del pipeline</b>\n`];
                for (const n of allNiches as any[]) {
                    const phase = n.phase ?? "niche";
                    const shortId = String(n._id).slice(-8);
                    const icon = phaseIcon[phase] ?? "❓";
                    const desc = phaseDesc[phase] ?? phase;
                    const manualTag = !n.autoPilotEnabled ? " · <i>manual</i>" : " · AP";
                    const elapsed = formatElapsed(n.updatedAt);

                    lines.push(`${icon} <code>${shortId}</code> <b>${(n.name as string).slice(0, 28)}${(n.name as string).length > 28 ? "…" : ""}</b>${manualTag}`);

                    if (phase === "catalog") {
                        const cats = await Catalog.find({ nicheIds: String(n._id) })
                            .select("status images totalImages updatedAt lastError")
                            .lean();
                        const done = cats.filter((c: any) => c.status === "completed").length;
                        const totalImgs = cats.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
                        const totalSlots = cats.reduce((s: number, c: any) => s + (c.totalImages ?? 0), 0);
                        // Find most recent image activity
                        const lastActive = cats
                            .filter((c: any) => c.images?.length > 0 || c.status === "running")
                            .map((c: any) => new Date(c.updatedAt).getTime())
                            .sort((a: number, b: number) => b - a)[0];
                        const lastError = cats
                            .filter((c: any) => c.lastError)
                            .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.lastError;

                        lines.push(`   ${desc} · ${done}/${cats.length} cats · ${totalImgs}/${totalSlots} imgs`);
                        if (lastActive) {
                            const sinceImg = formatElapsed(new Date(lastActive));
                            const isStale = Date.now() - lastActive > 7 * 60 * 1000;
                            lines.push(`   ${isStale ? "⚠️" : "🕐"} Última imagen hace <b>${sinceImg}</b>`);
                        } else {
                            lines.push(`   ⏳ Sin imágenes aún · en fase hace <b>${elapsed}</b>`);
                        }
                        if (lastError) lines.push(`   ❌ <i>${lastError.slice(0, 80)}${lastError.length > 80 ? "…" : ""}</i>`);
                    } else {
                        const WARN_PHASE_MS: Record<string, number> = { libro: 2 * 3600_000, seo: 3600_000, cover: 3600_000 };
                        const warnMs = WARN_PHASE_MS[phase] ?? 0;
                        const phaseMs = Date.now() - new Date(n.updatedAt).getTime();
                        const stale = warnMs > 0 && phaseMs > warnMs;
                        lines.push(`   ${desc} · ${stale ? "⚠️ " : ""}en esta fase hace <b>${elapsed}</b>`);
                    }
                }
                lines.push(``);
                lines.push(`<i>/pipeline para detalle · /avanzar &lt;id&gt; · /retry &lt;id&gt;</i>`);

                await sendTelegram(lines.join("\n"));
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/pipeline") {
            try {
                const { Catalog } = await import("../models/catalog.js");

                const phaseLabel: Record<string, string> = {
                    niche: "🏭 Creando catálogos",
                    catalog: "🖼️ Generando imágenes",
                    libro: "📖 Generando libro PDF",
                    seo: "📝 Generando SEO",
                    pdf: "📝 Generando SEO",
                    cover: "🎨 Generando portada",
                    published: "✅ Publicado",
                };

                const activeCats = await Catalog.find({ status: { $in: ["running", "pending", "queued"] } })
                    .select("nicheIds")
                    .lean();
                const nicheIdsWithWork = [...new Set((activeCats as any[]).flatMap((c: any) => c.nicheIds ?? []))];

                const apNiches = await Niche.find({
                    status: "active",
                    phase: { $in: ["niche", "catalog", "libro", "seo", "cover"] },
                }).select("_id").lean();
                const apNicheIds = (apNiches as any[]).map(n => String(n._id));

                const allIds = [...new Set([...nicheIdsWithWork, ...apNicheIds])];

                const niches = allIds.length > 0
                    ? await Niche.find({ _id: { $in: allIds } })
                        .sort({ updatedAt: -1 })
                        .select("name phase listings autoPilotEnabled updatedAt createdAt bookPdfUrl coverUrl")
                        .lean()
                    : [];

                if (niches.length === 0) {
                    await sendTelegram("💤 <b>Pipeline vacío</b>\nNo hay generación activa ni nichos en Auto-Pilot.\n\nUsa /run para lanzar un ciclo.");
                    return;
                }

                const nowMs = Date.now();
                const STUCK_MS = 7 * 60 * 1000;
                const lines: string[] = [`⚙️ <b>Pipeline</b> — ${niches.length} nicho${niches.length !== 1 ? "s" : ""}`, ``];

                for (const niche of niches as any[]) {
                    const phase = niche.phase ?? "niche";
                    const shortId = String(niche._id).slice(-8);
                    const apTag = niche.autoPilotEnabled ? "AP" : "manual";
                    const phaseElapsed = formatElapsed(niche.updatedAt);

                    lines.push(`📚 <b>${niche.name}</b> <code>${shortId}</code> · ${apTag}`);
                    lines.push(`${phaseLabel[phase] ?? `Fase: ${phase}`} · <b>${phaseElapsed}</b> en esta fase`);

                    if (phase === "catalog") {
                        const cats = await Catalog.find({ nicheIds: String(niche._id) })
                            .select("name status images totalImages updatedAt skippedImages lastError")
                            .lean();

                        const total = cats.length;
                        const completed = cats.filter((c: any) => c.status === "completed").length;
                        const failed = cats.filter((c: any) => c.status === "failed").length;
                        const running = cats.filter((c: any) => c.status === "running");
                        const pending = cats.filter((c: any) => c.status === "pending" || c.status === "queued").length;
                        const totalImgs = cats.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
                        const totalSlots = cats.reduce((s: number, c: any) => s + (c.totalImages ?? 0), 0);

                        // Most recent image activity across all catalogs
                        const lastImageMs = Math.max(0, ...cats
                            .filter((c: any) => c.images?.length > 0)
                            .map((c: any) => new Date(c.updatedAt).getTime()));
                        const sinceLastImage = lastImageMs > 0 ? formatElapsed(new Date(lastImageMs)) : null;
                        const imageIsStale = lastImageMs > 0 && nowMs - lastImageMs > 10 * 60_000;

                        lines.push(`  📦 <b>${completed}/${total}</b> cats listos${failed > 0 ? ` · ❌ ${failed} fallidos` : ""}${pending > 0 ? ` · ${pending} pendientes` : ""}`);
                        lines.push(`  🖼️ <b>${totalImgs}/${totalSlots}</b> imágenes`);

                        if (sinceLastImage) {
                            lines.push(`  ${imageIsStale ? "⚠️" : "🕐"} Última imagen hace <b>${sinceLastImage}</b>${imageIsStale ? " — posible bloqueo" : ""}`);
                        } else if (total > 0) {
                            lines.push(`  ⏳ Sin imágenes aún · esperando desde <b>${phaseElapsed}</b>`);
                        }

                        for (const cat of running as any[]) {
                            const imgs = cat.images?.length ?? 0;
                            const skipped = cat.skippedImages ?? 0;
                            const attempted = imgs + skipped;
                            const catMs = nowMs - new Date(cat.updatedAt).getTime();
                            const isStuck = catMs > STUCK_MS;
                            const healthIcon = isStuck ? "🔴" : catMs > 4 * 60_000 ? "🟡" : "🟢";
                            const stuckNote = isStuck ? ` · sin actividad <b>${formatElapsed(cat.updatedAt)}</b>` : ` · activo hace ${formatElapsed(cat.updatedAt)}`;
                            lines.push(`  ${healthIcon} ${cat.name.slice(0, 26)} — ${attempted}/${cat.totalImages}${stuckNote}`);
                            if (cat.lastError && isStuck) {
                                lines.push(`     ❌ <i>${cat.lastError.slice(0, 70)}${cat.lastError.length > 70 ? "…" : ""}</i>`);
                            }
                        }

                        // Show last error from any catalog if no images and stale
                        if (totalImgs === 0 && total > 0) {
                            const anyError = (cats as any[])
                                .filter((c: any) => c.lastError)
                                .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.lastError;
                            if (anyError) lines.push(`  ❌ <i>${anyError.slice(0, 80)}${anyError.length > 80 ? "…" : ""}</i>`);
                        }

                    } else if (phase === "libro") {
                        const hasPdf = !!(niche as any).bookPdfUrl;
                        if (hasPdf) {
                            lines.push(`  📄 PDF listo — esperando autopilot para avanzar`);
                        } else {
                            const WARN_MS = 2 * 3600_000;
                            const phaseMs = nowMs - new Date(niche.updatedAt).getTime();
                            if (phaseMs > WARN_MS) lines.push(`  ⚠️ Generando PDF · lleva <b>${phaseElapsed}</b> — puede estar bloqueado`);
                            else lines.push(`  ⏳ Generando PDF…`);
                        }

                    } else if (phase === "seo" || phase === "pdf") {
                        const listingCount = (niche.listings ?? []).length;
                        const WARN_MS = 3600_000;
                        const phaseMs = nowMs - new Date(niche.updatedAt).getTime();
                        if (listingCount > 0) {
                            lines.push(`  📝 ${listingCount} listing${listingCount > 1 ? "s" : ""} SEO listo${listingCount > 1 ? "s" : ""} · esperando portada`);
                        } else if (phaseMs > WARN_MS) {
                            lines.push(`  ⚠️ Generando SEO · lleva <b>${phaseElapsed}</b> — puede estar bloqueado`);
                        } else {
                            lines.push(`  📝 Generando listing SEO…`);
                        }

                    } else if (phase === "cover") {
                        const hasCover = !!(niche as any).coverUrl;
                        const WARN_MS = 3600_000;
                        const phaseMs = nowMs - new Date(niche.updatedAt).getTime();
                        if (hasCover) {
                            lines.push(`  🎨 Portada lista · esperando publicación`);
                        } else if (phaseMs > WARN_MS) {
                            lines.push(`  ⚠️ Generando portada · lleva <b>${phaseElapsed}</b> — puede estar bloqueado`);
                        } else {
                            lines.push(`  🎨 Generando portada KDP…`);
                        }
                    }

                    lines.push(``);
                }

                while (lines[lines.length - 1] === ``) lines.pop();
                lines.push(``);
                lines.push(`<i>/avanzar &lt;id&gt; · /retry &lt;id&gt; · /parar &lt;id&gt;</i>`);

                await sendTelegram(lines.join("\n"));
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/kdpotp ") || text === "/kdpotp") {
            const code = normalized.slice(8).trim();
            if (!code) {
                await sendTelegram("❌ Uso: <code>/kdpotp XXXXXX</code>");
                return;
            }
            try {
                await Settings.findOneAndUpdate(
                    { key: "KDP_OTP_CODE" },
                    { key: "KDP_OTP_CODE", value: code },
                    { upsert: true }
                );
                await sendTelegram(`🔐 <b>Código OTP recibido</b>\nSe enviará a KDP en breve…`);
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/kdp ") || text === "/kdp") {
            const idArg = normalized.slice(5).trim();
            if (!idArg) {
                await sendTelegram(
                    "❌ Uso: <code>/kdp &lt;id_nicho&gt;</code>\n\n" +
                    "Requerido: PDF del libro + listing SEO + credenciales KDP\n" +
                    "Ajustes: <code>KDP_EMAIL</code> · <code>KDP_PASSWORD</code> · <code>KDP_AUTHOR_NAME</code> · <code>KDP_DEFAULT_PRICE</code>\n\n" +
                    "<i>Usa /nichos para ver los IDs</i>"
                );
                return;
            }
            try {
                const allNiches = await Niche.find().select("name phase listings bookPdfUrl").lean();
                const niche = (allNiches as any[]).find(n =>
                    String(n._id).endsWith(idArg.toLowerCase()) || String(n._id) === idArg
                );
                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con ID <code>${idArg}</code>`);
                    return;
                }
                if (!niche.bookPdfUrl) {
                    await sendTelegram(`⚠️ <b>${niche.name}</b> aún no tiene PDF del libro generado`);
                    return;
                }
                if (!(niche.listings?.length > 0)) {
                    await sendTelegram(`⚠️ <b>${niche.name}</b> aún no tiene listing SEO generado`);
                    return;
                }
                if (!_agenda) {
                    await sendTelegram("❌ Agenda no disponible");
                    return;
                }
                await _agenda.now("kdp-publish", { nicheId: String(niche._id) });
                _io?.emit("kdp:queued", { nicheId: String(niche._id) });
                await sendTelegram(
                    `🚀 <b>KDP Upload iniciado</b>\n` +
                    `📚 <b>${niche.name}</b>\n\n` +
                    `⏳ Descargando PDF y portada… recibirás actualizaciones aquí.`
                );
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text === "/sugerir" || text.startsWith("/sugerir ")) {
            const typeArg = normalized.slice(9).trim().toLowerCase();
            let productType = "";
            let typeLabel = "cualquier tipo";

            if (["colorear", "color", "libro", "coloring"].some(t => typeArg === t || typeArg.startsWith(t + " "))) {
                productType = "coloring-book";
                typeLabel = "📚 Libro de colorear";
            } else if (["poster", "póster", "printable", "print", "imprimible", "cartel"].some(t => typeArg === t || typeArg.startsWith(t + " "))) {
                productType = "printable-poster";
                typeLabel = "🖼️ Póster imprimible";
            } else if (["patron", "patrón", "seamless", "pattern", "tela"].some(t => typeArg === t || typeArg.startsWith(t + " "))) {
                productType = "seamless-pattern";
                typeLabel = "🔁 Patrón seamless";
            }

            await sendTelegram(`🔮 <b>Consultando a la IA…</b>\nBuscando nicho con potencial · <i>${typeLabel}</i>`);

            try {
                const port = process.env.PORT || 3001;
                const res = await fetch(`http://localhost:${port}/ai/discover-niche`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ platform: "etsy", productType }),
                    signal: AbortSignal.timeout(30_000),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json() as {
                    niche: string; productType?: string; style?: string;
                    url: string; searchTerm: string; competition?: string; reasoning: string;
                };

                const finalType = data.productType || productType || "coloring-book";
                const finalStyle = data.style || "generic";
                const competitionIcon = data.competition === "baja" ? "🟢" : data.competition === "media" ? "🟡" : "🔴";
                const typeIcon = finalType === "printable-poster" ? "🖼️" : finalType === "seamless-pattern" ? "🔁" : "📚";
                const typeNameLabel = finalType === "printable-poster" ? "Póster imprimible" : finalType === "seamless-pattern" ? "Patrón seamless" : "Libro de colorear";

                const msgLines = [
                    `💡 <b>Nicho sugerido por IA</b>`,
                    ``,
                    `🎯 <b>${data.niche}</b>`,
                    `${typeIcon} ${typeNameLabel} · 🎨 ${finalStyle}`,
                    `${competitionIcon} Competencia ${data.competition ?? "?"}`,
                    ``,
                    `📝 ${data.reasoning}`,
                    ``,
                    `🔍 <a href="${data.url}">Ver en Etsy →</a>`,
                    ``,
                    `<i>Pulsa el botón para crear este nicho directamente</i>`,
                ].join("\n");

                // Encode creation data in callback (max 64 bytes total)
                // Format: sug_create:{productType}|{style}|{name}
                const callbackPayload = `${finalType}|${finalStyle}|${data.niche}`;
                const callbackData = `sug_create:${callbackPayload}`;

                if (callbackData.length <= 64) {
                    await sendTelegramButtons(msgLines, [
                        [{ text: "✅ Crear este nicho", callback_data: callbackData }],
                        [{ text: "🔄 Otra sugerencia", callback_data: `sug_again:${productType}` }],
                    ]);
                } else {
                    // Name too long for inline button — show without buttons
                    await sendTelegram(msgLines + `\n\nPara crearlo: <code>/crear ${
                        finalType === "printable-poster" ? "printable " :
                        finalType === "seamless-pattern" ? "patron " : ""
                    }${data.niche}</code>`);
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error generando sugerencia: ${e.message ?? "Error desconocido"}`);
            }
            return;
        }

        if (text === "/status") {
            const pending = await TelegramAction.find({ status: "pending" }).lean();
            if (pending.length === 0) {
                await sendTelegram("✅ No hay acciones pendientes");
            } else {
                const disc = pending.filter(a => a.type === "niche-discovery");
                const pipe = pending.filter(a => a.type === "phase-approve");
                const lines = [
                    `⏳ <b>${pending.length} acciones pendientes</b>`,
                    disc.length > 0 ? `\n🔍 <b>Descubrimiento (${disc.length}):</b>` : null,
                    ...disc.map(a => `  • ${a.nicheName}`),
                    pipe.length > 0 ? `\n📦 <b>Pipeline (${pipe.length}):</b>` : null,
                    ...pipe.map(a => `  • ${a.nicheName} → ${a.targetPhase}`),
                ].filter(Boolean).join("\n");
                await sendTelegram(lines);
            }
        }
    }
}

async function poll(): Promise<void> {
    if (!running) return;
    try {
        const updates = await getUpdates(offset);
        for (const update of updates) {
            offset = update.update_id + 1;
            try {
                await processUpdate(update);
            } catch (e) {
                console.error("[telegram-poll] Error processing update:", e);
            }
        }
    } catch (e) {
        console.error("[telegram-poll] getUpdates failed:", e);
    }

    // Auto-discard expired discovery actions
    try {
        const expired = await TelegramAction.find({
            status: "pending",
            autoApproveAt: { $lte: new Date() },
        });
        for (const action of expired) {
            if (action.type === "niche-discovery") {
                action.status = "descartar";
                action.resolvedAt = new Date();
                await action.save();
                await Niche.findByIdAndUpdate(action.nicheId, { $set: { status: "archived" } });
                await sendTelegram(`⏱️ <b>Auto-descartado</b> (48h sin respuesta)\n<b>${action.nicheName}</b> → archivado`);
            } else if (action.type === "phase-approve") {
                action.status = "approved";
                action.resolvedAt = new Date();
                await action.save();
                await Niche.findByIdAndUpdate(action.nicheId, { $set: { phase: action.targetPhase } });
                await sendTelegram(`⏱️ <b>Auto-aprobado</b> (24h sin respuesta)\n<b>${action.nicheName}</b> → ${action.targetPhase}`);
            }
            console.log(`[telegram-poll] Expired action handled: ${action.nicheName}`);
        }
    } catch { /* non-critical */ }

    if (running) {
        pollTimer = setTimeout(() => void poll(), 3000);
    }
}

export function startTelegramPolling(io?: any, agenda?: any): void {
    // Always update deps so late-bound agenda/io are picked up on reconnects
    if (io !== undefined) _io = io;
    if (agenda !== undefined) _agenda = agenda;
    if (running) return;
    running = true;
    console.log("[telegram-poll] Started");
    void poll();
}

export function stopTelegramPolling(): void {
    running = false;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    console.log("[telegram-poll] Stopped");
}
