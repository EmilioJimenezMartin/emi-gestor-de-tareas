"use client";

import React from "react";

export interface AppTab {
    id: string;
    name: string;
    icon: React.ReactNode;
    badge?: string | number;
}

interface AppTabNavProps {
    tabs: AppTab[];
    activeTab: string;
    onChange: (id: string) => void;
    storageKey?: string;
    glowing?: boolean;
}

export function AppTabNav({ tabs, activeTab, onChange, storageKey, glowing }: AppTabNavProps) {
    const handleChange = (id: string) => {
        if (storageKey) localStorage.setItem(storageKey, id);
        onChange(id);
    };

    return (
        <div className="sticky top-[90px] z-[50] w-full flex justify-center pointer-events-none px-4">
            <div className="relative pointer-events-auto">
                {glowing && (
                    <>
                        <div
                            className="absolute inset-[-3px] rounded-[36px] pointer-events-none"
                            style={{
                                animation: "spin 3s linear infinite",
                                background: "conic-gradient(from 0deg, transparent 0%, transparent 52%, #f59e0b 68%, #fbbf24 78%, #f97316 86%, transparent 100%)",
                                opacity: 0.85,
                            }}
                        />
                        <div
                            className="absolute inset-[-6px] rounded-[38px] pointer-events-none"
                            style={{
                                animation: "spin 3s linear infinite",
                                background: "conic-gradient(from 0deg, transparent 0%, transparent 52%, #f59e0b 68%, #fbbf24 78%, #f97316 86%, transparent 100%)",
                                opacity: 0.45,
                                filter: "blur(8px)",
                            }}
                        />
                    </>
                )}
            <div className="flex p-1.5 bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-full overflow-x-auto no-scrollbar relative">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => handleChange(tab.id)}
                        className={`relative flex items-center gap-2 md:gap-3 px-4 md:px-8 py-3.5 rounded-[24px] text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 whitespace-nowrap justify-center ${
                            activeTab === tab.id
                                ? "bg-white text-black shadow-lg scale-[1.05] z-10"
                                : "text-neutral-500 hover:text-white hover:bg-white/5"
                        }`}
                    >
                        {tab.icon}
                        <span className="hidden md:inline">{tab.name}</span>
                        {tab.badge !== undefined && tab.badge !== 0 && (
                            <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[8px] font-black flex items-center justify-center ${
                                activeTab === tab.id ? "bg-black text-white" : "bg-white/20 text-neutral-300"
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            </div>
        </div>
    );
}
