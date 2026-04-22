import type { Agenda, Job } from "agenda";

// Registramos aquí las funciones que componen nuestras "mini aplicaciones"
export function defineJobs(agenda: Agenda) {
    agenda.define("dummy-task", async (job: Job) => {
        // Aquí puedes recibir parámetros enviados desde el frontend u otras zonas de la API
        const data = (job.attrs.data ?? {}) as { name?: string };
        const name = data.name ?? "anónimo";

        console.log(`\n========================================`);
        console.log(`⚙️ [JOB EXECUTION] Ejecutando 'dummy-task'`);
        console.log(`⏰ [TIMESTAMP] ${new Date().toISOString()}`);
        console.log(`👤 [DATA] Hola ${name}, tu tarea programada ha funcionado correctamente.`);
        console.log(`========================================\n`);

        // Al agregar throw error, la base de datos registra que el job falló
        // Si la función acaba normal, se marca automáticamente como completada.

        // Simula que es una operación asíncrona de 2 segundos
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return true;
    });
}
