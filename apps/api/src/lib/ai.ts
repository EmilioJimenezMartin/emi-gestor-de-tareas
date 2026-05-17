import mongoose from "mongoose";
import { Settings } from "../models/settings.js";

type LLMProvider = "google" | "huggingface";

async function getConfig(): Promise<{ provider: LLMProvider; model: string; googleKey: string; hfKey: string }> {
    let provider: LLMProvider = "google";
    let model = "gemini-2.5-flash";
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

export async function varyTextWithLLM(text: string, creativity = 50): Promise<string> {
    const config = await getConfig();

    let instruction: string;
    if (creativity <= 10) {
        return text; // no variation at all
    } else if (creativity <= 35) {
        instruction = "Slightly rephrase the following text — swap one or two synonyms at most, keep virtually the same meaning.";
    } else if (creativity <= 65) {
        instruction = "Rephrase the following text to make it unique. Vary the wording and structure while preserving the core subject.";
    } else if (creativity <= 85) {
        instruction = "Significantly rephrase the following text. You can change the focus, swap the main subject with a related concept, or add a creative twist — same general theme but noticeably different.";
    } else {
        instruction = "Completely reimagine the following text. Keep only the broad thematic area and produce something genuinely different and creative.";
    }

    const prompt = `${instruction} Return ONLY the result, no quotes, no explanations.\n\nText: ${text}`;

    if (config.provider === "google" && config.googleKey) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: config.googleKey });
        const model = config.model || "gemini-2.5-flash";
        const response = await ai.models.generateContent({ model, contents: prompt });
        return (response.text ?? "").trim() || text;
    }

    if (config.provider === "huggingface" && config.hfKey) {
        const { HfInference } = await import("@huggingface/inference");
        const hf = new HfInference(config.hfKey);
        const response = await hf.textGeneration({
            model: config.model,
            inputs: prompt,
            parameters: { max_new_tokens: 200, temperature: Math.max(0.3, creativity / 100) }
        });
        const result = (response.generated_text ?? "").replace(prompt, "").trim();
        return result || text;
    }

    return text;
}
