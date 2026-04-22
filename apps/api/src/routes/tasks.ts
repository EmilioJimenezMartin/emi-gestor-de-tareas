import { FastifyInstance } from "fastify";
import type { Agenda } from "agenda";
import type { Server as SocketIOServer } from "socket.io";

// Endpoint para controlar y encilar tareas desde el Dashboard
export async function registerTaskRoutes(
  app: FastifyInstance,
  deps: { agenda: Agenda; io?: SocketIOServer }
) {

    // Endpoint de prueba que el Dashboard puede llamar
    app.post("/tasks/trigger", async (request, reply) => {

        // agenda.now() añade la tarea a MongoDB para ejecución inmediata
        await deps.agenda.now("dummy-task", { name: "Usuario de Prueba del Dashboard" });
        deps.io?.emit("tasks:enqueued", { name: "dummy-task" });

        return reply.send({
            success: true,
            message: "La tarea 'dummy-task' ha sido encolada correctamente para su ejecución inmediata."
        });
    });

}
