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
    Tag,
    Send,
    MessageCircle,
    Terminal,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ArrowDown,
    Trash2,
    Volume2,
    VolumeX,
    Play,
    RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createApiSocket } from "@/lib/socket";
import { toast } from "sonner";
import { refreshToken, getTokenExpiry } from "@/lib/auth-client";
import { KdpTabBar } from "@/components/ui/kdp-tab-bar";
import { speakBrowser } from "@/hooks/useSpeech";
import { Toggle } from "@/components/ui/toggle";
import { LlmTelemetryPanel } from "@/components/settings/LlmTelemetryPanel";

interface LogEntry { t: number; level: "info" | "warn" | "error"; msg: string; }

export default function AjustesPage() {
    const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "disconnected" | "connecting" | "disconnecting">("connecting");
    const [isSaving, setIsSaving] = useState(false);
    const [settingsTab, setSettingsTab] = useState("llm");

    // Monitor del sistema
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logFilter, setLogFilter] = useState<"all" | "warn" | "error">("all");
    const [logSearch, setLogSearch] = useState("");
    const [pollinationsBlocked, setPollinationsBlocked] = useState(false);
    const [sessionRefreshing, setSessionRefreshing] = useState(false);
    const [purgingMetrics, setPurgingMetrics] = useState(false);
    const [purgingExtracted, setPurgingExtracted] = useState(false);

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
    const [siliconflowApiKey, setSiliconflowApiKey] = useState("");
    const [showSiliconflowKey, setShowSiliconflowKey] = useState(false);
    const [segmindApiKey, setSegmindApiKey] = useState("");
    const [showSegmindKey, setShowSegmindKey] = useState(false);

    const [pollinationsToken, setPollinationsToken] = useState("");
    const [showPollinationsToken, setShowPollinationsToken] = useState(false);

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
    const [showTelegramToken, setShowTelegramToken] = useState(false);
    const [testingTelegram, setTestingTelegram] = useState(false);

    // Image quality filter
    const [qualityFilterEnabled, setQualityFilterEnabled] = useState(false);
    const [qualityMinWhite, setQualityMinWhite] = useState("45");

    // Radar dedup threshold
    const [dedupThreshold, setDedupThreshold] = useState("60");

    // 2FA
    const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
    const [totpSetupData, setTotpSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
    const [totpCode, setTotpCode] = useState("");
    const [totpLoading, setTotpLoading] = useState(false);
    const [totpStep, setTotpStep] = useState<"idle" | "setup" | "disable">("idle");

    // Voice TTS
    const [voiceEnabled, setVoiceEnabled] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem("voice_enabled") !== "false";
    });
    const [voiceTesting, setVoiceTesting] = useState(false);

    // fal.ai
    const [falAiKey, setFalAiKey] = useState("");
    const [showFalAiKey, setShowFalAiKey] = useState(false);

    // Cloudflare Workers AI
    const [cfAccountId, setCfAccountId] = useState("");
    const [cfApiToken, setCfApiToken] = useState("");
    const [showCfToken, setShowCfToken] = useState(false);
    const [cfUsage, setCfUsage] = useState<{ date: string; images: number; neurons: number; remaining: number; limit: number } | null>(null);

    // Leonardo AI
    const [leonardoApiKey, setLeonardoApiKey] = useState("");
    const [showLeonardoKey, setShowLeonardoKey] = useState(false);
    const [leoBalance, setLeoBalance] = useState<{ tokens: number; renewal: string } | null>(null);
    const [checkingLeoBalance, setCheckingLeoBalance] = useState(false);

    // Tensor.art — Bearer token (simple) + TAMS RSA (advanced)
    const [tensorartApiKey, setTensorartApiKey] = useState("");
    const [tensorartAppId, setTensorartAppId] = useState("");
    const [tensorartPrivateKey, setTensorartPrivateKey] = useState("");

    // Together AI
    const [togetherApiKey, setTogetherApiKey] = useState("");
    const [showTogetherKey, setShowTogetherKey] = useState(false);

    // Stable Horde
    const [stableHordeApiKey, setStableHordeApiKey] = useState("");
    const [showStableHordeKey, setShowStableHordeKey] = useState(false);

    // Lulu Direct
    const [luluClientKey, setLuluClientKey] = useState("");
    const [luluClientSecret, setLuluClientSecret] = useState("");
    const [showLuluSecret, setShowLuluSecret] = useState(false);
    const [luluStatus, setLuluStatus] = useState<"ok" | "error" | null>(null);

    // Gumroad
    const [gumroadEnabled, setGumroadEnabled] = useState(false);
    const [gumroadToken, setGumroadToken] = useState("");
    const [showGumroadToken, setShowGumroadToken] = useState(false);
    const [gumroadPrice, setGumroadPrice] = useState("4.99");

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
                if (map.has("SILICONFLOW_API_KEY")) setSiliconflowApiKey(map.get("SILICONFLOW_API_KEY")!);
                if (map.has("SEGMIND_API_KEY")) setSegmindApiKey(map.get("SEGMIND_API_KEY")!);
                if (map.has("POLLINATIONS_TOKEN")) setPollinationsToken(map.get("POLLINATIONS_TOKEN"));
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
                if (map.has("IMAGE_QUALITY_FILTER_ENABLED")) setQualityFilterEnabled(map.get("IMAGE_QUALITY_FILTER_ENABLED") === "1");
                if (map.has("IMAGE_QUALITY_MIN_WHITE_RATIO")) setQualityMinWhite(String(Math.round(parseFloat(map.get("IMAGE_QUALITY_MIN_WHITE_RATIO")) * 100)));
                if (map.has("RADAR_DEDUP_THRESHOLD")) setDedupThreshold(String(Math.round(parseFloat(map.get("RADAR_DEDUP_THRESHOLD")) * 100)));
                if (map.has("GUMROAD_ENABLED")) setGumroadEnabled(map.get("GUMROAD_ENABLED") === "1");
                if (map.has("GUMROAD_ACCESS_TOKEN")) setGumroadToken(map.get("GUMROAD_ACCESS_TOKEN"));
                if (map.has("GUMROAD_DEFAULT_PRICE")) setGumroadPrice(map.get("GUMROAD_DEFAULT_PRICE"));
                if (map.has("FALAI_API_KEY")) setFalAiKey(map.get("FALAI_API_KEY"));
                if (map.has("CF_ACCOUNT_ID")) setCfAccountId(map.get("CF_ACCOUNT_ID"));
                if (map.has("CF_API_TOKEN")) setCfApiToken(map.get("CF_API_TOKEN"));
                // Cargar uso de neurons
                try {
                    const usageRes = await fetch(`${apiUrl}/system/cf-usage`);
                    if (usageRes.ok) setCfUsage(await usageRes.json());
                } catch { /* silencioso */ }
                if (map.has("LEONARDO_API_KEY")) setLeonardoApiKey(map.get("LEONARDO_API_KEY"));
                if (map.has("TENSORART_API_KEY")) setTensorartApiKey(map.get("TENSORART_API_KEY")!);
                if (map.has("TENSORART_APP_ID")) setTensorartAppId(map.get("TENSORART_APP_ID")!);
                if (map.has("TENSORART_PRIVATE_KEY")) setTensorartPrivateKey(map.get("TENSORART_PRIVATE_KEY")!);
                if (map.has("TOGETHER_API_KEY")) setTogetherApiKey(map.get("TOGETHER_API_KEY"));
                if (map.has("STABLE_HORDE_API_KEY")) setStableHordeApiKey(map.get("STABLE_HORDE_API_KEY"));
                if (map.has("LULU_CLIENT_KEY")) setLuluClientKey(map.get("LULU_CLIENT_KEY"));
                if (map.has("LULU_CLIENT_SECRET")) setLuluClientSecret(map.get("LULU_CLIENT_SECRET"));

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
        socket.on("logs:line", (entry: LogEntry) => {
            setLogs(prev => {
                const next = [...prev, entry];
                return next.length > 400 ? next.slice(-400) : next;
            });
        });
        socket.on("disconnect", () => setDbStatus("unknown"));
        socket.on("connect_error", () => setDbStatus("unknown"));
        return () => { socket.disconnect() };
    }, [apiUrl]);

    // Carga historial de logs y estado del sistema al montar
    useEffect(() => {
        const load = async () => {
            try {
                const [logsRes, statusRes, meRes] = await Promise.all([
                    fetch(`${apiUrl}/system/logs`),
                    fetch(`${apiUrl}/system/status`),
                    fetch(`${apiUrl}/auth/me`),
                ]);
                if (logsRes.ok) {
                    const data = await logsRes.json() as { logs: LogEntry[] };
                    setLogs(data.logs ?? []);
                }
                if (statusRes.ok) {
                    const data = await statusRes.json() as { pollinations: { blocked: boolean } };
                    setPollinationsBlocked(data.pollinations?.blocked ?? false);
                }
                if (meRes.ok) {
                    const data = await meRes.json() as { twoFactorEnabled: boolean };
                    setTotpEnabled(data.twoFactorEnabled ?? false);
                }
            } catch { /* silencioso */ }
        };
        load();
    }, [apiUrl]);

    const handleSetup2FA = async () => {
        setTotpLoading(true);
        try {
            const res = await fetch(`${apiUrl}/auth/setup-2fa`, { method: "POST" });
            if (!res.ok) throw new Error((await res.json()).error || "Error");
            const data = await res.json();
            setTotpSetupData({ secret: data.secret, qrCodeUrl: data.qrCodeUrl });
            setTotpStep("setup");
            setTotpCode("");
        } catch (e: any) {
            toast.error(e.message || "Error al iniciar configuración 2FA");
        } finally {
            setTotpLoading(false);
        }
    };

    const handleVerifySetup2FA = async () => {
        if (totpCode.replace(/\s/g, "").length < 6) return;
        setTotpLoading(true);
        try {
            const res = await fetch(`${apiUrl}/auth/confirm-2fa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: totpCode }),
            });
            if (!res.ok) {
                toast.error("Código incorrecto. Inténtalo de nuevo.");
            } else {
                setTotpEnabled(true);
                setTotpStep("idle");
                setTotpSetupData(null);
                setTotpCode("");
                toast.success("2FA activado correctamente");
            }
        } catch {
            toast.error("Error al verificar código");
        } finally {
            setTotpLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        if (totpCode.replace(/\s/g, "").length < 6) return;
        setTotpLoading(true);
        try {
            const res = await fetch(`${apiUrl}/auth/disable-2fa`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: totpCode }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                toast.error(body.error || "Código incorrecto");
            } else {
                setTotpEnabled(false);
                setTotpStep("idle");
                setTotpCode("");
                toast.success("2FA desactivado");
            }
        } catch {
            toast.error("Error al desactivar 2FA");
        } finally {
            setTotpLoading(false);
        }
    };

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
                { key: "SILICONFLOW_API_KEY", value: siliconflowApiKey },
                { key: "SEGMIND_API_KEY", value: segmindApiKey },
                { key: "POLLINATIONS_TOKEN", value: pollinationsToken },
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
                { key: "IMAGE_QUALITY_FILTER_ENABLED", value: qualityFilterEnabled ? "1" : "0" },
                { key: "IMAGE_QUALITY_MIN_WHITE_RATIO", value: String(parseFloat(qualityMinWhite) / 100 || 0.45) },
                { key: "RADAR_DEDUP_THRESHOLD", value: String(parseFloat(dedupThreshold) / 100 || 0.6) },
                { key: "GUMROAD_ENABLED", value: gumroadEnabled ? "1" : "0" },
                { key: "GUMROAD_ACCESS_TOKEN", value: gumroadToken },
                { key: "GUMROAD_DEFAULT_PRICE", value: gumroadPrice },
                { key: "FALAI_API_KEY", value: falAiKey },
                { key: "CF_ACCOUNT_ID", value: cfAccountId },
                { key: "CF_API_TOKEN", value: cfApiToken },
                { key: "LEONARDO_API_KEY", value: leonardoApiKey },
                { key: "TENSORART_API_KEY", value: tensorartApiKey },
                { key: "TENSORART_APP_ID", value: tensorartAppId },
                { key: "TENSORART_PRIVATE_KEY", value: tensorartPrivateKey },
                { key: "TOGETHER_API_KEY", value: togetherApiKey },
                { key: "STABLE_HORDE_API_KEY", value: stableHordeApiKey },
                { key: "LULU_CLIENT_KEY", value: luluClientKey },
                { key: "LULU_CLIENT_SECRET", value: luluClientSecret },
            ];
            // Never send empty-string values — protects API keys from being wiped
            // when the page loaded while the API was temporarily down
            const nonEmptyUpdates = updates.filter(u => u.value !== "");
            const res = await fetch(`${apiUrl}/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nonEmptyUpdates)
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

    const checkLeonardoBalance = async () => {
        setCheckingLeoBalance(true);
        try {
            const res = await fetch(`${apiUrl}/ai/leonardo-balance`);
            if (!res.ok) { toast.error("No se pudo obtener el saldo (revisa la API key)"); return; }
            const data = await res.json();
            setLeoBalance(data);
        } catch { toast.error("Error de conexión"); }
        finally { setCheckingLeoBalance(false); }
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

    const toggleVoice = (val: boolean) => {
        setVoiceEnabled(val);
        localStorage.setItem("voice_enabled", val ? "true" : "false");
    };

    const testVoice = async () => {
        setVoiceTesting(true);
        const testText = "Hola, la voz está funcionando correctamente.";
        try {
            // Try server TTS first
            let serverOk = false;
            try {
                const res = await fetch(`${apiUrl}/voice/tts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: testText }),
                    signal: AbortSignal.timeout(5000),
                });
                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.onended = () => URL.revokeObjectURL(url);
                    await audio.play();
                    serverOk = true;
                }
            } catch { /* fall through */ }
            // Fallback: browser's Web Speech API (works offline, no API needed)
            if (!serverOk) {
                if (typeof window !== "undefined" && window.speechSynthesis) {
                    speakBrowser(testText);
                } else {
                    toast.error("TTS no disponible en este navegador");
                }
            }
        } finally {
            setVoiceTesting(false);
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

            <div className="space-y-4">
                <KdpTabBar
                    tabs={[
                        { id: "llm",            label: "LLM",            icon: <BrainCircuit size={14} />, activeBg: "bg-blue-500/10 border-blue-500/25 text-blue-300" },
                        { id: "imagenes",       label: "Imágenes",       icon: <Sparkles size={14} />,    activeBg: "bg-violet-500/10 border-violet-500/25 text-violet-300" },
                        { id: "integraciones",  label: "Integraciones",  icon: <Package size={14} />,     activeBg: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" },
                        { id: "sistema",        label: "Sistema",        icon: <Terminal size={14} />,    activeBg: "bg-neutral-500/10 border-neutral-500/25 text-neutral-300" },
                    ]}
                    active={settingsTab}
                    onChange={setSettingsTab}
                />
                {settingsTab === "llm" && <div className="space-y-2">
                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white tracking-tight italic">Núcleo de Inteligencia</h2>
                            <Badge variant="neutral" className="text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/20">ALPHA-v2</Badge>
                        </div>
                    </div>

                    {/* Salud real de los proveedores: % de éxito y latencia (7 días) */}
                    <LlmTelemetryPanel apiUrl={apiUrl} />

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
                </div>}

                {settingsTab === "imagenes" && <div className="space-y-2">
                {/* Leonardo AI */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Leonardo AI</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">150 TOKENS/DÍA</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 text-xl font-black">L</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Leonardo AI · Phoenix / Lucid</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">150 tokens/día · Phoenix 1.0 · Lucid Origin · Lucid Realism · Sin tarjeta</p>
                                </div>
                            </div>

                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">LEONARDO_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showLeonardoKey ? "text" : "password"}
                                        value={leonardoApiKey}
                                        onChange={(e) => setLeonardoApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-violet-500/40 transition-all"
                                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    />
                                    <button type="button" onClick={() => setShowLeonardoKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showLeonardoKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Regístrate gratis en <span className="text-violet-400">leonardo.ai</span> · Perfil → API Access → Create new API key</p>
                            </div>

                            {leonardoApiKey && (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <button
                                        onClick={() => void checkLeonardoBalance()}
                                        disabled={checkingLeoBalance}
                                        className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-black text-violet-400 hover:bg-violet-500/20 transition-all disabled:opacity-40"
                                    >
                                        {checkingLeoBalance ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Ver saldo
                                    </button>
                                    {leoBalance && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/15">
                                            <span className="text-sm font-black text-white">{leoBalance.tokens}</span>
                                            <span className="text-xs text-neutral-500">tokens disponibles</span>
                                            {leoBalance.renewal && <span className="text-[10px] text-neutral-600">· renueva {leoBalance.renewal}</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Tensor.art */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Tensor.art</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-orange-500/10 text-orange-400 border-orange-500/20">100 CRÉD/DÍA GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 text-xl font-black">T</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Tensor.art · SDXL + Coloring LoRAs</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">TAMS API · Firma RSA · 100 créditos/día · Sin tarjeta</p>
                                </div>
                            </div>

                            {/* === Aviso importante === */}
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1.5">
                                <p className="text-xs font-black text-red-400 uppercase tracking-widest">⚠ Requiere App en TAMS — no vale la key del perfil de tensor.art</p>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">Las keys <span className="font-mono text-white">ak_...</span> del perfil de Tensor.art <span className="text-red-300 font-bold">no funcionan</span>. Necesitas crear una App en <span className="font-mono text-orange-300">tams.tensor.art/apps</span> y usar el token o las RSA keys de esa App.</p>
                            </div>

                            {/* === Opción 1: Access Token de la App TAMS === */}
                            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
                                <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Opción simple · Access Token de la App</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Ve a <span className="font-mono text-orange-300">tams.tensor.art/apps</span> → crea o abre tu App</li>
                                    <li>Busca la sección <span className="text-white font-bold">Access Token</span> (o API Token) dentro de la App</li>
                                    <li>Copia ese token y pégalo aquí</li>
                                </ol>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TENSORART_API_KEY <span className="text-neutral-700 normal-case">(token de la App TAMS, no del perfil)</span></label>
                                    <input
                                        type="password"
                                        value={tensorartApiKey}
                                        onChange={(e) => setTensorartApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                        placeholder="access token de tu App en tams.tensor.art"
                                    />
                                </div>
                            </div>

                            {/* === Opción 2: TAMS RSA (avanzado) === */}
                            <details className="group">
                                <summary className="cursor-pointer text-[10px] font-black text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors select-none">
                                    ▸ Opción avanzada · RSA (App ID + clave privada)
                                </summary>
                                <div className="mt-4 space-y-4 pl-2 border-l border-white/5">
                                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1.5">
                                        <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Setup</p>
                                        <ol className="text-[11px] text-neutral-500 space-y-1 list-decimal list-inside leading-relaxed">
                                            <li>Ve a <span className="font-mono text-orange-400">tams.tensor.art/apps</span> → crea una App, copia el <span className="text-white">App ID</span></li>
                                            <li>En terminal: <span className="font-mono text-orange-300">openssl genrsa -out private_key.pem 2048</span></li>
                                            <li>Luego: <span className="font-mono text-orange-300">openssl rsa -pubout -in private_key.pem -out public_key.pem</span></li>
                                            <li>Sube <span className="font-mono text-white">public_key.pem</span> a tu App en TAMS → guarda App ID y private key aquí</li>
                                        </ol>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TENSORART_APP_ID</label>
                                        <input
                                            type="text"
                                            value={tensorartAppId}
                                            onChange={(e) => setTensorartAppId(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                            placeholder="20003093682940"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TENSORART_PRIVATE_KEY</label>
                                        <textarea
                                            value={tensorartPrivateKey}
                                            onChange={(e) => setTensorartPrivateKey(e.target.value)}
                                            rows={5}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-white outline-none focus:border-orange-500/40 transition-all resize-none"
                                            placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"}
                                        />
                                    </div>
                                </div>
                            </details>
                        </div>
                        <div className="bg-white/[0.02] border-t border-white/5 p-4 flex justify-end">
                            <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                            </Button>
                        </div>
                    </Card>
                </section>

                {/* SiliconFlow */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">SiliconFlow</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-sky-500/10 text-sky-400 border-sky-500/20">FLUX GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 text-xl font-black">SF</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">SiliconFlow · FLUX.1-schnell gratis</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">API OpenAI-compatible · FLUX.1-schnell sin coste · Sin tarjeta</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">SILICONFLOW_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showSiliconflowKey ? "text" : "password"}
                                        value={siliconflowApiKey}
                                        onChange={(e) => setSiliconflowApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-sky-500/40 transition-all"
                                        placeholder="sk-..."
                                    />
                                    <button type="button" onClick={() => setShowSiliconflowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showSiliconflowKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Regístrate gratis en <span className="text-sky-400">siliconflow.com</span> · Sin tarjeta · FLUX.1-schnell gratuito</p>
                            </div>
                            <div className="flex justify-end border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Segmind */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Segmind</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-green-500/10 text-green-400 border-green-500/20">100/DÍA GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-500/20 text-lg font-black">S</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Segmind · FLUX Schnell</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">100 imágenes gratis/día · Sin tarjeta · ~5-10s</p>
                                </div>
                            </div>
                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">SEGMIND_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showSegmindKey ? "text" : "password"}
                                        value={segmindApiKey}
                                        onChange={(e) => setSegmindApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-green-500/40 transition-all"
                                        placeholder="SG_..."
                                    />
                                    <button type="button" onClick={() => setShowSegmindKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showSegmindKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">Regístrate gratis en <span className="text-green-400">segmind.com</span> · Sin tarjeta · 100 imágenes/día</p>
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

                {/* Pollinations Image Engine */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Pollinations Image Engine</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20">IMÁGENES</Badge>
                        <div className="ml-auto flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-bold ${pollinationsBlocked ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${pollinationsBlocked ? "bg-red-400" : "bg-emerald-400 animate-pulse"}`} />
                                {pollinationsBlocked ? "IP BLOQUEADA" : "OPERATIVO"}
                            </div>
                            {pollinationsBlocked && (
                                <button
                                    onClick={async () => {
                                        try {
                                            const res = await fetch(`${apiUrl}/system/reset-pollinations`, { method: "POST" });
                                            if (res.ok) { setPollinationsBlocked(false); toast.success("Circuit breaker reseteado — Pollinations activo"); }
                                        } catch { toast.error("Error reseteando"); }
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 text-[9px] font-black hover:bg-fuchsia-500/20 transition-all uppercase tracking-widest"
                                >
                                    <RefreshCw size={9} /> Resetear
                                </button>
                            )}
                        </div>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/20 text-xl">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Pollinations · FLUX generativo</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Catálogos · Portadas · Descubrimiento · Fallback de HF</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 space-y-3">
                                <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Cómo funciona</p>
                                <div className="space-y-2">
                                    {[
                                        { icon: "1", title: "Generación gratuita", desc: "image.pollinations.ai es gratis. El token no consume el saldo por imagen — desbloquea la IP y elimina rate limits." },
                                        { icon: "2", title: "El saldo ($5)", desc: "El crédito no se recarga automáticamente. Solo se usaría si activamos features premium explícitas. Con uso normal de FLUX no se consume." },
                                        { icon: "3", title: "Fallback automático", desc: "Si Pollinations falla → HuggingFace FLUX.1-schnell. Circuit breaker activo: si la IP se bloquea, salta a HF y lo reintenta cada hora." },
                                    ].map(s => (
                                        <div key={s.icon} className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{s.icon}</span>
                                            <div>
                                                <p className="text-xs font-black text-white">{s.title}</p>
                                                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{s.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2 max-w-xl">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">POLLINATIONS_TOKEN (Secret Key)</label>
                                    <div className="relative">
                                        <input
                                            type={showPollinationsToken ? "text" : "password"}
                                            value={pollinationsToken}
                                            onChange={(e) => setPollinationsToken(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-fuchsia-500/40 transition-all"
                                            placeholder="sk_..."
                                        />
                                        <button type="button" onClick={() => setShowPollinationsToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showPollinationsToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-600 italic">
                                        Con <span className="text-fuchsia-400">sk_</span> → sin bloqueo de IP, sin rate limit.
                                        Obtener en <span className="text-fuchsia-400">auth.pollinations.ai</span>
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Modelos gratuitos disponibles</p>
                                    <div className="flex flex-wrap gap-2">
                                        {["flux", "flux-realism", "flux-anime", "flux-3d", "turbo", "flux-pro", "stable-diffusion-3-5-large"].map(m => (
                                            <span key={m} className="px-2 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/15 text-[9px] font-mono text-fuchsia-300">{m}</span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-neutral-600 italic mt-1">Todos gratuitos via <span className="font-mono">image.pollinations.ai</span>. Actualmente usamos <span className="text-white font-mono">flux</span> por defecto.</p>
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

                {/* fal.ai Image Engine */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">fal.ai Image Engine</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">IMÁGENES</Badge>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 text-lg font-black italic">F</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">fal.ai · FLUX.1-schnell</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Fallback de Pollinations · Sin bloqueo geo · Sin CGNAT</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-4 space-y-2">
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Cadena de fallback actual</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {["Pollinations", "fal.ai", "Google Gemini", "HuggingFace"].map((p, i, arr) => (
                                        <div key={p} className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/15 text-[9px] font-mono text-violet-300">{p}</span>
                                            {i < arr.length - 1 && <span className="text-neutral-600 text-xs">→</span>}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-neutral-500 mt-1">Si Pollinations falla (CGNAT, rate limit), fal.ai es el primer fallback. Tier gratuito: ~500 imágenes/mes.</p>
                            </div>

                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">FALAI_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showFalAiKey ? "text" : "password"}
                                        value={falAiKey}
                                        onChange={(e) => setFalAiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-violet-500/40 transition-all"
                                        placeholder="fal_key_..."
                                    />
                                    <button type="button" onClick={() => setShowFalAiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showFalAiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">
                                    Crear key en <span className="text-violet-400">fal.ai/dashboard/keys</span> · Tier gratuito disponible sin tarjeta
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

                {/* Cloudflare Workers AI */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Cloudflare Workers AI</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-orange-500/10 text-orange-400 border-orange-500/20">IMÁGENES</Badge>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">~30/DÍA GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 text-xl font-black">⚡</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Cloudflare · FLUX.1-schnell</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Sin bloqueo geo · ~5s/imagen · 10k neurons/día gratis</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-2">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Cómo configurarlo (2 min)</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Ve a <span className="text-orange-400 font-mono">dash.cloudflare.com</span> → cuenta gratuita</li>
                                    <li>Copia tu <span className="text-neutral-300">Account ID</span> del panel principal (barra lateral derecha)</li>
                                    <li>Ve a <span className="text-neutral-300">My Profile → API Tokens → Create Token</span></li>
                                    <li>Usa la plantilla <span className="text-orange-300">Workers AI</span> o permisos: <span className="font-mono text-orange-300">Workers AI:Read</span></li>
                                    <li>Pega ambos aquí y pulsa Guardar</li>
                                </ol>
                            </div>

                            {/* Contador de neurons */}
                            {cfUsage && (
                                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Uso hoy — {cfUsage.date}</p>
                                        <span className="text-[10px] font-black text-neutral-400">{cfUsage.neurons.toLocaleString()} / {cfUsage.limit.toLocaleString()} neurons</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(100, (cfUsage.neurons / cfUsage.limit) * 100)}%`,
                                                background: cfUsage.neurons / cfUsage.limit > 0.8 ? "rgb(239,68,68)" : cfUsage.neurons / cfUsage.limit > 0.5 ? "rgb(234,179,8)" : "rgb(249,115,22)"
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-neutral-500">{cfUsage.images} imágenes generadas</span>
                                        <span className={cfUsage.remaining < 1500 ? "text-red-400 font-black" : "text-emerald-400 font-black"}>
                                            ~{Math.floor(cfUsage.remaining / 300)} imágenes restantes hoy
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">CF_ACCOUNT_ID</label>
                                    <input
                                        type="text"
                                        value={cfAccountId}
                                        onChange={(e) => setCfAccountId(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                        placeholder="a1b2c3d4e5f6..."
                                    />
                                    <p className="text-[10px] text-neutral-600 italic">Panel Cloudflare → barra lateral derecha</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">CF_API_TOKEN</label>
                                    <div className="relative">
                                        <input
                                            type={showCfToken ? "text" : "password"}
                                            value={cfApiToken}
                                            onChange={(e) => setCfApiToken(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                            placeholder="..."
                                        />
                                        <button type="button" onClick={() => setShowCfToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showCfToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-600 italic">My Profile → API Tokens → Workers AI template</p>
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

                {/* Together AI */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Together AI</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-orange-500/10 text-orange-400 border-orange-500/20">IMÁGENES</Badge>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">$5 GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 text-xl font-black">T</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Together AI · FLUX.1-schnell</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Sin bloqueo geo · Sin CGNAT · Rápido · $5 crédito inicial</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-2">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Cómo obtener $5 gratis (sin tarjeta)</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Ve a <span className="text-orange-400 font-mono">api.together.xyz</span> y crea una cuenta</li>
                                    <li>No necesitas tarjeta — te dan $5 de crédito automáticamente</li>
                                    <li>Ve a <span className="text-neutral-300">Settings → API Keys → Create</span></li>
                                    <li>Pega la key aquí y pulsa Guardar</li>
                                </ol>
                                <p className="text-[10px] text-neutral-500 mt-1">Usa el modelo <span className="font-mono text-orange-300">FLUX.1-schnell-Free</span> — ~$0.0001/imagen, los $5 dan para ~50.000 imágenes.</p>
                            </div>

                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">TOGETHER_API_KEY</label>
                                <div className="relative">
                                    <input
                                        type={showTogetherKey ? "text" : "password"}
                                        value={togetherApiKey}
                                        onChange={(e) => setTogetherApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-orange-500/40 transition-all"
                                        placeholder="..."
                                    />
                                    <button type="button" onClick={() => setShowTogetherKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showTogetherKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">
                                    Al seleccionar proveedor <span className="text-orange-400">Pollinations</span> o <span className="text-orange-400">Together AI</span>, el backend usa esta key para FLUX schnell
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

                {/* Stable Horde */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Stable Horde</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-sky-500/10 text-sky-400 border-sky-500/20">IMÁGENES</Badge>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">100% GRATIS</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 text-xl font-black">H</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Stable Horde · Red Comunitaria</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">GPU voluntaria · SDXL · SD 1.5 · Sin API Key necesaria</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4 space-y-2">
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Cómo funciona</p>
                                <div className="space-y-2">
                                    {[
                                        { icon: "1", title: "Red descentralizada", desc: "Voluntarios donan su GPU. Totalmente gratis, para siempre. Sin tarjeta, sin cuenta obligatoria." },
                                        { icon: "2", title: "Clave anónima", desc: "Sin API key funciona con prioridad baja. Con cuenta gratuita en stablehorde.net obtienes kudos y prioridad." },
                                        { icon: "3", title: "Tiempo de espera", desc: "Cola dinámica: normalmente 30s–3min dependiendo del modelo y carga de la red." },
                                    ].map(s => (
                                        <div key={s.icon} className="flex gap-3">
                                            <span className="w-5 h-5 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{s.icon}</span>
                                            <div>
                                                <p className="text-xs font-black text-white">{s.title}</p>
                                                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{s.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2 max-w-xl">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">STABLE_HORDE_API_KEY (opcional)</label>
                                <div className="relative">
                                    <input
                                        type={showStableHordeKey ? "text" : "password"}
                                        value={stableHordeApiKey}
                                        onChange={(e) => setStableHordeApiKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-sky-500/40 transition-all"
                                        placeholder="Sin key = anónimo (funciona igual)"
                                    />
                                    <button type="button" onClick={() => setShowStableHordeKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                        {showStableHordeKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-600 italic">
                                    Opcional: crea cuenta gratis en <span className="text-sky-400">stablehorde.net</span> → API Key → mayor prioridad en cola
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
                </div>}

                {settingsTab === "integraciones" && <div className="space-y-2">
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

                {/* Gumroad */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Gumroad</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">MARKET</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Gumroad API v2</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Publicación automática · PDF digital · Precio libre</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                                <p className="text-xs text-violet-300 font-medium mb-1">Cómo obtener el Access Token:</p>
                                <ol className="text-[11px] text-neutral-400 space-y-1 list-decimal list-inside">
                                    <li>Ve a <span className="text-violet-400 font-mono">app.gumroad.com/settings/advanced</span></li>
                                    <li>Genera un <span className="font-bold text-white">Access Token</span> con permisos <code className="text-violet-400">edit_products</code></li>
                                    <li>Pega el token aquí y activa la publicación automática</li>
                                    <li>Al completar el pipeline, el PDF se publica automáticamente</li>
                                </ol>
                            </div>
                            <div className="space-y-5">
                                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
                                    <div>
                                        <p className="text-sm font-bold text-white">Publicación automática</p>
                                        <p className="text-xs text-neutral-500 mt-0.5">Crea el producto en Gumroad al completar el pipeline (portada + PDF + listing SEO).</p>
                                    </div>
                                    <Toggle checked={gumroadEnabled} onChange={() => setGumroadEnabled(v => !v)} color="violet" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Access Token</label>
                                        <div className="relative">
                                            <input
                                                type={showGumroadToken ? "text" : "password"}
                                                value={gumroadToken}
                                                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                                onChange={e => setGumroadToken(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/40 transition-all pr-10"
                                            />
                                            <button type="button" onClick={() => setShowGumroadToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                                {showGumroadToken ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">Precio por defecto ($)</label>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={gumroadPrice}
                                            onChange={e => setGumroadPrice(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-violet-500/40 transition-all"
                                        />
                                        <p className="text-[10px] text-neutral-600 ml-1">0 = gratis. Se aplica a todos los libros publicados automáticamente.</p>
                                    </div>
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

                        </div>
                    </Card>
                </section>

                {/* Lulu Direct */}
                <section className="space-y-2 pt-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Lulu Direct</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">PRINT-ON-DEMAND</Badge>
                    </div>
                    <Card variant="outline" className="relative overflow-hidden border-white/5 bg-white/[0.01]">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 text-xl font-black">L</div>
                                <div>
                                    <h3 className="font-black text-lg text-white">Lulu Direct · Print &amp; Ship</h3>
                                    <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Impresión física de libros · Envío directo al cliente</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-violet-500/10 bg-violet-500/[0.03] p-4 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/80">Cómo obtener tus credenciales</p>
                                <ol className="text-[10px] text-neutral-500 space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>Ve a <span className="text-violet-400 font-mono">developers.lulu.com</span> y crea una cuenta</li>
                                    <li>En el panel ve a <span className="text-neutral-300">Applications</span> → <span className="text-neutral-300">Create Application</span></li>
                                    <li>Copia el <span className="text-white font-bold">Client Key</span> y el <span className="text-white font-bold">Client Secret</span></li>
                                </ol>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">LULU_CLIENT_KEY</label>
                                    <input
                                        type="text"
                                        value={luluClientKey}
                                        onChange={(e) => setLuluClientKey(e.target.value)}
                                        className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-violet-500/40 transition-all"
                                        placeholder="client key..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1">LULU_CLIENT_SECRET</label>
                                    <div className="relative">
                                        <input
                                            type={showLuluSecret ? "text" : "password"}
                                            value={luluClientSecret}
                                            onChange={(e) => setLuluClientSecret(e.target.value)}
                                            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 pr-10 text-xs font-mono text-white outline-none focus:border-violet-500/40 transition-all"
                                            placeholder="••••••••••••"
                                        />
                                        <button type="button" onClick={() => setShowLuluSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors">
                                            {showLuluSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {luluStatus && (
                                <div className={`flex items-center gap-2 text-xs font-black ${luluStatus === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
                                    {luluStatus === "ok" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                    {luluStatus === "ok" ? "Conexión verificada con Lulu" : "Error de conexión — revisa las credenciales"}
                                </div>
                            )}

                            <div className="flex items-center gap-3 flex-wrap border-t border-white/5 pt-4">
                                <Button onClick={handleSave} disabled={isSaving} variant="primary" className="font-black uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg shadow-primary/20 italic">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                                </Button>
                                <button
                                    onClick={async () => {
                                        await handleSave();
                                        setLuluStatus(null);
                                        try {
                                            const res = await fetch(`${apiUrl}/lulu/ping`);
                                            setLuluStatus(res.ok ? "ok" : "error");
                                        } catch { setLuluStatus("error"); }
                                    }}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-black text-violet-400 hover:bg-violet-500/20 transition-all disabled:opacity-40"
                                >
                                    <RefreshCw size={12} /> Verificar conexión
                                </button>
                            </div>
                        </div>
                    </Card>
                </section>
                </div>}

                {settingsTab === "sistema" && <div className="space-y-2">
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

                {/* ── MONITOR DEL SISTEMA ──────────────────────────────── */}
                <section className="space-y-3 pt-6 border-t border-white/5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Terminal size={16} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white">Monitor del Sistema</h2>
                                <p className="text-[10px] text-neutral-500">Logs en tiempo real · WebSocket</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-bold ${pollinationsBlocked ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${pollinationsBlocked ? "bg-red-400" : "bg-emerald-400 animate-pulse"}`} />
                                {pollinationsBlocked ? "Pollinations BLOCKED" : "Pollinations OK"}
                            </div>
                            {logs.length > 0 && (
                                <button onClick={() => setLogs([])} className="text-[9px] font-black uppercase text-neutral-700 hover:text-neutral-400 transition-colors tracking-widest">
                                    Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {(["all", "warn", "error"] as const).map(f => (
                            <button key={f} onClick={() => setLogFilter(f)}
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors ${logFilter === f ? "bg-white/10 text-white" : "text-neutral-700 hover:text-neutral-400"}`}>
                                {f === "all" ? "Todo" : f === "warn" ? "⚠ Avisos" : "✕ Errores"}
                            </button>
                        ))}
                        <input type="text" placeholder="Buscar…" value={logSearch} onChange={e => setLogSearch(e.target.value)}
                            className="ml-auto h-5 px-2 rounded bg-white/5 border border-white/8 text-[10px] text-neutral-300 placeholder:text-neutral-700 outline-none focus:border-white/20 w-40" />
                    </div>

                    {/* Terminal al estilo scraper */}
                    <div className="rounded-2xl border border-white/8 bg-[#040404] overflow-hidden flex flex-col shadow-2xl">
                        <div className="h-9 bg-white/[0.02] border-b border-white/5 flex items-center px-4 gap-2 shrink-0">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-500/60" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/60" />
                                <div className={`w-2.5 h-2.5 rounded-full border ${logs.length > 0 ? "bg-emerald-500/60 border-emerald-500 animate-pulse" : "bg-emerald-500/20 border-emerald-500/40"}`} />
                            </div>
                            <span className="text-[9px] font-mono text-neutral-700 tracking-wider">system.log</span>
                            <span className="ml-auto text-[9px] text-neutral-800">{logs.filter(l => (logFilter === "all" || l.level === logFilter) && (!logSearch || l.msg.toLowerCase().includes(logSearch.toLowerCase()))).length} líneas</span>
                        </div>
                        <div className="h-72 overflow-y-auto p-4 font-mono text-[10px] space-y-1 scrollbar-thin scrollbar-thumb-white/5">
                            {logs.filter(l => (logFilter === "all" || l.level === logFilter) && (!logSearch || l.msg.toLowerCase().includes(logSearch.toLowerCase()))).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-800">
                                    <Terminal size={20} className="stroke-1 opacity-20" />
                                    <p className="italic text-[9px]">Esperando logs…</p>
                                </div>
                            ) : (
                                logs
                                    .filter(l => (logFilter === "all" || l.level === logFilter) && (!logSearch || l.msg.toLowerCase().includes(logSearch.toLowerCase())))
                                    .map((entry, i) => {
                                        const time = new Date(entry.t).toTimeString().slice(0, 8);
                                        const color = entry.level === "error" ? "text-rose-400 font-bold" : entry.level === "warn" ? "text-amber-400" : "text-neutral-400";
                                        const prefix = entry.level === "error" ? "✕" : entry.level === "warn" ? "▲" : "›";
                                        return (
                                            <div key={i} className="flex gap-2.5 leading-relaxed animate-in fade-in duration-150">
                                                <span className="text-neutral-800 shrink-0 select-none opacity-50 text-[9px]">{time}</span>
                                                <span className={`shrink-0 select-none ${color}`}>{prefix}</span>
                                                <span className={`${color} tracking-tight break-all`}>{entry.msg}</span>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </section>

                {/* ── Filtro de calidad de imágenes ─────────────────────────── */}
                <section className="space-y-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Filtro de Calidad de Imágenes</h2>
                        <p className="text-sm text-neutral-500">Descarta imágenes demasiado oscuras antes de incluirlas en el PDF del libro.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-white">Activar filtro de calidad</p>
                                <p className="text-xs text-neutral-500 mt-0.5">Solo aplica a libros de colorear. Las páginas con menos blanco del umbral se descartan.</p>
                            </div>
                            <Toggle checked={qualityFilterEnabled} onChange={() => setQualityFilterEnabled(v => !v)} color="emerald" />
                        </div>
                        <div className={`space-y-2 transition-opacity ${qualityFilterEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-neutral-500">Mínimo de píxeles blancos (%)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range" min="20" max="80" step="5"
                                    value={qualityMinWhite}
                                    onChange={e => setQualityMinWhite(e.target.value)}
                                    className="flex-1 accent-emerald-500"
                                />
                                <span className="text-lg font-black text-white w-12 text-right">{qualityMinWhite}%</span>
                            </div>
                            <p className="text-[10px] text-neutral-600">Valor recomendado: 45%. Una página de colorear bien generada tiene 60–80% de blanco. Por debajo de 45% la imagen suele estar quemada o mal generada.</p>
                        </div>
                    </div>
                </section>

                {/* ── Radar — umbral de deduplicación ──────────────────────── */}
                <section className="space-y-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Radar de Nichos</h2>
                        <p className="text-sm text-neutral-500">Ajusta la sensibilidad del filtro que evita nichos duplicados en cada escaneo.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
                        <div>
                            <p className="text-sm font-bold text-white">Umbral de similitud</p>
                            <p className="text-xs text-neutral-500 mt-0.5">Si dos nichos comparten más de este % de palabras clave, se considera duplicado y se filtra.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-4">
                                <input
                                    type="range" min="40" max="90" step="5"
                                    value={dedupThreshold}
                                    onChange={e => setDedupThreshold(e.target.value)}
                                    className="flex-1 accent-violet-500"
                                />
                                <span className="text-lg font-black text-white w-12 text-right">{dedupThreshold}%</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-neutral-600">
                                <span>40% — Filtra más (más estricto)</span>
                                <span className="text-violet-400 font-black">60% recomendado</span>
                                <span>90% — Filtra menos (más permisivo)</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 2FA ──────────────────────────────────────────────────── */}
                <section className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Autenticación en Dos Pasos</h2>
                        <p className="text-sm text-neutral-500">Protege el acceso con un código TOTP (Google Authenticator, Authy…).</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-5">

                        {/* Estado */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl border ${totpEnabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-neutral-500"}`}>
                                    <Shield size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">2FA por TOTP</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        {totpEnabled === null ? "Comprobando…" : totpEnabled ? "Activo — el login pide código del autenticador" : "Inactivo — el login solo pide contraseña"}
                                    </p>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                                totpEnabled === null ? "bg-white/5 border-white/10 text-neutral-500" :
                                totpEnabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                "bg-neutral-500/10 border-neutral-500/20 text-neutral-500"
                            }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${totpEnabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
                                {totpEnabled === null ? "…" : totpEnabled ? "Activo" : "Inactivo"}
                            </div>
                        </div>

                        {/* Paso: configurar nuevo 2FA */}
                        {totpStep === "setup" && totpSetupData && (
                            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 space-y-4">
                                <p className="text-xs font-black text-violet-400 uppercase tracking-widest">Escanea el QR con tu autenticador</p>
                                <div className="flex flex-col sm:flex-row gap-5 items-start">
                                    <img src={totpSetupData.qrCodeUrl} alt="QR 2FA" className="w-36 h-36 rounded-xl border border-white/10 bg-white p-1 shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <p className="text-xs text-neutral-400">Si no puedes escanear, introduce el secreto manualmente:</p>
                                        <code className="block bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-violet-300 break-all select-all">{totpSetupData.secret}</code>
                                        <p className="text-[10px] text-neutral-600">Guarda este secreto en un lugar seguro como backup.</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-xs text-neutral-400">Introduce el código que aparece en tu app para confirmar:</p>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={7}
                                            value={totpCode}
                                            onChange={e => setTotpCode(e.target.value)}
                                            placeholder="000 000"
                                            className="w-32 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white text-center tracking-widest placeholder:text-neutral-700 outline-none focus:border-violet-500/40 transition-all"
                                        />
                                        <button
                                            onClick={handleVerifySetup2FA}
                                            disabled={totpLoading || totpCode.replace(/\s/g, "").length < 6}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-black hover:bg-violet-500/20 transition-all disabled:opacity-40"
                                        >
                                            {totpLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                            Confirmar
                                        </button>
                                        <button
                                            onClick={() => { setTotpStep("idle"); setTotpSetupData(null); setTotpCode(""); }}
                                            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-500 text-xs font-black hover:text-white transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Paso: desactivar 2FA */}
                        {totpStep === "disable" && (
                            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 space-y-4">
                                <p className="text-xs font-black text-rose-400 uppercase tracking-widest">Confirma con tu código actual para desactivar</p>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={7}
                                        value={totpCode}
                                        onChange={e => setTotpCode(e.target.value)}
                                        placeholder="000 000"
                                        className="w-32 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white text-center tracking-widest placeholder:text-neutral-700 outline-none focus:border-rose-500/40 transition-all"
                                    />
                                    <button
                                        onClick={handleDisable2FA}
                                        disabled={totpLoading || totpCode.replace(/\s/g, "").length < 6}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black hover:bg-rose-500/20 transition-all disabled:opacity-40"
                                    >
                                        {totpLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                        Desactivar 2FA
                                    </button>
                                    <button
                                        onClick={() => { setTotpStep("idle"); setTotpCode(""); }}
                                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-neutral-500 text-xs font-black hover:text-white transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Botones de acción */}
                        {totpStep === "idle" && (
                            <div className="flex gap-3 pt-1">
                                {!totpEnabled ? (
                                    <button
                                        onClick={handleSetup2FA}
                                        disabled={totpLoading || totpEnabled === null}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                                    >
                                        {totpLoading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                                        Activar 2FA
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { setTotpStep("disable"); setTotpCode(""); }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black hover:bg-rose-500/20 transition-all"
                                    >
                                        <XCircle size={12} />
                                        Desactivar 2FA
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Voz / TTS ─────────────────────────────────────────────── */}
                <section className="space-y-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Voz del Sistema</h2>
                        <p className="text-sm text-neutral-500">Notificaciones y eventos por voz usando síntesis de texto a audio.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {voiceEnabled
                                    ? <Volume2 size={18} className="text-emerald-400" />
                                    : <VolumeX size={18} className="text-neutral-600" />}
                                <div>
                                    <p className="text-sm font-bold text-white">Activar voz</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">La app hablará cuando terminen catálogos, lleguen mensajes de Telegram, etc.</p>
                                </div>
                            </div>
                            <Toggle checked={voiceEnabled} onChange={(next) => toggleVoice(next)} color="emerald" />
                        </div>
                        <div className={`transition-opacity ${voiceEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
                            <button
                                onClick={() => void testVoice()}
                                disabled={voiceTesting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                            >
                                {voiceTesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                Probar voz
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Datos de Sistema ────────────────────────────────────────── */}
                <section className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Datos de Sistema</h2>
                        <p className="text-sm text-neutral-500">Limpia datos operacionales acumulados que no afectan al pipeline.</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-white">Métricas de prompts</p>
                                <p className="text-xs text-neutral-500 mt-0.5">Estadísticas de rendimiento por prompt e imagen generada.</p>
                            </div>
                            <button
                                onClick={async () => {
                                    setPurgingMetrics(true);
                                    try {
                                        const res = await fetch(`${apiUrl}/pipeline/prompt-metrics`, { method: "DELETE" });
                                        const data = await res.json();
                                        toast.success(`Borradas ${data.deleted ?? 0} métricas`);
                                    } catch { toast.error("Error al limpiar"); }
                                    setPurgingMetrics(false);
                                }}
                                disabled={purgingMetrics}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black hover:bg-rose-500/20 transition-all disabled:opacity-50 shrink-0"
                            >
                                {purgingMetrics ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                Limpiar
                            </button>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-white">Datos extraídos</p>
                                <p className="text-xs text-neutral-500 mt-0.5">Resultados del motor extractor (webs, APIs, scraping).</p>
                            </div>
                            <button
                                onClick={async () => {
                                    setPurgingExtracted(true);
                                    try {
                                        const res = await fetch(`${apiUrl}/extractor/data`, { method: "DELETE" });
                                        const data = await res.json();
                                        toast.success(`Borrados ${data.deleted ?? 0} registros`);
                                    } catch { toast.error("Error al limpiar"); }
                                    setPurgingExtracted(false);
                                }}
                                disabled={purgingExtracted}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black hover:bg-rose-500/20 transition-all disabled:opacity-50 shrink-0"
                            >
                                {purgingExtracted ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                Limpiar
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Sesión ─────────────────────────────────────────────────── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white tracking-tight italic">Sesión</h2>
                        <Badge variant="neutral" className="text-[8px] font-black uppercase bg-violet-500/10 text-violet-400 border-violet-500/20">JWT · 24H</Badge>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                                <Lock size={16} className="text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-white">Token de acceso</p>
                                <p className="text-[11px] text-neutral-500 mt-0.5 font-mono truncate">
                                    {(() => {
                                        const exp = getTokenExpiry();
                                        if (!exp) return "Sin sesión activa";
                                        const hours = Math.max(0, Math.floor((exp - Date.now()) / 3600000));
                                        const mins = Math.max(0, Math.floor(((exp - Date.now()) % 3600000) / 60000));
                                        return `Expira en ${hours}h ${mins}m`;
                                    })()}
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setSessionRefreshing(true);
                                    const ok = await refreshToken();
                                    setSessionRefreshing(false);
                                    if (ok) toast.success("Sesión renovada — nueva duración 24h");
                                    else toast.error("No se pudo renovar. Vuelve a iniciar sesión.");
                                }}
                                disabled={sessionRefreshing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-black hover:bg-violet-500/20 transition-all disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={sessionRefreshing ? "animate-spin" : ""} />
                                Renovar sesión
                            </button>
                        </div>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">
                            El token se renueva automáticamente cuando quedan menos de 3 horas. Usa el botón si quieres forzar la renovación ahora.
                        </p>
                    </div>
                </section>
                </div>}

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
