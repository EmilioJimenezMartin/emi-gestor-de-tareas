"use client";

import { useEffect, useMemo, useState } from "react";
import {
    LayoutGrid,
    Home as HomeIcon,
    CheckSquare,
    Settings,
    Plus,
    Bell,
    Database
} from "lucide-react";
import { NavItem, MobileNavItem } from "@/components/layout/nav-items";
import { AddTaskModal } from "@/components/tasks/add-task-modal";
import { Button } from "@/components/ui/button";
import { createApiSocket } from "@/lib/socket";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dbStatus, setDbStatus] = useState<"unknown" | "connected" | "disconnected" | "connecting" | "disconnecting">("connecting");
    const apiUrl = useMemo(
        () =>
            (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(
                /\/$/,
                ""
            ),
        []
    );

    useEffect(() => {
        const socket = createApiSocket(apiUrl);
        socket.on("db:status", (data: { status: string }) => {
            const status = data.status;
            if (
                status === "unknown" ||
                status === "connected" ||
                status === "disconnected" ||
                status === "connecting" ||
                status === "disconnecting"
            ) {
                setDbStatus(status);
            } else {
                setDbStatus("unknown");
            }
        });
        socket.on("disconnect", () => {
            setDbStatus("unknown");
        });
        socket.on("connect_error", () => {
            setDbStatus("unknown");
        });

        return () => {
            socket.disconnect();
        };
    }, [apiUrl]);

    return (
        <div className="flex min-h-screen bg-black text-foreground overflow-hidden">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex flex-col w-56 glass border-r-0 z-40 relative">
                <div className="p-6">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-lg">e</div>
                        <span className="font-bold tracking-tight text-xl">emi</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    <NavItem href="/" icon={<HomeIcon size={20} />} label="Home" />
                    <NavItem href="/tareas" icon={<CheckSquare size={20} />} label="Tareas" />
                    <NavItem href="/dashboard" icon={<Database size={20} />} label="Extractor" />
                    <NavItem href="/ajustes" icon={<Settings size={20} />} label="Ajustes" />

                </nav>

                <div className="p-4 border-t border-white/5 pb-6 flex justify-center">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsModalOpen(true)}
                        className="rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-wide group w-full"
                    >
                        <div className="bg-white/20 rounded-[6px] p-0.5 group-hover:rotate-90 transition-transform">
                            <Plus size={14} />
                        </div>
                        Nueva Tarea
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-background min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 h-16 glass border-x-0 border-t-0 px-6 flex items-center justify-between">
                    <div className="md:hidden flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-bold text-sm">e</div>
                        <span className="font-bold text-lg">emi</span>
                    </div>
                    <div className="hidden md:flex items-center gap-4">
                        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-widest px-2">Gestor de Tareas</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 shadow-inner">
                            {dbStatus === "connected" ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase">ONLINE</span>
                                </>
                            ) : dbStatus === "connecting" ? (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                                    <span className="text-[10px] font-black tracking-widest text-amber-500 uppercase">CONNECTING</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                    <span className="text-[10px] font-black tracking-widest text-rose-500 uppercase">DEV MODE</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2.5 rounded-full hover:bg-white/5 transition-colors relative">
                                <Bell size={20} className="text-neutral-400" />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-8 max-w-7xl mx-auto w-full pb-32 md:pb-8">
                    {children}
                </div>
            </main>

            {/* Tab Bar - Mobile */}
            <nav className="md:hidden fixed bottom-6 left-6 right-6 h-16 glass rounded-2xl px-6 flex items-center justify-around z-50 shadow-2xl shadow-black/50">
                <MobileNavItem href="/" icon={<HomeIcon size={24} />} />
                <MobileNavItem href="/tareas" icon={<CheckSquare size={24} />} />
                <div className="-mt-16">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-14 h-14 bg-primary rounded-2xl shadow-xl shadow-primary/40 flex items-center justify-center text-white active:scale-95 transition-transform border border-white/10"
                    >
                        <Plus size={28} strokeWidth={1.5} />
                    </button>
                </div>
                <MobileNavItem href="/dashboard" icon={<Database size={24} />} />
                <MobileNavItem href="/ajustes" icon={<Settings size={24} />} />
            </nav>

            {/* Modal */}
            <AddTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
