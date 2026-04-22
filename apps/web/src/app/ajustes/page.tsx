import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Settings, Shield, Bell, Database } from "lucide-react";

export default function AjustesPage() {
    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                    <Settings size={16} className="sm:size-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">Preferencias</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mt-1">
                    Ajustes de <span className="text-primary">Sistema</span>
                </h1>
                <p className="text-sm sm:text-base text-neutral-500 max-w-2xl">
                    Configura tus preferencias de IA, integraciones y seguridad desde este panel centralizado.
                </p>
            </header>

            <div className="space-y-12">
                {/* IA Configuration Section */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Configuración de IA</h2>
                            <p className="text-xs text-neutral-500 mt-1">Gestiona los modelos y proveedores de lenguaje.</p>
                        </div>
                    </div>

                    <Card variant="outline" className="p-4 sm:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">G</div>
                                    <h3 className="font-bold">Google Gemini</h3>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-xs text-neutral-500">Selecciona el motor de Google para tareas de razonamiento avanzado y grandes contextos.</p>
                                    <select className="w-full h-11 bg-secondary border border-white/5 rounded-xl px-4 text-sm text-white outline-none focus:border-primary transition-colors">
                                        <option>Gemini 1.5 Pro</option>
                                        <option>Gemini 1.5 Flash</option>
                                        <option>Gemini 1.0 Ultra</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-tighter">Status: Latencia Optimizada</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs italic">H</div>
                                    <h3 className="font-bold">Hugging Face (Open Source)</h3>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-xs text-neutral-500">Utiliza modelos abiertos de HuggingFace Hub para tareas específicas y mayor privacidad.</p>
                                    <select className="w-full h-11 bg-secondary border border-white/5 rounded-xl px-4 text-sm text-white outline-none focus:border-primary transition-colors">
                                        <option>Llama 3 (8B Instruct)</option>
                                        <option>Mistral v0.2</option>
                                        <option>Phi-3 Mini</option>
                                        <option>Gemma 7B</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-tighter">Status: Conectado a Hub API</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
                            <Button variant="primary">
                                Guardar Configuración
                            </Button>
                        </div>
                    </Card>
                </section>

                {/* Other Setting sections (Placeholders for premium feel) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card variant="outline" className="p-6 flex flex-col gap-4 border-white/5">
                        <div className="flex items-center gap-3">
                            <Shield size={20} className="text-primary" />
                            <h3 className="font-bold">Seguridad</h3>
                        </div>
                        <p className="text-sm text-neutral-500">Gestiona tus API Keys y permisos de acceso al sistema.</p>
                        <Button variant="secondary" className="w-fit">Administrar Keys</Button>
                    </Card>

                    <Card variant="outline" className="p-6 flex flex-col gap-4 border-white/5">
                        <div className="flex items-center gap-3">
                            <Bell size={20} className="text-primary" />
                            <h3 className="font-bold">Notificaciones</h3>
                        </div>
                        <p className="text-sm text-neutral-500">Configura las alertas de Telegram y avisos de sistema.</p>
                        <Button variant="secondary" className="w-fit">Configurar Alertas</Button>
                    </Card>

                    <Card variant="outline" className="p-6 flex flex-col gap-4 border-white/5">
                        <div className="flex items-center gap-3">
                            <Database size={20} className="text-primary" />
                            <h3 className="font-bold">Base de Datos</h3>
                        </div>
                        <p className="text-sm text-neutral-500">Estado de la conexión con MongoDB y copias de seguridad.</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-xs text-neutral-400 font-bold">CONNECTED</span>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
