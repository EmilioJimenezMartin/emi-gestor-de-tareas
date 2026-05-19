"use client";

import { useMemo } from "react";
import { BrainCircuit } from "lucide-react";
import { MotorExtractor } from "@/components/extractor/MotorExtractor";

export default function ExtractorDashboard() {
    const apiUrl = useMemo(() => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, ""), []);

    return (
        <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col gap-4 relative">
                <div className="absolute -left-10 -top-10 w-64 h-64 bg-sky-500/5 blur-[100px] pointer-events-none" />
                <div className="flex items-center gap-4 relative">
                    <div className="w-14 h-14 rounded-3xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                        <BrainCircuit size={26} className="text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white italic leading-tight">
                            Motor <span className="text-sky-400 italic">Extractor</span>
                        </h1>
                        <p className="text-sm text-neutral-500 max-w-2xl font-medium leading-relaxed">
                            Extrae, analiza y normaliza datos de cualquier URL o API usando IA.
                        </p>
                    </div>
                </div>
            </header>

            {/* Extractor */}
            <MotorExtractor apiUrl={apiUrl} />
        </div>
    );
}
