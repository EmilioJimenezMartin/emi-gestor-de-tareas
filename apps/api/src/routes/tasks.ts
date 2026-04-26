import { FastifyInstance } from "fastify";
import type { Agenda } from "agenda";
import type { Server as SocketIOServer } from "socket.io";
import { Task } from "../models/task.js";
import fs from "fs";
import path from "path";

export async function registerTaskRoutes(
    app: FastifyInstance,
    deps: { agenda: Agenda; io?: SocketIOServer }
) {

    app.get("/tasks", async (request, reply) => {
        try {
            let tasks = await Task.find({});

            // Seed if empty
            if (tasks.length === 0) {
                app.log.info("Task collection empty, seeding from tasks.json...");
                const dataPath = path.join(process.cwd(), "..", "web", "src", "data", "tasks.json");
                if (fs.existsSync(dataPath)) {
                    const fileContents = fs.readFileSync(dataPath, "utf8");
                    const data = JSON.parse(fileContents);
                    await Task.insertMany(data.tasks);
                    tasks = await Task.find({});
                }
            }
            return reply.send({ tasks });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to fetch tasks" });
        }
    });

    app.patch("/tasks/:id", async (request: any, reply) => {
        try {
            const { id } = request.params;
            const updateProps = request.body as Record<string, any>;

            const task = await Task.findOneAndUpdate({ id }, { $set: updateProps }, { new: true });

            if (!task) {
                return reply.status(404).send({ error: "Task not found" });
            }

            return reply.send({ success: true, task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to update task" });
        }
    });

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
