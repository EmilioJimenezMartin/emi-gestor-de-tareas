import { Settings } from "../models/settings.js";

// Check if a notification event is enabled in NOTIFICATION_RULES (defaults to true if not set)
export async function shouldNotify(eventId: string): Promise<boolean> {
    try {
        const row = await Settings.findOne({ key: "NOTIFICATION_RULES" }).lean();
        if (!row?.value) return true;
        const rules = JSON.parse(row.value as string) as Array<{ id: string; enabled: boolean }>;
        const rule = rules.find(r => r.id === eventId);
        return rule?.enabled ?? true;
    } catch {
        return true;
    }
}

async function getTelegramConfig(): Promise<{ botToken: string; chatId: string } | null> {
    try {
        const rows = await Settings.find({ key: { $in: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] } }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        const botToken = ((map.get("TELEGRAM_BOT_TOKEN") as string | undefined)?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim()) ?? "";
        const chatId = ((map.get("TELEGRAM_CHAT_ID") as string | undefined)?.trim() || process.env.TELEGRAM_CHAT_ID?.trim()) ?? "";
        if (!botToken || !chatId) return null;
        return { botToken, chatId };
    } catch {
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
        const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
        if (!botToken || !chatId) return null;
        return { botToken, chatId };
    }
}

export async function sendTelegram(message: string): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.chatId, text: message, parse_mode: "HTML" }),
        });
        const data = await res.json() as any;
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] send failed:", e);
        return null;
    }
}

// Send a photo with 3 action buttons (niche discovery)
export async function sendTelegramPhotoDiscovery(opts: {
    imageUrl: string;
    caption: string;
    actionId: string;
}): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;

    const reply_markup = {
        inline_keyboard: [[
            { text: "🚀 Continuar", callback_data: `continuar:${opts.actionId}` },
            { text: "⏭️ Omitir", callback_data: `omitir:${opts.actionId}` },
            { text: "🗑️ Descartar", callback_data: `descartar:${opts.actionId}` },
        ]],
    };

    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                photo: opts.imageUrl,
                caption: opts.caption,
                parse_mode: "HTML",
                reply_markup,
            }),
            signal: AbortSignal.timeout(30_000),
        });
        const data = await res.json() as any;
        if (data.ok) return data.result.message_id;
        console.error("[Telegram] sendPhoto error (fallback to text):", data.description ?? data);
    } catch (e) {
        console.error("[Telegram] sendPhoto failed (fallback to text):", (e as Error).message);
    }

    // Fallback: text message with the same buttons when Telegram can't download the image
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                text: opts.caption,
                parse_mode: "HTML",
                reply_markup,
            }),
        });
        const data = await res.json() as any;
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendMessage fallback failed:", e);
        return null;
    }
}

// Upload raw image bytes as a photo (avoids Telegram's URL-download timeout)
export async function sendTelegramImageBinary(
    buffer: Buffer,
    caption: string,
    mimeType = "image/jpeg"
): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const formData = new FormData();
        formData.append("chat_id", cfg.chatId);
        formData.append("photo", new Blob([buffer], { type: mimeType }), "image.jpg");
        formData.append("caption", caption);
        formData.append("parse_mode", "HTML");
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
            method: "POST",
            body: formData,
        });
        const data = await res.json() as any;
        if (!data.ok) console.error("[Telegram] sendImageBinary error:", data.description ?? data);
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendImageBinary failed:", e);
        return null;
    }
}

export async function sendTelegramImageWithButtons(
    buffer: Buffer,
    caption: string,
    rows: { text: string; callback_data: string }[][],
    mimeType = "image/jpeg"
): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const formData = new FormData();
        formData.append("chat_id", cfg.chatId);
        formData.append("photo", new Blob([buffer], { type: mimeType }), "image.jpg");
        formData.append("caption", caption);
        formData.append("parse_mode", "HTML");
        formData.append("reply_markup", JSON.stringify({ inline_keyboard: rows }));
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
            method: "POST",
            body: formData,
        });
        const data = await res.json() as any;
        if (!data.ok) console.error("[Telegram] sendImageWithButtons error:", data.description ?? data);
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendImageWithButtons failed:", e);
        return null;
    }
}

// Send a photo without inline keyboard (e.g. pipeline completion notifications)
export async function sendTelegramPhoto(imageUrl: string, caption: string): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.chatId, photo: imageUrl, caption, parse_mode: "HTML" }),
        });
        const data = await res.json() as any;
        if (!data.ok) console.error("[Telegram] sendPhoto error:", data);
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendPhoto failed:", e);
        return null;
    }
}

// Send text with 2-button approval (pipeline phase transitions)
export async function sendTelegramApproval(opts: {
    text: string;
    actionId: string;
}): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                text: opts.text,
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [[
                        { text: "✅ Aprobar", callback_data: `approve:${opts.actionId}` },
                        { text: "❌ Rechazar", callback_data: `reject:${opts.actionId}` },
                    ]],
                },
            }),
        });
        const data = await res.json() as any;
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendApproval failed:", e);
        return null;
    }
}

// Edit an existing message (to update after user responds)
export async function editTelegramMessage(messageId: number, text: string): Promise<void> {
    const cfg = await getTelegramConfig();
    if (!cfg) return;
    try {
        await fetch(`https://api.telegram.org/bot${cfg.botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                message_id: messageId,
                text,
                parse_mode: "HTML",
            }),
        });
    } catch { /* best-effort */ }
}

// Pin a message in the chat
export async function pinTelegramMessage(messageId: number): Promise<void> {
    const cfg = await getTelegramConfig();
    if (!cfg) return;
    try {
        await fetch(`https://api.telegram.org/bot${cfg.botToken}/pinChatMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.chatId, message_id: messageId, disable_notification: true }),
        });
    } catch { /* best-effort */ }
}

// Send text with a custom inline keyboard
export async function sendTelegramButtons(
    text: string,
    rows: { text: string; callback_data: string }[][]
): Promise<number | null> {
    const cfg = await getTelegramConfig();
    if (!cfg) return null;
    try {
        const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: cfg.chatId,
                text,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: rows },
            }),
        });
        const data = await res.json() as any;
        return data?.result?.message_id ?? null;
    } catch (e) {
        console.error("[Telegram] sendButtons failed:", e);
        return null;
    }
}

// Answer a callback query (removes loading state from button)
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const cfg = await getTelegramConfig();
    if (!cfg) return;
    try {
        await fetch(`https://api.telegram.org/bot${cfg.botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text: text ?? "" }),
        });
    } catch { /* best-effort */ }
}

// Get pending updates (used by the polling loop)
export async function getUpdates(offset: number): Promise<any[]> {
    const cfg = await getTelegramConfig();
    if (!cfg) return [];
    try {
        const res = await fetch(
            `https://api.telegram.org/bot${cfg.botToken}/getUpdates?offset=${offset}&timeout=10&allowed_updates=["callback_query","message"]`
        );
        const data = await res.json() as any;
        return data?.result ?? [];
    } catch {
        return [];
    }
}
