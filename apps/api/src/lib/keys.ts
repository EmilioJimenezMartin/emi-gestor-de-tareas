/** Reads an API key from env first, then MongoDB Settings as fallback. */
export async function getApiKey(envVar: string, settingsKey?: string): Promise<string> {
    const fromEnv = process.env[envVar] ?? "";
    if (fromEnv) return fromEnv;
    try {
        const { Settings } = await import("../models/settings.js");
        const row = await Settings.findOne({ key: settingsKey ?? envVar }).lean();
        return (row as any)?.value ?? "";
    } catch {
        return "";
    }
}
