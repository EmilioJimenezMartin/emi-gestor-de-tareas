import mongoose from "mongoose";
import { Settings } from "../models/settings.js";

type LLMProvider = "google" | "huggingface";

async function getConfig(): Promise<{ provider: LLMProvider; model: string; googleKey: string; hfKey: string }> {
    let provider: LLMProvider = "google";
    let model = "gemini-1.5-flash";
    let googleKey = process.env.GOOGLE_API_KEY ?? "";
    let hfKey = process.env.HUGGINGFACE_API_KEY ?? "";

    if (mongoose.connection.readyState === 1) {
        try {
            const rows = await Settings.find({ key: { $in: ["DEFAULT_LLM_PROVIDER", "DEFAULT_LLM_MODEL", "GOOGLE_API_KEY", "HUGGINGFACE_API_KEY"] } });
            const map = new Map(rows.map(r => [r.key, r.value]));
            if (map.has("DEFAULT_LLM_PROVIDER")) provider = map.get("DEFAULT_LLM_PROVIDER") as LLMProvider;
            if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL");
            if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY");
            if (map.has("HUGGINGFACE_API_KEY") && map.get("HUGGINGFACE_API_KEY")) hfKey = map.get("HUGGINGFACE_API_KEY");
        } catch {
            // Fallback to env
        }
    }

    return { provider, model, googleKey, hfKey };
}

export interface AIExtractedItem {
    id: string;
    title: string;
    description: string;
    type?: string;
    tags?: string[];
    confidence?: number;
    relevance?: number;
    raw?: string;
}

export async function analyzeWithAI(rawText: string, userPrompt: string, sourceUrl: string): Promise<AIExtractedItem[]> {
    const config = await getConfig();

    const systemPrompt = `You are a data extraction engine. The user wants you to analyze the following raw web/API content and extract structured data as a JSON array.

User instructions: ${userPrompt}

Source URL: ${sourceUrl}

Rules:
- Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
- Each item must have: id (unique slug), title (string), description (string, max 300 chars), type (string), tags (string array, max 5), confidence (0-1 float), relevance (0-1 float)
- If nothing relevant is found, return []

Raw content (truncated to 4000 chars):
${rawText.substring(0, 4000)}`;

    if (config.provider === "google" && config.googleKey) {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(config.googleKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent(systemPrompt);
        const text = result.response.text().trim();
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    if (config.provider === "huggingface" && config.hfKey) {
        const { HfInference } = await import("@huggingface/inference");
        const hf = new HfInference(config.hfKey);
        const response = await hf.textGeneration({
            model: config.model,
            inputs: systemPrompt,
            parameters: { max_new_tokens: 1024, temperature: 0.1 }
        });
        const text = (response.generated_text ?? "").trim();
        const jsonStart = text.indexOf("[");
        const jsonEnd = text.lastIndexOf("]");
        if (jsonStart !== -1 && jsonEnd !== -1) {
            try {
                return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
            } catch {
                return [];
            }
        }
        return [];
    }

    // No valid provider/key — return mock fallback
    return [{
        id: `item-${Date.now()}`,
        title: "AI no configurada — resultado de muestra",
        description: `Extracto de ${sourceUrl}. Configura tu API key de Google o HuggingFace en Ajustes para análisis real.`,
        type: "sample",
        tags: ["sin-ia", "muestra"],
        confidence: 0.1,
        relevance: 0.1,
        raw: rawText.substring(0, 500)
    }];
}
