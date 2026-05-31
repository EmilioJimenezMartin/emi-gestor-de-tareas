"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BrainCircuit,
    Settings,
    Shield,
    Bell,
    Database,
    Sparkles,
    Zap,
    Cpu,
    Lock,
    Globe,
    BellRing,
    Loader2,
    Cloud,
    Eye,
    EyeOff,
    Package,
    ShoppingBag,
    Store,
    Send,
    MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";

export default function AjustesPage() {
    const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "disconnected" | "connecting" | "disconnecting">("connecting");
    const [isSaving, setIsSaving] = useState(false);

    const [defaultProvider, setDefaultProvider] = useState("google");
    const [defaultModel, setDefaultModel] = useState("gemini-2.5-flash");

    const [googleApiKey, setGoogleApiKey] = useState("");
    const [showGoogleKey, setShowGoogleKey] = useState(false);

    const [groqApiKey, setGroqApiKey] = useState("");
    const [showGroqKey, setShowGroqKey] = useState(false);

    const [openrouterApiKey, setOpenrouterApiKey] = useState("");
    const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);

    const [hfInferenceKey, setHfInferenceKey] = useState("");
    const [showHfInferenceKey, setShowHfInferenceKey] = useState(false);

    const [cloudinaryCloudName, setCloudinaryCloudName] = useState("af6b2f473a2cd3539b6d7bef68fb37");
    const [cloudinaryApiKey, setCloudinaryApiKey] = useState("");
    const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState("");
    const [showCloudinaryKey, setShowCloudinaryKey] = useState(false);
    const [showCloudinarySecret, setShowCloudinarySecret] = useState(false);

    // Gelato
    const [gelatoApiKey, setGelatoApiKey] = useState("");
    const [gelatoStoreId, setGelatoStoreId] = useState("");
    const [showGelatoKey, setShowGelatoKey] = useState(false);
    const [publicApiUrl, setPublicApiUrl] = useState("");

    // HuggingFace Hub
    const [hfWriteToken, setHfWriteToken] = useState("");
    const [hfUsername, setHfUsername] = useState("");
    const [showHfToken, setShowHfToken] = useState(false);

    // Etsy
    const [etsyApiKey, setEtsyApiKey] = useState("");
    const [etsyApiSecret, setEtsyApiSecret] = useState("");
    const [etsyShopId, setEtsyShopId] = useState("");
    const [etsyRedirectUri, setEtsyRedirectUri] = useState("");
    const [showEtsySecret, setShowEtsySecret] = useState(false);

    // Telegram
    const [telegramToken, setTelegramToken] = useState("");
    const [telegramChatId, setTelegramChatId] = useState("");
    const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);
    const [showTelegramToken, setShowTelegramToken] = useState(false);
    const [testingTelegram, setTestingTelegram] = useState(false);

    const apiUrl = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""), []);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch(`${apiUrl}/settings`);
                if (!res.ok) {
                    toast.error("No se pudo cargar la configuración (API/Mongo no disponible)");
                    return;
                }

                const json = await res.json();
                const map = new Map();
                json.settings?.forEach((s: any) => map.set(s.key, s.value));

                if (map.has("DEFAULT_LLM_PROVIDER")) setDefaultProvider(map.get("DEFAULT_LLM_PROVIDER"));
                if (map.has("DEFAULT_LLM_MODEL")) setDefaultModel(map.get("DEFAULT_LLM_MODEL"));
                if (map.has("GOOGLE_API_KEY")) setGoogleApiKey(map.get("GOOGLE_API_KEY"));
                if (map.has("GROQ_API_KEY")) setGroqApiKey(map.get("GROQ_API_KEY"));
                if (map.has("OPENROUTER_API_KEY")) setOpenrouterApiKey(map.get("OPENROUTER_API_KEY"));
                if (map.has("HUGGINGFACE_API_KEY")) setHfInferenceKey(map.get("HUGGINGFACE_API_KEY"));
                if (map.has("CLOUDINARY_CLOUD_NAME")) setCloudinaryCloudName(map.get("CLOUDINARY_CLOUD_NAME"));
                if (map.has("CLOUDINARY_API_KEY")) setCloudinaryApiKey(map.get("CLOUDINARY_API_KEY"));
                if (map.has("CLOUDINARY_API_SECRET")) setCloudinaryApiSecret(map.get("CLOUDINARY_API_SECRET"));
                if (map.has("GELATO_API_KEY")) setGelatoApiKey(map.get("GELATO_API_KEY"));
                if (map.has("GELATO_STORE_ID")) setGelatoStoreId(map.get("GELATO_STORE_ID"));
                if (map.has("PUBLIC_API_URL")) setPublicApiUrl(map.get("PUBLIC_API_URL"));
                if (map.has("ETSY_API_KEY")) setEtsyApiKey(map.get("ETSY_API_KEY"));
                if (map.has("ETSY_API_SECRET")) setEtsyApiSecret(map.get("ETSY_API_SECRET"));
                if (map.has("ETSY_SHOP_ID")) setEtsyShopId(map.get("ETSY_SHOP_ID"));
                if (map.has("ETSY_REDIRECT_URI")) setEtsyRedirectUri(map.get("ETSY_REDIRECT_URI"));
                if (map.has("HUGGINGFACE_WRITE_TOKEN")) setHfWriteToken(map.get("HUGGINGFACE_WRITE_TOKEN"));
                if (map.has("HUGGINGFACE_USERNAME")) setHfUsername(map.get("HUGGINGFACE_USERNAME"));
                if (map.has("TELEGRAM_BOT_TOKEN")) setTelegramToken(map.get("TELEGRAM_BOT_TOKEN"));
                if (map.has("TELEGRAM_CHAT_ID")) setTelegramChatId(map.get("TELEGRAM_CHAT_ID"));
                if (map.has("TELEGRAM_WEEKLY_DIGEST")) setWeeklyDigestEnabled(map.get("TELEGRAM_WEEKLY_DIGEST") !== "false");
            } catch (err) {
                console.error(err);
                toast.error("Error de red conectando con la API");
            }
        }
        fetchSettings();
    }, [apiUrl]);

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("db:status", (data) => {
            if (["unknown", "connected", "disconnected", "connecting", "disconnecting"].includes(data.status)) {
                setDbStatus(data.status);
            }
        });
        socket.on("disconnect", () => setDbStatus("unknown"));
        socket.on("connect_error", () => setDbStatus("unknown"));
        return () => { socket.disconnect() };
    }, [apiUrl]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = [
                { key: "DEFAULT_LLM_PROVIDER", value: defaultProvider },
                { key: "DEFAULT_LLM_MODEL", value: defaultModel },
                { key: "GOOGLE_API_KEY", value: googleApiKey },
                { key: "GROQ_API_KEY", value: groqApiKey },
                { key: "OPENROUTER_API_KEY", value: openrouterApiKey },
                { key: "HUGGINGFACE_API_KEY", value: hfInferenceKey },
                { key: "CLOUDINARY_CLOUD_NAME", value: cloudinaryCloudName },
                { key: "CLOUDINARY_API_KEY", value: cloudinaryApiKey },
                { key: "CLOUDINARY_API_SECRET", value: cloudinaryApiSecret },
                { key: "GELATO_API_KEY", value: gelatoApiKey },
                { key: "GELATO_STORE_ID", value: gelatoStoreId },
                { key: "PUBLIC_API_URL", value: publicApiUrl },
                { key: "ETSY_API_KEY", value: etsyApiKey },
                { key: "ETSY_API_SECRET", value: etsyApiSecret },
                { key: "ETSY_SHOP_ID", value: etsyShopId },
                { key: "ETSY_REDIRECT_URI", value: etsyRedirectUri },
                { key: "HUGGINGFACE_WRITE_TOKEN", value: hfWriteToken },
                { key: "HUGGINGFACE_USERNAME", value: hfUsername },
                { key: "TELEGRAM_BOT_TOKEN", value: telegramToken },
                { key: "TELEGRAM_CHAT_ID", value: telegramChatId },
                { key: "TELEGRAM_WEEKLY_DIGEST", value: weeklyDigestEnabled ? "true" : "false" },
            ];
            const res = await fetch(`${apiUrl}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                toast.success("Configuración guardada en MongoDB");
            } else {
                toast.error("Error al guardar la configuración");
            }
        } catch (e) {
            toast.error("Error de conexión");
        } finally {
            setIsSaving(false);
        }
    };

    const handleProviderChange = (provider: string, model: string) => {
        setDefaultProvider(provider);
        setDefaultModel(model);
    };

    const testTelegram = async () => {
        setTestingTelegram(true);
        try {
            await handleSave();
            const res = await fetch(`${apiUrl}/autopilot/test-telegram`, { method: "POST" });
            if (res.ok) toast.success("Mensaje de prueba enviado ✓");
            else toast.error("Error — revisa el token y el Chat ID");
        } catch {
            toast.error("Error de conexión");
        } finally {
            setTestingTelegram(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col gap-6 relative">
                <div className="absolute -left-10 -top-10 w-48 h-48 bg-primary/10 blur-[80px] pointer-events-none" />
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary">
                        <Settings size={18} className="sm:size-5" />
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">Configuración de Sistema</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white italic">
                        Ajustes de <span className="text-primary italic">Control</span>
                    </h1>
                    <p className="text-sm sm:text-base text-neutral-500 max-w-2xl font-medium">
                        Optimiza tus motores de IA, gestiona integraciones de datos y configura protocolos.
                    </p>
                </div>
            </header>

            <div className="space-y-2">
                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight italic">Núcleo de Inteligencia</h2>
                            <Badge variant="neutral" className="text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20">ALPHA-v2</Badge>
                        </div>
                    </div>

                    <Card variant="outline" className="relative overflow-hidden p-1 sm:p-1 border-white/5 bg-white/[0.01]">
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            {/* Gemini Provider */}
                            <div className={`p-5 sm:p-8 border-b md:border-r border-white/5 space-y-5 relative transition-all duration-500 ${defaultProvider === 'google' ? 'bg-blue-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -left-10 -top-10 w-32 h-32 bg-blue-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'google' ? 'shadow-blue-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('google', 'gemini-2.5-flash')}
                                        >
                                            <span className="font-black text-xl italic">G</span>
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('google', 'gemini-2.5-flash')}>
                                            <h3 className="font-black text-lg text-white">Google Gemini</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Motor Oficial</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('google', 'gemini-2.5-flash')}>
                                        {defaultProvider === "google" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400">
                                                <Lock size={14} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                                    Credenciales (no editable)
                                                </span>
                                                <p className="text-xs text-neutral-400 leading-relaxed">
                                                    Los tokens/API keys no se gestionan desde la UI. Se configuran en el
                                                    servidor (por ejemplo vía <span className="font-mono">apps/api/.env</span>{" "}
                                                    o variables de entorno del despliegue).
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Google Target Model</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'google' ? defaultModel : 'gemini-2.5-flash'}
                                            onChange={(e) => { handleProviderChange('google', e.target.value) }}
                                        >
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (recomendado - gratuito)</option>
                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (mas capaz - cuota baja)</option>
                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        Gemini 2.5 Flash es el más potente y rápido del tier gratuito (~1500 req/día).
                                    </p>
                                </div>
                            </div>

                            {/* Groq Provider */}
                            <div className={`p-5 sm:p-8 border-b border-white/5 space-y-5 relative transition-all duration-500 ${defaultProvider === 'groq' ? 'bg-emerald-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -left-10 -top-10 w-32 h-32 bg-emerald-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'groq' ? 'shadow-emerald-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('groq', 'llama-3.3-70b-versatile')}
                                        >
                                            <Zap size={20} />
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('groq', 'llama-3.3-70b-versatile')}>
                                            <h3 className="font-black text-lg text-white">Groq</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Ultrarrápido · Gratis</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('groq', 'llama-3.3-70b-versatile')}>
                                        {defaultProvider === "groq" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4 relative z-10">
                                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Cómo obtener tu API key gratis</p>
                                        <ol className="text-[11px] text-neutral-400 space-y-0.5 list-decimal list-inside">
                                            <li>Ve a <span className="text-emerald-400 font-mono">console.groq.com</span></li>
                                            <li>Sign up con Google/GitHub (sin tarjeta)</li>
                                            <li>API Keys → Create API Key</li>
                                        </ol>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Groq Target Model</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-emerald-500/40 transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'groq' ? defaultModel : 'llama-3.3-70b-versatile'}
                                            onChange={(e) => handleProviderChange('groq', e.target.value)}
                                        >
                                            <optgroup label="── Llama (Meta) ──">
                                                <option value="llama-3.3-70b-versatile">Llama 3.3 70B — mejor calidad ✓</option>
                                                <option value="llama-3.1-8b-instant">Llama 3.1 8B — rapidísimo</option>
                                                <option value="llama3-70b-8192">Llama 3 70B</option>
                                                <option value="llama3-8b-8192">Llama 3 8B</option>
                                            </optgroup>
                                            <optgroup label="── Mixtral ──">
                                                <option value="mixtral-8x7b-32768">Mixtral 8x7B — contexto largo</option>
                                            </optgroup>
                                            <optgroup label="── Google ──">
                                                <option value="gemma2-9b-it">Gemma 2 9B</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        ~30 req/min · ~14k req/día gratis. Hardware especializado, el más rápido del mercado.
                                    </p>
                                </div>
                            </div>

                            {/* Hugging Face Provider */}
                            <div className={`p-5 sm:p-8 md:border-r border-white/5 space-y-5 relative transition-all duration-500 ${defaultProvider === 'huggingface' ? 'bg-amber-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'huggingface' ? 'shadow-amber-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('huggingface', 'Qwen/Qwen2.5-7B-Instruct')}
                                        >
                                            <span className="font-black text-xl italic">H</span>
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('huggingface', 'Qwen/Qwen2.5-7B-Instruct')}>
                                            <h3 className="font-black text-lg text-white">Hugging Face</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Open Source Core</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('huggingface', 'Qwen/Qwen2.5-7B-Instruct')}>
                                        {defaultProvider === "huggingface" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400">
                                                <Lock size={14} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                                    Token HF (no editable)
                                                </span>
                                                <p className="text-xs text-neutral-400 leading-relaxed">
                                                    Si en el futuro se usa un endpoint de Hugging Face, el token se
                                                    configurará en el backend. Aquí solo seleccionas proveedor y modelo.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">HF Target Model</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'huggingface' ? defaultModel : 'Qwen/Qwen2.5-7B-Instruct'}
                                            onChange={(e) => { handleProviderChange('huggingface', e.target.value) }}
                                        >
                                            <optgroup label="── DeepSeek ──">
                                                <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-7B">DeepSeek R1 Distill 7B ✓</option>
                                                <option value="deepseek-ai/DeepSeek-R1-Distill-Llama-8B">DeepSeek R1 Distill 8B</option>
                                                <option value="deepseek-ai/DeepSeek-V3-0324">DeepSeek V3 — más potente</option>
                                            </optgroup>
                                            <optgroup label="── Qwen ──">
                                                <option value="Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B — más potente</option>
                                                <option value="Qwen/Qwen2.5-7B-Instruct">Qwen 2.5 7B — rápido</option>
                                            </optgroup>
                                            <optgroup label="── Meta Llama ──">
                                                <option value="meta-llama/Llama-3.3-70B-Instruct">Llama 3.3 70B</option>
                                                <option value="meta-llama/Llama-3.1-8B-Instruct">Llama 3.1 8B</option>
                                            </optgroup>
                                            <optgroup label="── Mistral ──">
                                                <option value="mistral-community/Mistral-7B-Instruct-v0.3">Mistral 7B v0.3</option>
                                                <option value="mistralai/Mixtral-8x7B-Instruct-v0.1">Mixtral 8x7B</option>
                                            </optgroup>
                                            <optgroup label="── Microsoft ──">
                                                <option value="microsoft/Phi-3.5-mini-instruct">Phi-3.5 Mini — muy rápido</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        Todos estos modelos usan la API chat/conversational de HF Inference. Necesitas un token HF guardado en Ajustes → API Keys.
                                    </p>
                                </div>
                            </div>

                            {/* OpenRouter Provider */}
                            <div className={`p-5 sm:p-8 space-y-5 relative transition-all duration-500 ${defaultProvider === 'openrouter' ? 'bg-violet-600/[0.03]' : 'hover:bg-white/[0.01] opacity-70 hover:opacity-100'}`}>
                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-violet-600/5 blur-[50px] pointer-events-none" />
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white shadow-lg ${defaultProvider === 'openrouter' ? 'shadow-violet-500/20' : 'shadow-none cursor-pointer'} transition-all`}
                                            onClick={() => handleProviderChange('openrouter', 'google/gemini-2.5-flash')}
                                        >
                                            <Globe size={20} />
                                        </div>
                                        <div className="cursor-pointer" onClick={() => handleProviderChange('openrouter', 'google/gemini-2.5-flash')}>
                                            <h3 className="font-black text-lg text-white">OpenRouter</h3>
                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">200+ modelos · 1 API</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 cursor-pointer" onClick={() => handleProviderChange('openrouter', 'google/gemini-2.5-flash')}>
                                        {defaultProvider === "openrouter" ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                                <span className="text-[8px] font-black text-emerald-500 uppercase">ACTIVE ALGORITHM</span>
                                            </div>
                                        ) : (
                                            <span className="text-[8px] font-black text-neutral-500 uppercase hover:text-white transition-colors border border-white/10 px-2 py-1 rounded">SET AS DEFAULT</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Modelo</label>
                                        <select
                                            className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-violet-500/40 transition-all appearance-none cursor-pointer"
                                            value={defaultProvider === 'openrouter' ? defaultModel : 'google/gemini-2.5-flash'}
                                            onChange={(e) => handleProviderChange('openrouter', e.target.value)}
                                        >
                                            <optgroup label="── Gratis ──">
                                                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash ✓</option>
                                                <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash Exp (free)</option>
                                                <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (free)</option>
                                                <option value="deepseek/deepseek-r1:free">DeepSeek R1 (free)</option>
                                                <option value="deepseek/deepseek-chat-v3-0324:free">DeepSeek V3 (free)</option>
                                                <option value="mistralai/mistral-nemo:free">Mistral Nemo (free)</option>
                                                <option value="microsoft/phi-4:free">Microsoft Phi-4 (free)</option>
                                            </optgroup>
                                            <optgroup label="── Premium ──">
                                                <option value="anthropic/claude-3.5-haiku">Claude 3.5 Haiku</option>
                                                <option value="anthropic/claude-sonnet-4-5">Claude Sonnet 4.5</option>
                                                <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                                                <option value="openai/gpt-4o">GPT-4o</option>
                                                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                <option value="mistralai/mistral-large">Mistral Large</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <p className="text-[11px] text-neutral-500 leading-relaxed">
                                        Acceso a más de 200 modelos con una sola API key. Los marcados (free) no consumen créditos.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/[0.02] border-t border-white/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-neutral-500 max-w-md">
                                <Zap size={16} className="text-primary shrink-0" />
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary/80 leading-relaxed">Se guarda el proveedor/modelo por defecto. Las credenciales se gestionan solo en backend.</p>
                            </div>
                            <Button onClick={handleSave} disabled={isSaving} variant="primary" className="w-full sm:w-fit font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar en MongoDB"}
                            </Button>
                        </div>
                    </Card>
                </section>

                {/* API Keys */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">API Keys</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-blue-500/10 text-blue-400 border-blue-500/20">IA</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 text-lg font-black">G</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Google Gemini API Key</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Tendencias · Generación de prompts · LLM</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">GOOGLE_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showGoogleKey ? "text" : "password"}
                                        value={googleApiKey}
                                        onChange={(e) => setGoogleApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-blue-500/40 transition-all"
                                        placeholder="AIzaSy..."
                                    />
                                    <button type="button" onClick={() => setShowGoogleKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showGoogleKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Gratis en <span className="text-blue-400">aistudio.google.com</span> · ~1500 peticiones/día sin coste</p>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Groq API Key */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Groq API Key</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <Zap size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Groq Cloud · LLM Ultrarrápido</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Listings · SEO · Contenido · Análisis</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">GROQ_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showGroqKey ? "text" : "password"}
                                        value={groqApiKey}
                                        onChange={(e) => setGroqApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-emerald-500/40 transition-all"
                                        placeholder="gsk_..."
                                    />
                                    <button type="button" onClick={() => setShowGroqKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showGroqKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Gratis en <span className="text-emerald-400">console.groq.com</span> · Sin tarjeta · ~14k req/día · Llama 3.3 70B incluido</p>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* OpenRouter API Key */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">OpenRouter API Key</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">200+ MODELOS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">OpenRouter · Gateway Unificado</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Gemini · Claude · GPT · DeepSeek · Llama · Mistral</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">OPENROUTER_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showOpenrouterKey ? "text" : "password"}
                                        value={openrouterApiKey}
                                        onChange={(e) => setOpenrouterApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-violet-500/40 transition-all"
                                        placeholder="sk-or-v1-..."
                                    />
                                    <button type="button" onClick={() => setShowOpenrouterKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showOpenrouterKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Regístrate en <span className="text-violet-400">openrouter.ai</span> → Keys → Create Key · Varios modelos gratuitos sin tarjeta</p>
                            </div>
                            <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.03] p-4 space-y-2 max-w-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80">Cómo obtener tu API Key</p>
                                <ol className="text-[10px] text-neutral-500 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Ve a <span className="text-violet-400 font-mono">openrouter.ai</span> y crea una cuenta</li>
                                    <li>En el panel lateral ve a <span className="text-neutral-300">Keys</span></li>
                                    <li>Pulsa <span className="text-neutral-300">Create Key</span>, dale un nombre</li>
                                    <li>Copia la key (empieza por <span className="font-mono text-violet-300">sk-or-v1-</span>)</li>
                                    <li>Los modelos marcados (free) son gratis sin necesidad de añadir créditos</li>
                                </ol>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* HuggingFace Inference Key */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">HuggingFace Inference Key</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 text-lg font-black italic">H</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">HF Inference API · DeepSeek / Mistral / Llama</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Generación de texto · Open Source</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">HUGGINGFACE_API_KEY (Inference Token)</label>
                                <div className="relative">
                                    <input
                                        type={showHfInferenceKey ? "text" : "password"}
                                        value={hfInferenceKey}
                                        onChange={(e) => setHfInferenceKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                        placeholder="hf_..."
                                    />
                                    <button type="button" onClick={() => setShowHfInferenceKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showHfInferenceKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Gratis en <span className="text-amber-400">huggingface.co/settings/tokens</span> · Crea un token de tipo "Read" o "Inference"</p>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Cloudinary Storage */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Cloudinary Storage</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-cyan-500/10 text-cyan-400 border-cyan-500/20">MEDIA</Badge>
                    </div>

                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                                    <Cloud size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Credenciales de Cloudinary</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Almacenamiento persistente de imágenes IA</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Cloud Name</label>
                                    <input
                                        type="text"
                                        value={cloudinaryCloudName}
                                        onChange={(e) => setCloudinaryCloudName(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-cyan-500/40 transition-all"
                                        placeholder="ej: mi-cloud-name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showCloudinaryKey ? "text" : "password"}
                                            value={cloudinaryApiKey}
                                            onChange={(e) => setCloudinaryApiKey(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-cyan-500/40 transition-all"
                                            placeholder="••••••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCloudinaryKey((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
                                        >
                                            {showCloudinaryKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">API Secret</label>
                                    <div className="relative">
                                        <input
                                            type={showCloudinarySecret ? "text" : "password"}
                                            value={cloudinaryApiSecret}
                                            onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-cyan-500/40 transition-all"
                                            placeholder="••••••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCloudinarySecret((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
                                        >
                                            {showCloudinarySecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[11px] text-neutral-600 leading-relaxed italic">
                                Las credenciales se guardan cifradas en MongoDB. Se usan exclusivamente para subir y eliminar imágenes del IA Asset Studio.
                            </p>
                        </div>
                    </Card>
                </section>

                {/* HuggingFace Hub */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">HuggingFace Hub</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">DATASETS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 text-lg font-black italic">H</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Hugging Face Hub Write Access</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">DataRefinery · Subida de datasets</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                                <p className="text-xs text-amber-300 font-medium">Cómo obtener el Write Token:</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside">
                                    <li>Ve a <span className="text-amber-400 font-mono">huggingface.co/settings/tokens</span></li>
                                    <li>Crea un token de tipo <span className="font-bold text-white">Write</span> (no el de inferencia)</li>
                                    <li>Copia el token <span className="font-mono text-amber-400">hf_...</span> y pégalo aquí</li>
                                    <li>El username es tu nombre de usuario en HuggingFace (no el email)</li>
                                </ol>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">HUGGINGFACE_WRITE_TOKEN</label>
                                    <div className="relative">
                                        <input
                                            type={showHfToken ? "text" : "password"}
                                            value={hfWriteToken}
                                            onChange={(e) => setHfWriteToken(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                            placeholder="hf_..."
                                        />
                                        <button type="button" onClick={() => setShowHfToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showHfToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">HUGGINGFACE_USERNAME</label>
                                    <input
                                        type="text"
                                        value={hfUsername}
                                        onChange={(e) => setHfUsername(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                        placeholder="tu-usuario-hf"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Gelato */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Gelato Print-on-Demand</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-orange-500/10 text-orange-400 border-orange-500/20">POD</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Gelato API</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Impresión bajo demanda · Wire-O · España</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">GELATO_API_KEY</label>
                                    <div className="relative">
                                        <input
                                            type={showGelatoKey ? "text" : "password"}
                                            value={gelatoApiKey}
                                            onChange={(e) => setGelatoApiKey(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                            placeholder="xxxxxxxx-xxxx-xxxx:xxxxxxxx-xxxx"
                                        />
                                        <button type="button" onClick={() => setShowGelatoKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showGelatoKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">GELATO_STORE_ID (auto-detectado)</label>
                                    <input
                                        type="text"
                                        value={gelatoStoreId}
                                        onChange={(e) => setGelatoStoreId(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    />
                                    <p className="text-[10px] text-neutral-600 italic">Se auto-rellena al hacer ping desde la app Etsy+Gelato</p>
                                </div>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Etsy */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Etsy Marketplace</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">MARKET</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                    <ShoppingBag size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Etsy API v3</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Listings · Ventas · OAuth PKCE</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <p className="text-xs text-amber-300 font-medium mb-1">Cómo obtener las credenciales:</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside">
                                    <li>Ve a <span className="text-amber-400 font-mono">etsy.com/developers</span> → Create App</li>
                                    <li>Copia la <span className="font-bold text-white">Keystring</span> (API Key) y el <span className="font-bold text-white">Shared Secret</span></li>
                                    <li>En Callback URL pon: <span className="font-mono text-amber-400">http://localhost:3000/etsy/callback</span></li>
                                    <li>Guarda aquí y luego conecta desde la app Etsy+Gelato</li>
                                </ol>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">ETSY_API_KEY (Keystring)</label>
                                    <input
                                        type="text"
                                        value={etsyApiKey}
                                        onChange={(e) => setEtsyApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">ETSY_API_SECRET (Shared Secret)</label>
                                    <div className="relative">
                                        <input
                                            type={showEtsySecret ? "text" : "password"}
                                            value={etsyApiSecret}
                                            onChange={(e) => setEtsyApiSecret(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                            placeholder="••••••••••••••••••••••••"
                                        />
                                        <button type="button" onClick={() => setShowEtsySecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showEtsySecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">ETSY_SHOP_ID (auto-detectado al conectar)</label>
                                    <input
                                        type="text"
                                        value={etsyShopId}
                                        onChange={(e) => setEtsyShopId(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                        placeholder="66013248"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">ETSY_REDIRECT_URI</label>
                                    <input
                                        type="text"
                                        value={etsyRedirectUri}
                                        onChange={(e) => setEtsyRedirectUri(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-500/40 transition-all"
                                        placeholder="http://localhost:3000/etsy/callback"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Servidor / Túnel */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Servidor & Túnel</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-sky-500/10 text-sky-400 border-sky-500/20">INFRA</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">URL Pública del Servidor</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">ngrok · Producción · Gelato automático</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
                                <p className="text-xs text-sky-300 font-medium">¿Para qué sirve?</p>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    Gelato necesita descargar el PDF desde una URL pública para crear pedidos automáticamente.
                                    En local usa <span className="font-mono text-sky-400">ngrok</span>; en producción pon la URL de tu servidor.
                                </p>
                                <div className="rounded-xl bg-black/40 border border-white/8 px-3 py-2 mt-1">
                                    <p className="text-[10px] font-mono text-neutral-500">
                                        <span className="text-neutral-300">npm run ngrok</span>
                                        <span className="text-neutral-600 ml-3"># arranca el túnel y actualiza este campo automáticamente</span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">PUBLIC_API_URL</label>
                                <input
                                    type="text"
                                    value={publicApiUrl}
                                    onChange={(e) => setPublicApiUrl(e.target.value)}
                                    className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-sky-500/40 transition-all"
                                    placeholder="https://xxxx-xxxx-xxxx.ngrok-free.app"
                                />
                                <p className="text-[10px] text-neutral-600 italic">
                                    Se actualiza automáticamente con <span className="font-mono text-neutral-500">npm run ngrok</span>.
                                    En producción escribe aquí la URL base de tu API.
                                </p>
                            </div>

                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Telegram Notifications */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Notificaciones</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-sky-500/10 text-sky-400 border-sky-500/20">TELEGRAM</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                                    <MessageCircle size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Telegram Bot</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Avisos de pipeline · errores de API · resumen de scraping</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 space-y-3">
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Cómo configurarlo</p>
                                <div className="space-y-2">
                                    {[
                                        { step: "1", title: "Crea el bot", desc: "Abre Telegram, busca @BotFather y escribe /newbot. Te dará el token." },
                                        { step: "2", title: "Obtén tu Chat ID", desc: "Envía un mensaje al bot. Luego abre api.telegram.org/bot<TOKEN>/getUpdates y busca «chat»→«id»." },
                                        { step: "3", title: "Pega y prueba", desc: "Guarda el token y el chat ID. Pulsa «Probar envío» para verificar." },
                                    ].map(s => (
                                        <div key={s.step} className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
                                            <div>
                                                <p className="text-xs font-black text-white">{s.title}</p>
                                                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{s.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TELEGRAM_BOT_TOKEN</label>
                                    <div className="relative">
                                        <input
                                            type={showTelegramToken ? "text" : "password"}
                                            value={telegramToken}
                                            onChange={e => setTelegramToken(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-sky-500/40 transition-all"
                                            placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
                                        />
                                        <button type="button" onClick={() => setShowTelegramToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showTelegramToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TELEGRAM_CHAT_ID</label>
                                    <input
                                        type="text"
                                        value={telegramChatId}
                                        onChange={e => setTelegramChatId(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-sky-500/40 transition-all"
                                        placeholder="-1001234567890"
                                    />
                                </div>
                            </div>

                            {/* Weekly digest toggle */}
                            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/8 bg-white/[0.02]">
                                <div>
                                    <p className="text-xs font-black text-white">Resumen semanal</p>
                                    <p className="text-[10px] text-neutral-500 mt-0.5">Cada lunes a las 9:00 · pipeline, royalties y catálogos atascados</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const next = !weeklyDigestEnabled;
                                        setWeeklyDigestEnabled(next);
                                        await fetch(`${apiUrl}/settings`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify([{ key: "TELEGRAM_WEEKLY_DIGEST", value: next ? "true" : "false" }]),
                                        });
                                        toast.success(next ? "Resumen semanal activado" : "Resumen semanal desactivado");
                                    }}
                                    className={`relative w-11 h-6 rounded-full transition-all duration-200 ${weeklyDigestEnabled ? "bg-sky-500" : "bg-white/10"}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${weeklyDigestEnabled ? "left-[22px]" : "left-0.5"}`} />
                                </button>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="w-full sm:w-fit font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                                <button
                                    onClick={() => void testTelegram()}
                                    disabled={testingTelegram || !telegramToken || !telegramChatId}
                                    className="w-full sm:w-fit h-10 px-6 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                                >
                                    {testingTelegram ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                    Probar envío
                                </button>
                                <a href="https://core.telegram.org/bots#how-do-i-create-a-bot" target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] font-black text-sky-500/60 hover:text-sky-400 transition-colors ml-auto">
                                    Documentación oficial →
                                </a>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* System Infrastructure Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-primary/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                                    <Lock size={20} />
                                </div>
                                <Badge variant="neutral" className="text-[7px] font-black uppercase">SEG-v4</Badge>
                            </div>
                            <div>
                                <h3 className="font-black text-white italic">Protocolos de Seguridad</h3>
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Administra redes de confidencialidad y esquemas Zero-Trust.</p>
                            </div>
                        </div>
                    </Card>

                    <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-emerald-500/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <BellRing size={20} />
                                </div>
                                <Badge variant="neutral" className="text-[7px] font-black uppercase">RT-v2</Badge>
                            </div>
                            <div>
                                <h3 className="font-black text-white italic">Notificaciones Activas</h3>
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Alertas del sistema, métricas caídas y reportes de rentabilidad.</p>
                            </div>
                        </div>
                    </Card>

                    <Card variant="outline" className="relative group overflow-hidden p-6 border-white/5 bg-white/[0.02] hover:border-white/20 transition-all duration-500">
                        <div className="absolute -right-6 -top-6 w-20 h-20 bg-amber-500/5 opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-500" />
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    <Database size={20} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {dbStatus === "connected" ? (
                                        <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[8px] font-black text-emerald-500 uppercase">ONLINE</span>
                                        </>
                                    ) : dbStatus === "connecting" ? (
                                        <>
                                            <Loader2 className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                            <span className="text-[8px] font-black text-amber-500 uppercase">CONNECTING</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                            <span className="text-[8px] font-black text-red-500 uppercase">OFFLINE</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black text-white italic">MongoDB Core</h3>
                                <p className="text-xs text-neutral-500 mt-2 leading-relaxed">Conexión en streaming por WebSockets habilitada.</p>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between pt-10 gap-4 border-t border-white/5 overflow-hidden">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Version del Sistema</span>
                            <span className="text-[10px] font-mono text-neutral-400 font-bold tracking-widest">v2.4.0-STABLE</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Entorno</span>
                            <Badge variant="neutral" className="text-[8px] font-black px-2 py-0">PRODUCCIÓN</Badge>
                        </div>
                    </div>
                    <div className="text-[9px] font-black text-neutral-600 uppercase tracking-tighter italic">
                        Gestor de Tareas © 2026 • High Alpha Dashboard Experience
                    </div>
                </div>
            </div>
        </div>
    );
}
