import { getUpdates, answerCallbackQuery, editTelegramMessage, sendTelegram } from "./telegram.js";
import { TelegramAction } from "../models/telegram-action.js";
import { Niche } from "../models/niche.js";

let offset = 0;
let running = false;
let pollTimer: NodeJS.Timeout | null = null;

async function processUpdate(update: any): Promise<void> {
    // Handle inline keyboard button presses
    if (update.callback_query) {
        const cq = update.callback_query;
        const data: string = cq.data ?? "";
        const [action, actionId] = data.split(":");

        if ((action === "approve" || action === "reject") && actionId) {
            const tAction = await TelegramAction.findById(actionId);
            if (!tAction || tAction.status !== "pending") {
                await answerCallbackQuery(cq.id, "Esta acción ya fue procesada");
                return;
            }

            const approved = action === "approve";
            tAction.status = approved ? "approved" : "rejected";
            tAction.resolvedAt = new Date();
            await tAction.save();

            await answerCallbackQuery(cq.id, approved ? "✅ Aprobado" : "❌ Rechazado");

            if (tAction.messageId) {
                const statusLine = approved
                    ? `✅ <b>Aprobado por ti</b> — avanzando a fase <b>${tAction.targetPhase}</b>`
                    : `❌ <b>Rechazado</b> — nicho pausado`;
                await editTelegramMessage(
                    tAction.messageId,
                    `🏭 <b>${tAction.nicheName}</b>\n${statusLine}`
                );
            }

            if (approved) {
                // Advance niche to target phase
                await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { phase: tAction.targetPhase } });
                await sendTelegram(`🚀 <b>Pipeline avanzado</b>\n<b>${tAction.nicheName}</b> → fase <b>${tAction.targetPhase}</b>`);
                console.log(`[telegram-poll] Approved: ${tAction.nicheName} → ${tAction.targetPhase}`);
            } else {
                // Pause the niche
                await Niche.findByIdAndUpdate(tAction.nicheId, { $set: { autoPilotEnabled: false } });
                await sendTelegram(`⏸️ <b>Nicho pausado</b>\n<b>${tAction.nicheName}</b> — Auto-Pilot desactivado`);
                console.log(`[telegram-poll] Rejected: ${tAction.nicheName} paused`);
            }
        }
        return;
    }

    // Handle text commands
    if (update.message?.text) {
        const text: string = update.message.text.trim().toLowerCase();
        if (text === "/status") {
            const pending = await TelegramAction.find({ status: "pending" }).lean();
            if (pending.length === 0) {
                await sendTelegram("✅ No hay acciones pendientes de aprobación");
            } else {
                const lines = pending.map(a => `• <b>${a.nicheName}</b> → ${a.targetPhase}`).join("\n");
                await sendTelegram(`⏳ <b>Pendientes (${pending.length})</b>\n${lines}`);
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

    // Auto-approve expired pending actions (24h timeout)
    try {
        const expired = await TelegramAction.find({
            status: "pending",
            autoApproveAt: { $lte: new Date() },
        });
        for (const action of expired) {
            action.status = "approved";
            action.resolvedAt = new Date();
            await action.save();
            await Niche.findByIdAndUpdate(action.nicheId, { $set: { phase: action.targetPhase } });
            await sendTelegram(`⏱️ <b>Auto-aprobado</b> (24h sin respuesta)\n<b>${action.nicheName}</b> → ${action.targetPhase}`);
            console.log(`[telegram-poll] Auto-approved: ${action.nicheName} → ${action.targetPhase}`);
        }
    } catch { /* non-critical */ }

    if (running) {
        pollTimer = setTimeout(() => void poll(), 3000);
    }
}

export function startTelegramPolling(): void {
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
