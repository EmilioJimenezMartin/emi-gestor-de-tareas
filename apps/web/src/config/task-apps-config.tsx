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
    // Future apps go here
};

export function getTaskAppMeta(slug: string): TaskAppMeta | null {
    return TASK_APPS_REGISTRY[slug] ?? null;
}
