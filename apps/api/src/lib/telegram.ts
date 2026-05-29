import { Settings } from "../models/settings.js";

async function getTelegramConfig(): Promise<{ botToken: string; chatId: string } | null> {
    try {
        const rows = await Settings.find({ key: { $in: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] } }).lean();
        const map = new Map((rows as any[]).map((r) => [r.key, r.value]));
        const botToken = (map.get("TELEGRAM_BOT_TOKEN") as string | undefined)?.trim() ?? "";
        const chatId = (map.get("TELEGRAM_CHAT_ID") as string | undefined)?.trim() ?? "";
        if (!botToken || !chatId) return null;
        return { botToken, chatId };
    } catch {
        return null;
    }
}

export async function sendTelegram(message: string): Promise<void> {
    const cfg = await getTelegramConfig();
    if (!cfg) return;
    try {
        await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.chatId, text: message, parse_mode: "HTML" }),
        });
    } catch (e) {
        console.error("[Telegram] send failed:", e);
    }
}
