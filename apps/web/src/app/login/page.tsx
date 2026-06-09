"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { login, verify2fa, setToken, isAuthenticated } from "@/lib/auth-client";

export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<"credentials" | "2fa">("credentials");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [pendingToken, setPendingToken] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const codeRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAuthenticated()) router.replace("/");
    }, [router]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await login(email.trim().toLowerCase(), password);
            if (data.twoFactorRequired && data.pendingToken) {
                setPendingToken(data.pendingToken);
                setStep("2fa");
                setTimeout(() => codeRef.current?.focus(), 100);
            } else if (data.token) {
                setToken(data.token);
                router.replace("/");
            }
        } catch (err: any) {
            setError(err.message || "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    async function handle2FA(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await verify2fa(pendingToken, code.replace(/\s/g, ""));
            setToken(data.token);
            router.replace("/");
        } catch (err: any) {
            setError(err.message || "Código incorrecto");
            setCode("");
            codeRef.current?.focus();
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black px-4">
            <div className="w-full max-w-sm">
                {/* Logo / title */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4">
                        <ShieldCheck className="w-7 h-7 text-white/70" />
                    </div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">EMI Gestor</h1>
                    <p className="text-sm text-white/40 mt-1">
                        {step === "credentials" ? "Inicia sesión para continuar" : "Verificación en dos pasos"}
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                    {step === "credentials" ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5 ml-0.5">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="tu@email.com"
                                        required
                                        autoComplete="email"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5 ml-0.5">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
                                    />
                                </div>
                            </div>
                            {error && (
                                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black font-medium text-sm py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {loading ? "Verificando..." : "Iniciar sesión"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handle2FA} className="space-y-4">
                            <p className="text-xs text-white/50 text-center">
                                Introduce el código de 6 dígitos de tu app de autenticación
                            </p>
                            <div>
                                <label className="block text-xs text-white/50 mb-1.5 ml-0.5">Código 2FA</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                                    <input
                                        ref={codeRef}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9 ]{6,7}"
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                        placeholder="000 000"
                                        required
                                        autoComplete="one-time-code"
                                        maxLength={7}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all text-center tracking-widest"
                                    />
                                </div>
                            </div>
                            {error && (
                                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                            )}
                            <button
                                type="submit"
                                disabled={loading || code.replace(/\s/g, "").length < 6}
                                className="w-full bg-white text-black font-medium text-sm py-2.5 rounded-xl hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {loading ? "Verificando..." : "Verificar código"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setStep("credentials"); setError(""); setCode(""); }}
                                className="w-full text-xs text-white/30 hover:text-white/50 transition-colors py-1"
                            >
                                ← Volver
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
