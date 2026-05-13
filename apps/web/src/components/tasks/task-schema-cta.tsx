"use client";

import { FileJson, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const TASK_JSON_MODEL = {
    "title": { "type": "string", "required": true, "description": "Nombre de la oportunidad" },
    "slug": { "type": "string", "required": true, "description": "Identificador único en formato url-friendly" },
    "status": { "type": "string", "required": true, "options": ["backlog", "in-progress", "done"] },
    "priority": { "type": "string", "required": true, "options": ["low", "medium", "high", "urgent"] },
    "categories": { "type": "array", "items": "string", "required": false },
    "internal_score": { "type": "number", "required": false, "default": 0 },
    "description": { "type": "string", "required": true, "description": "Descripción detallada del problema y solución" },
    "viability_metrics": {
        "type": "object",
        "required": true,
        "properties": {
            "implementation_ease": { "type": "number", "range": [1, 5] },
            "success_probability": { "type": "number", "range": [1, 5] },
            "resource_intensity": { "type": "number", "range": [1, 5] },
            "time_to_mvp": { "type": "number", "range": [1, 5] },
            "roi_potential": { "type": "number", "range": [1, 5] }
        }
    },
    "technical_stack": {
        "type": "object",
        "required": true,
        "properties": {
            "framework": { "type": "string" },
            "database": { "type": "string" },
            "apis_required": { "type": "array", "items": "string" }
        }
    },
    "business_logic": {
        "type": "object",
        "required": true,
        "properties": {
            "problem": { "type": "string" },
            "solution": { "type": "string" },
            "monetization": { "type": "array", "items": "string" }
        }
    },
    "execution_pipeline": {
        "type": "array",
        "required": true,
        "items": {
            "type": "object",
            "properties": {
                "step": { "type": "number", "required": true },
                "task": { "type": "string", "required": true },
                "details": { "type": "string", "required": true }
            }
        }
    },
    "data_schema_preview": { "type": "object", "required": true, "description": "JSON de ejemplo del esquema de datos que manejará la app" }
};

export function TaskSchemaCTA() {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        try {
            navigator.clipboard.writeText(JSON.stringify(TASK_JSON_MODEL, null, 2));
            toast.success("JSON Modelo copiado al portapapeles", {
                description: "Úsalo para configurar el extractor o realizar peticiones a la API desde AI.",
                duration: 4000
            });
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("No se pudo copiar el JSON");
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="group relative flex items-center gap-3 px-6 py-3 bg-white/[0.03] border border-white/5 hover:border-primary/30 rounded-2xl transition-all duration-300 hover:bg-primary/[0.02] shadow-xl shadow-black/20"
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 mb-0 ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/10 text-primary group-hover:scale-110"}`}>
                {copied ? <Check size={18} /> : <FileJson size={18} />}
            </div>

            <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-primary transition-colors">Esquema Técnico</span>
                <span className="text-xs font-bold text-white tracking-tight">Copiar JSON Modelo</span>
            </div>

            <div className="ml-2 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                <Copy size={12} className="text-neutral-400" />
            </div>

            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none rounded-2xl" />
        </button>
    );
}
