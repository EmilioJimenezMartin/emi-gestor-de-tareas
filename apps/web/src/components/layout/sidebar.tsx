"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, User, Settings } from "lucide-react";

const navItems = [
    { name: "Inicio", href: "/", icon: Home },
    { name: "Tareas", href: "/tareas", icon: CheckSquare },
    { name: "Perfil", href: "/perfil", icon: User },
    { name: "Ajustes", href: "/ajustes", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 fixed top-0 left-0 h-full border-r border-slate-800 bg-[#020617]/50 backdrop-blur-xl px-4 py-6 z-40">
                <div className="mb-8 px-2 text-xl font-bold text-white tracking-tight">
                    Emi Gestor
                </div>
                <nav className="flex-1 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (pathname !== "/" && pathname?.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                                    ? "bg-slate-800/80 text-white font-medium shadow-sm"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    }`}
                            >
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#020617]/80 backdrop-blur-xl border-t border-slate-800 z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="flex justify-around items-center h-16 px-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (pathname !== "/" && pathname?.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${isActive ? "text-white" : "text-slate-500"
                                    }`}
                            >
                                <div className={`relative p-1 rounded-full transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                                    <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                                    {isActive && (
                                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                                    )}
                                </div>
                                <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
