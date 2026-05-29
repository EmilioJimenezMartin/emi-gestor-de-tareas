import mongoose from "mongoose";
import { Settings } from "../models/settings.js";

type LLMProvider = "google" | "huggingface" | "groq" | "openrouter";

async function getConfig(): Promise<{ provider: LLMProvider; model: string; googleKey: string; hfKey: string; groqKey: string; openrouterKey: string }> {
    let provider: LLMProvider = "google";
    let model = "gemini-2.5-flash";
    let googleKey = process.env.GOOGLE_API_KEY ?? "";
    let hfKey = process.env.HUGGINGFACE_API_KEY ?? "";
    let groqKey = process.env.GROQ_API_KEY ?? "";
    let openrouterKey = process.env.OPENROUTER_API_KEY ?? "";

    if (mongoose.connection.readyState === 1) {
        try {
            const rows = await Settings.find({ key: { $in: ["DEFAULT_LLM_PROVIDER", "DEFAULT_LLM_MODEL", "GOOGLE_API_KEY", "HUGGINGFACE_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"] } });
            const map = new Map(rows.map(r => [r.key, r.value]));
            if (map.has("DEFAULT_LLM_PROVIDER")) provider = map.get("DEFAULT_LLM_PROVIDER") as LLMProvider;
            if (map.has("DEFAULT_LLM_MODEL")) model = map.get("DEFAULT_LLM_MODEL");
            if (map.has("GOOGLE_API_KEY") && map.get("GOOGLE_API_KEY")) googleKey = map.get("GOOGLE_API_KEY");
            if (map.has("HUGGINGFACE_API_KEY") && map.get("HUGGINGFACE_API_KEY")) hfKey = map.get("HUGGINGFACE_API_KEY");
            if (map.has("GROQ_API_KEY") && map.get("GROQ_API_KEY")) groqKey = map.get("GROQ_API_KEY");
            if (map.has("OPENROUTER_API_KEY") && map.get("OPENROUTER_API_KEY")) openrouterKey = map.get("OPENROUTER_API_KEY");
        } catch {
            // Fallback to env
        }
    }

    return { provider, model, googleKey, hfKey, groqKey, openrouterKey };
}

async function groqChat(groqKey: string, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 1024, temperature = 0.4): Promise<string> {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: model || "llama-3.3-70b-versatile", messages, max_tokens: maxTokens, temperature }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq API error ${res.status}: ${err}`);
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return (data.choices[0]?.message?.content ?? "").trim();
}

async function openrouterChat(openrouterKey: string, model: string, messages: Array<{ role: string; content: string }>, maxTokens = 1024, temperature = 0.4): Promise<string> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openrouterKey}`,
            "HTTP-Referer": "https://emi-gestor-de-tareas.local",
            "X-Title": "Emi Gestor de Tareas",
        },
        body: JSON.stringify({ model: model || "google/gemini-2.5-flash", messages, max_tokens: maxTokens, temperature }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return (data.choices[0]?.message?.content ?? "").trim();
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

    if (config.provider === "groq" && config.groqKey) {
        const jsonNote = "\n\nCRITICAL: Respond with ONLY a valid JSON array. No markdown, no code fences, no backticks. Start with [ and end with ].";
        const raw = await groqChat(config.groqKey, config.model, [{ role: "user", content: systemPrompt + jsonNote }], 1024, 0.1);
        const text = raw.replace(/^```(?:json|)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const s = text.indexOf("["), e = text.lastIndexOf("]");
        if (s !== -1 && e !== -1) {
            try { return JSON.parse(text.substring(s, e + 1)); } catch { return []; }
        }
        return [];
    }

    if (config.provider === "openrouter" && config.openrouterKey) {
        const jsonNote = "\n\nCRITICAL: Respond with ONLY a valid JSON array. No markdown, no code fences, no backticks. Start with [ and end with ].";
        const raw = await openrouterChat(config.openrouterKey, config.model, [{ role: "user", content: systemPrompt + jsonNote }], 1024, 0.1);
        const text = raw.replace(/^```(?:json|)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const s = text.indexOf("["), e = text.lastIndexOf("]");
        if (s !== -1 && e !== -1) {
            try { return JSON.parse(text.substring(s, e + 1)); } catch { return []; }
        }
        return [];
    }

    if (config.provider === "huggingface" && config.hfKey) {
        const { HfInference } = await import("@huggingface/inference");
        const hf = new HfInference(config.hfKey);
        const jsonEnforcement = "\n\nCRITICAL: Respond with ONLY a valid JSON array. No markdown, no code fences, no backticks, no explanations. Start with [ and end with ].";
        const response = await hf.chatCompletion({
            model: config.model || "Qwen/Qwen2.5-7B-Instruct",
            messages: [{ role: "user", content: systemPrompt + jsonEnforcement }],
            max_tokens: 1024,
            temperature: 0.1,
        });
        const raw = (response.choices[0].message.content ?? "").trim();
        const text = raw.replace(/^```(?:json|)?\s*/i, "").replace(/```\s*$/i, "").trim();
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
        description: `Extracto de ${sourceUrl}. Configura tu API key de Google, Groq o HuggingFace en Ajustes para análisis real.`,
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
        return text;
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

    if (config.provider === "groq" && config.groqKey) {
        const result = await groqChat(config.groqKey, config.model, [{ role: "user", content: prompt }], 200, Math.max(0.3, creativity / 100));
        return result || text;
    }

    if (config.provider === "openrouter" && config.openrouterKey) {
        const result = await openrouterChat(config.openrouterKey, config.model, [{ role: "user", content: prompt }], 200, Math.max(0.3, creativity / 100));
        return result || text;
    }

    if (config.provider === "huggingface" && config.hfKey) {
        const { HfInference } = await import("@huggingface/inference");
        const hf = new HfInference(config.hfKey);
        const response = await hf.chatCompletion({
            model: config.model || "Qwen/Qwen2.5-7B-Instruct",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: Math.max(0.3, creativity / 100),
        });
        const result = (response.choices[0].message.content ?? "").trim();
        return result || text;
    }

    return text;
}

/**
 * Generic text generation using the configured LLM.
 * Returns the raw text response. Throws if no provider is available.
 */
export async function generateTextWithLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const config = await getConfig();

    if (config.provider === "google" && config.googleKey) {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(config.googleKey);
        const model = genAI.getGenerativeModel({
            model: config.model || "gemini-2.5-flash",
            systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text().trim();
    }

    if (config.provider === "groq" && config.groqKey) {
        const jsonEnforcement = "\n\nCRITICAL: Respond with ONLY a valid JSON object. No markdown, no code fences (```), no backticks, no explanations. Start with { and end with }.";
        const raw = await groqChat(config.groqKey, config.model, [
            { role: "system", content: systemPrompt + jsonEnforcement },
            { role: "user", content: userPrompt },
        ], 1024, 0.4);
        return raw.replace(/^```(?:json|html|xml|)?\s*/i, "").replace(/```\s*$/i, "").trim();
    }

    if (config.provider === "openrouter" && config.openrouterKey) {
        const raw = await openrouterChat(config.openrouterKey, config.model, [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ], 1024, 0.4);
        return raw.replace(/^```(?:json|html|xml|)?\s*/i, "").replace(/```\s*$/i, "").trim();
    }

    if (config.provider === "huggingface" && config.hfKey) {
        const { HfInference } = await import("@huggingface/inference");
        const hf = new HfInference(config.hfKey);
        const jsonEnforcement = "\n\nCRITICAL: Respond with ONLY a valid JSON object. No markdown, no code fences (```), no backticks, no explanations. Start with { and end with }.";
        const response = await hf.chatCompletion({
            model: config.model || "Qwen/Qwen2.5-7B-Instruct",
            messages: [
                { role: "system", content: systemPrompt + jsonEnforcement },
                { role: "user", content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.4,
        });
        const raw = (response.choices[0].message.content ?? "").trim();
        return raw
            .replace(/^```(?:json|html|xml|)?\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
    }

    throw new Error("No hay proveedor de IA configurado. Configura Google, Groq, OpenRouter o HuggingFace en Ajustes → Núcleo de Inteligencia.");
}

function isQuotaError(err: any): boolean {
    const msg: string = (err?.message ?? err?.toString() ?? "").toLowerCase();
    return /quota|rate.?limit|429|too many requests|limit:\s*0|daily limit|exhausted|capacity|overloaded/i.test(msg);
}

/**
 * Analyze scraped page text for radar/niche detection.
 * Tries providers in priority order (configured default first), falling back
 * automatically to the next available provider on quota/rate-limit errors.
 *
 * @param skipProviders  providers to skip entirely (e.g. already tried via llm-scraper)
 * @param onLog          optional callback for progress messages logged to the radar UI
 */
export async function analyzePageForRadar(
    pageText: string,
    systemPrompt: string,
    opts: {
        skipProviders?: LLMProvider[];
        onLog?: (msg: string) => void;
    } = {}
): Promise<any> {
    const config = await getConfig();
    const skip = new Set(opts.skipProviders ?? []);
    const log = opts.onLog ?? (() => {});

    const truncated = pageText.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 20000);
    const userMsg = `Contenido de la página:\n\n${truncated}`;

    const parseJson = (text: string): any => {
        const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        const match = clean.match(/(\{[\s\S]*\})/);
        if (!match) throw new Error(`La respuesta no contiene JSON válido: ${text.slice(0, 200)}`);
        return JSON.parse(match[1]);
    };

    // Build ordered list: configured provider first, then the rest
    const ALL_PROVIDERS: LLMProvider[] = ["google", "openrouter", "groq", "huggingface"];
    const ordered: LLMProvider[] = [
        config.provider,
        ...ALL_PROVIDERS.filter(p => p !== config.provider),
    ];

    const tryProvider = async (provider: LLMProvider): Promise<any> => {
        if (provider === "google" && config.googleKey) {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(config.googleKey);
            const m = genAI.getGenerativeModel({ model: config.model || "gemini-2.5-flash", systemInstruction: systemPrompt });
            const result = await m.generateContent(userMsg);
            return parseJson(result.response.text().trim());
        }
        if (provider === "openrouter" && config.openrouterKey) {
            const raw = await openrouterChat(config.openrouterKey, config.model, [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMsg },
            ], 4096, 0.1);
            return parseJson(raw);
        }
        if (provider === "groq" && config.groqKey) {
            const raw = await groqChat(config.groqKey, config.model, [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMsg },
            ], 4096, 0.1);
            return parseJson(raw);
        }
        if (provider === "huggingface" && config.hfKey) {
            const { HfInference } = await import("@huggingface/inference");
            const hf = new HfInference(config.hfKey);
            const response = await hf.chatCompletion({
                model: config.model || "meta-llama/Llama-3.3-70B-Instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMsg },
                ],
                max_tokens: 4096,
                temperature: 0.1,
            });
            return parseJson((response.choices[0]?.message?.content ?? "").trim());
        }
        return null; // provider not configured
    };

    let lastErr: any;
    for (const provider of ordered) {
        if (skip.has(provider)) continue;
        try {
            const result = await tryProvider(provider);
            if (result !== null) {
                if (provider !== config.provider) {
                    log(`[FALLBACK] ✓ Respondió ${provider} (${config.provider} agotado)`);
                }
                return result;
            }
        } catch (err: any) {
            lastErr = err;
            if (isQuotaError(err)) {
                const remaining = ordered.filter(p => !skip.has(p) && p !== provider);
                const next = remaining.find(p =>
                    (p === "google" && config.googleKey) ||
                    (p === "openrouter" && config.openrouterKey) ||
                    (p === "groq" && config.groqKey) ||
                    (p === "huggingface" && config.hfKey)
                );
                if (next) {
                    log(`[FALLBACK] ${provider} límite diario alcanzado → intentando ${next}...`);
                    skip.add(provider);
                    continue;
                }
                log(`[FALLBACK] ${provider} límite alcanzado y no hay más providers configurados.`);
            }
            throw err;
        }
    }

    throw lastErr ?? new Error("Ningún proveedor de IA disponible. Configura al menos uno en Ajustes.");
}
