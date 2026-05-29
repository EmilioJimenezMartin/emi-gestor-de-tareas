import { getUpdates, answerCallbackQuery, editTelegramMessage, sendTelegram, pinTelegramMessage } from "./telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";

// ── Command registry — add entries here to auto-include them in /ayuda ────────
// Use &lt; &gt; instead of < > to avoid Telegram HTML parse errors
const COMMANDS: Array<{ cmd?: string; desc?: string; section?: string }> = [
    { section: "📚 Nichos" },
    { cmd: "/crear <code>nombre</code>",   desc: "Crea nicho y lanza discovery" },
    { cmd: "/nichos",                      desc: "Resumen por estado y fase" },
    { cmd: "/nicho <code>nombre</code>",   desc: "Info detallada de un nicho" },
    { cmd: "/pdf <code>nombre</code>",     desc: "Abre el PDF de un nicho en la app" },
    { section: "🖼️ Catálogos" },
    { cmd: "/catalogo",                    desc: "Lista catálogos recientes con ID corto" },
    { cmd: "/catalogo <code>id</code>",    desc: "Detalle de un catálogo por ID" },
    { section: "⚙️ Pipeline" },
    { cmd: "/run",                         desc: "Lanza Auto-Pilot ahora" },
    { cmd: "/parar",                       desc: "Detiene el Auto-Pilot en curso" },
    { cmd: "/cola",                        desc: "Cola de generación de catálogos" },
    { cmd: "/config",                      desc: "Ver configuración del Auto-Pilot" },
    { cmd: "/config <code>cats imgs</code>", desc: "Ej: /config 8 5 → 8 catálogos × 5 imgs" },
    { cmd: "/status",                      desc: "Acciones de Telegram pendientes" },
    { section: "❓ Ayuda" },
    { cmd: "/ayuda",                       desc: "Este mensaje (fijado al chat)" },
];

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
            key: { $in: ["AUTOPILOT_CATALOGS_PER_NICHE", "AUTOPILOT_IMAGES_PER_CATALOG"] },
        }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        return {
            catalogsPerNiche: parseInt((map.get("AUTOPILOT_CATALOGS_PER_NICHE") as string) ?? "8") || 8,
            imagesPerCatalog: parseInt((map.get("AUTOPILOT_IMAGES_PER_CATALOG") as string) ?? "5") || 5,
        };
    } catch {
        return { catalogsPerNiche: 8, imagesPerCatalog: 5 };
    }
}

async function handleNicheDiscovery(
    tAction: InstanceType<typeof TelegramAction>,
    decision: "continuar" | "omitir" | "descartar"
): Promise<string> {
    if (decision === "continuar") {
        const cfg = await getAutoPilotConfig();
        await Niche.findByIdAndUpdate(tAction.nicheId, {
            $set: { autoPilotEnabled: true, status: "active", phase: "niche" },
        });
        _io?.emit("niches:updated");
        _io?.emit("telegram:notification", {
            message: `🚀 Pipeline lanzado desde Telegram · ${tAction.nicheName}`,
            type: "success",
        });
        await sendTelegram(
            `🚀 <b>Pipeline lanzado</b>\n` +
            `📚 <b>${tAction.nicheName}</b>\n\n` +
            `Se generarán <b>${cfg.catalogsPerNiche} catálogos</b> × <b>${cfg.imagesPerCatalog} imágenes</b>\n` +
            `El proceso puede tardar varios minutos.`
        );
        // Trigger via agenda; HTTP fallback if agenda not available
        setImmediate(async () => {
            let launched = false;
            try {
                if (_agenda) { await _agenda.now("autopilot-run", {}); launched = true; }
            } catch (e) {
                console.error("[telegram-poll] agenda.now failed:", e);
            }
            if (!launched) {
                const port = process.env.PORT || 3001;
                try { await fetch(`http://localhost:${port}/autopilot/run`, { method: "POST" }); } catch { /* non-critical */ }
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
            const helpMsgId = await sendTelegram(buildHelpText());
            if (helpMsgId) await pinTelegramMessage(helpMsgId);
            return;
        }

        if (text.startsWith("/crear ")) {
            const nicheName = normalized.slice(7).trim();
            if (!nicheName) {
                await sendTelegram("❌ Indica el nombre: <code>/crear nombre del nicho</code>");
                return;
            }
            try {
                const niche = await Niche.create({
                    name: nicheName,
                    status: "found",
                    productType: "coloring-book",
                    styleCategory: "generic",
                    styleCategories: ["generic"],
                });
                _io?.emit("niches:updated");
                _io?.emit("telegram:notification", { message: `📚 Nuevo nicho creado desde Telegram · ${nicheName}`, type: "info" });
                await sendTelegram(
                    `✅ <b>Nicho creado</b>\n📚 <b>${nicheName}</b>\n\n⏳ Iniciando discovery — recibirás la imagen de muestra en breve…`
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

        if (text === "/nichos") {
            try {
                const [total, active, found, archived] = await Promise.all([
                    Niche.countDocuments({}),
                    Niche.countDocuments({ status: "active" }),
                    Niche.countDocuments({ status: "found" }),
                    Niche.countDocuments({ status: "archived" }),
                ]);
                const byPhase = await Niche.aggregate([
                    { $match: { status: "active" } },
                    { $group: { _id: "$phase", count: { $sum: 1 } } },
                ]);
                const phaseMap: Record<string, number> = {};
                for (const p of byPhase) phaseMap[p._id] = p.count;
                const phaseLines = [
                    phaseMap["niche"] ? `  · niche: ${phaseMap["niche"]}` : null,
                    phaseMap["catalog"] ? `  · catalog: ${phaseMap["catalog"]}` : null,
                    phaseMap["pdf"] ? `  · pdf: ${phaseMap["pdf"]}` : null,
                    phaseMap["published"] ? `  · publicado: ${phaseMap["published"]}` : null,
                ].filter(Boolean).join("\n");
                await sendTelegram(
                    `📊 <b>Resumen de nichos</b>\n\n` +
                    `📚 Total: <b>${total}</b>\n` +
                    `✅ Activos: <b>${active}</b>\n` +
                    (phaseLines ? `${phaseLines}\n` : "") +
                    `🔍 En cola: <b>${found}</b>\n` +
                    `🗄️ Archivados: <b>${archived}</b>`
                );
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
            const searchName = normalized.slice(7).trim();
            try {
                const niche = await Niche.findOne({
                    name: { $regex: new RegExp(searchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
                }).lean();
                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con "<b>${searchName}</b>"`);
                    return;
                }
                const { Catalog } = await import("../models/catalog.js");
                const catalogs = await Catalog.find({ nicheIds: String((niche as any)._id) }).lean();
                const totalImages = catalogs.reduce((s: number, c: any) => s + (c.images?.length ?? 0), 0);
                const completedCats = catalogs.filter((c: any) => c.status === "completed").length;
                const listingCount = ((niche as any).listings ?? []).length;
                const phaseLabel: Record<string, string> = {
                    niche: "🏭 Generando catálogos", catalog: "📦 Catálogos en revisión",
                    pdf: "📄 Listo para PDF", published: "✅ Publicado",
                };
                const statusLabel: Record<string, string> = {
                    found: "🔍 En cola de discovery", active: "⚡ Activo en pipeline",
                    archived: "🗄️ Archivado", discarded: "🗑️ Descartado",
                };
                const lines = [
                    `📚 <b>${(niche as any).name}</b>`,
                    ``,
                    `${statusLabel[(niche as any).status] ?? (niche as any).status}${(niche as any).autoPilotEnabled ? " · AutoPilot ON" : ""}`,
                    (niche as any).phase ? phaseLabel[(niche as any).phase] ?? `Fase: ${(niche as any).phase}` : null,
                    ``,
                    `🖼️ <b>${totalImages}</b> imágenes · <b>${completedCats}/${catalogs.length}</b> catálogos`,
                    listingCount > 0 ? `📝 <b>${listingCount}</b> listing${listingCount > 1 ? "s" : ""} SEO generado${listingCount > 1 ? "s" : ""}` : `📝 Sin listing SEO`,
                    (niche as any).tags?.length > 0 ? `🏷️ ${((niche as any).tags as string[]).slice(0, 5).join(", ")}` : null,
                    (niche as any).productType ? `📦 ${(niche as any).productType}` : null,
                    (niche as any).description ? `\n💬 ${((niche as any).description as string).slice(0, 120)}` : null,
                ].filter(Boolean).join("\n");
                await sendTelegram(lines);
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
            }
            return;
        }

        if (text.startsWith("/pdf ")) {
            const searchName = normalized.slice(5).trim();
            try {
                const niche = await Niche.findOne({
                    name: { $regex: new RegExp(searchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
                }).lean();
                if (!niche) {
                    await sendTelegram(`❌ No encontré ningún nicho con "<b>${searchName}</b>"`);
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

        if (text === "/parar") {
            try {
                await Settings.findOneAndUpdate(
                    { key: "AUTOPILOT_ABORT" },
                    { key: "AUTOPILOT_ABORT", value: "1" },
                    { upsert: true }
                );
                _io?.emit("autopilot:error", { message: "⛔ Parada solicitada desde Telegram" });
                await sendTelegram(
                    `🛑 <b>Señal de parada enviada</b>\n\n` +
                    `El Auto-Pilot terminará el paso actual y se detendrá.\n` +
                    `Usa /run para reanudar cuando quieras.`
                );
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
                    if (isNaN(cats) || cats < 1 || isNaN(imgs) || imgs < 1) {
                        await sendTelegram("❌ Valores inválidos. Ejemplo: <code>/config 8 5</code>");
                        return;
                    }
                    await Promise.all([
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
                    ]);
                    _io?.emit("telegram:notification", {
                        message: `⚙️ Config actualizada: ${cats} catálogos × ${imgs} imágenes`,
                        type: "info",
                    });
                    await sendTelegram(
                        `✅ <b>Configuración guardada</b>\n\n` +
                        `📦 Catálogos por nicho: <b>${cats}</b>\n` +
                        `🖼️ Imágenes por catálogo: <b>${imgs}</b>\n\n` +
                        `<i>Aplicado en la próxima ejecución de Auto-Pilot</i>`
                    );
                } else {
                    // Show current config
                    const cfg = await getAutoPilotConfig();
                    await sendTelegram(
                        `⚙️ <b>Configuración Auto-Pilot</b>\n\n` +
                        `📦 Catálogos por nicho: <b>${cfg.catalogsPerNiche}</b>\n` +
                        `🖼️ Imágenes por catálogo: <b>${cfg.imagesPerCatalog}</b>\n\n` +
                        `Para cambiar: <code>/config &lt;catálogos&gt; &lt;imágenes&gt;</code>\n` +
                        `Ejemplo: <code>/config 8 5</code>`
                    );
                }
            } catch (e: any) {
                await sendTelegram(`❌ Error: ${e.message}`);
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
