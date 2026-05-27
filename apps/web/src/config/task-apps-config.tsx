export interface TaskAppMeta {
    title: string;
    description: string;
    engineStatus: string;
}

export const TASK_APPS_REGISTRY: Record<string, TaskAppMeta> = {
    "amazon-kdp-ai-automation": {
        title: "KDP Factory",
        description: "Panel de control avanzado para la generación industrializada de activos digitales. Gestiona el ciclo de vida completo desde el brainstorming de nichos hasta la exportación final.",
        engineStatus: "READY_TO_BOOT",
    },
    "ai-training-data-factory": {
        title: "DataRefinery",
        description: "Convierte tus catálogos generados en datasets de entrenamiento listos para vender en HuggingFace Hub y Civitai. Selecciona imágenes, añade ratings de calidad y exporta en formato JSONL con dataset card incluida.",
        engineStatus: "READY_TO_BOOT",
    },
    "ai-seamless-pattern-automation": {
        title: "Seamless Pattern Engine",
        description: "Factoría de patrones textiles seamless para Redbubble, Spoonflower, Society6 y Merch by Amazon. Genera patrones tileables con preview 2×2 y 3×3, paletas de color predefinidas y guía de specs por plataforma.",
        engineStatus: "READY_TO_BOOT",
    },
};

export function getTaskAppMeta(slug: string): TaskAppMeta | null {
    return TASK_APPS_REGISTRY[slug] ?? null;
}
