"use client";

import { FileJson, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const TASK_JSON_MODEL = {
    "_id": "ObjectId",

    "id": "string",
    "title": "string",
    "slug": "string",

    "status": "enum",
    "priority": "enum",

    "categories": ["string"],

    "description": "string",

    "internal_score": "number",

    "viability_metrics": {
        "implementation_ease": "number",
        "success_probability": "number",
        "resource_intensity": "number",
        "time_to_mvp": "number",
        "roi_potential": "number"
    },

    "technical_stack": {
        "framework": "string",
        "database": "string",
        "apis_required": ["string"]
    },

    "business_logic": {
        "problem": "string",
        "solution": "string",
        "monetization": ["string"]
    },

    "execution_pipeline": [
        {
            "_id": "ObjectId|string",
            "step": "number",
            "task": "string",
            "details": "string"
        }
    ],

    "data_schema_preview": {
        "entity_primary": "string",
        "entity_relation": "string",
        "entity_score": "number",
        "entity_value": "number",
        "entity_status": "enum"
    },

    "createdAt": "Date",
    "updatedAt": "Date",

    "comments": [
        {
            "id": "string",
            "text": "string",
            "createdAt": "Date",
            "updatedAt": "Date?"
        }
    ],

    "__v": "number"
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
