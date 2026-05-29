import { getUpdates, answerCallbackQuery, editTelegramMessage, sendTelegram } from "./telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { Niche } from "../models/niche.js";
import { Settings } from "../models/settings.js";

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
        // Activate autopilot on the niche and set it to active status
        await Niche.findByIdAndUpdate(tAction.nicheId, {
            $set: { autoPilotEnabled: true, status: "active", phase: "niche" },
        });
        _io?.emit("niches:updated");
        await sendTelegram(
            `🚀 <b>Pipeline lanzado</b>\n` +
            `📚 <b>${tAction.nicheName}</b>\n\n` +
            `Se generarán <b>${cfg.catalogsPerNiche} catálogos</b> × <b>${cfg.imagesPerCatalog} imágenes</b>\n` +
            `El proceso puede tardar varios minutos.`
        );
        // Trigger autopilot pipeline directly via agenda (avoids HTTP hop)
        try {
            if (_agenda) {
                await _agenda.now("autopilot-run", {});
            }
        } catch { /* non-critical — pipeline will run on next scheduled cycle */ }
        return `✅ Lanzado — ${cfg.catalogsPerNiche} catálogos en producción`;
    }

    if (decision === "omitir") {
        await sendTelegram(`⏭️ <b>Nicho omitido</b>\n<b>${tAction.nicheName}</b> — quedará para la próxima ejecución`);
        return "⏭️ Omitido — volvemos en la próxima ejecución";
    }

    if (decision === "descartar") {
        await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { status: "archived", autoPilotEnabled: false } });
        _io?.emit("niches:updated");
        await sendTelegram(`🗑️ <b>Nicho descartado</b>\n<b>${tAction.nicheName}</b> — archivado`);
        return "🗑️ Archivado";
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
        await sendTelegram(`🚀 <b>Pipeline avanzado</b>\n<b>${tAction.nicheName}</b> → fase <b>${tAction.targetPhase}</b>`);
        return `✅ Avanzando a ${tAction.targetPhase}`;
    } else {
        await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { autoPilotEnabled: false } });
        _io?.emit("niches:updated");
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
        const text: string = update.message.text.trim().toLowerCase();

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
    if (running) return;
    _io = io ?? null;
    _agenda = agenda ?? null;
    running = true;
    console.log("[telegram-poll] Started");
    void poll();
}

export function stopTelegramPolling(): void {
    running = false;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    console.log("[telegram-poll] Stopped");
}
