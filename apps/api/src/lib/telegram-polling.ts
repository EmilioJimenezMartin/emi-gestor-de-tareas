import { getUpdates, answerCallbackQuery, editTelegramMessage, sendTelegram, pinTelegramMessage } from "./telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";

// ── Command registry — add entries here to auto-include them in /ayuda ────────
// Use &lt; &gt; instead of < > to avoid Telegram HTML parse errors
const COMMANDS: Array<{ cmd?: string; desc?: string; section?: string }> = [
    { section: "📚 Nichos" },
    { cmd: "/crear <code>nombre</code>", desc: "Crea nicho y lanza discovery" },
    { cmd: "/nichos",                    desc: "Resumen por estado y fase" },
    { section: "⚙️ Pipeline" },
    { cmd: "/run",                       desc: "Lanza Auto-Pilot ahora" },
    { cmd: "/status",                    desc: "Acciones de Telegram pendientes" },
    { section: "❓ Ayuda" },
    { cmd: "/ayuda",                     desc: "Este mensaje (fijado al chat)" },
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

async function processUpdate(update: any): Promise<void> {
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
