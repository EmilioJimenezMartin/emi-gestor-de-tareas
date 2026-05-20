"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, ShoppingBag } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function EtsyCallbackPage() {
    const params = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const code = params.get("code");
        const state = params.get("state");
        const error = params.get("error");

        if (error) {
            setStatus("error");
            setMessage(`Etsy rechazó la autorización: ${error}`);
            return;
        }

        if (!code || !state) {
            setStatus("error");
            setMessage("Parámetros de callback inválidos (falta code o state).");
            return;
        }

        (async () => {
            try {
                const res = await fetch(`${API}/etsy/auth/callback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code, state }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Error desconocido");
                setStatus("success");
                setMessage(`Conectado correctamente. Shop ID: ${data.shopId ?? "—"}`);
                setTimeout(() => router.push("/tareas"), 2500);
            } catch (e: any) {
                setStatus("error");
                setMessage(e.message);
            }
        })();
    }, [params, router]);

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/80 backdrop-blur-xl p-8 text-center shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag size={24} className="text-amber-400" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Etsy OAuth</p>

                {status === "loading" && (
                    <>
                        <Loader2 size={28} className="text-amber-400 animate-spin mx-auto mb-3" />
                        <p className="text-white font-bold">Completando autorización...</p>
                        <p className="text-xs text-neutral-500 mt-1">Intercambiando código con la API</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircle size={28} className="text-emerald-400 mx-auto mb-3" />
                        <p className="text-white font-bold">¡Etsy conectado!</p>
                        <p className="text-xs text-neutral-400 mt-1">{message}</p>
                        <p className="text-[10px] text-neutral-600 mt-3">Redirigiendo...</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <XCircle size={28} className="text-red-400 mx-auto mb-3" />
                        <p className="text-white font-bold">Error al conectar</p>
                        <p className="text-xs text-red-400 mt-1">{message}</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-4 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-neutral-300 transition-all"
                        >
                            Volver
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
