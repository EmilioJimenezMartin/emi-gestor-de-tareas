import { FastifyInstance } from "fastify";
import type { Agenda } from "agenda";
import type { Server as SocketIOServer } from "socket.io";
import { Task } from "../models/task.js";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

export async function registerTaskRoutes(
    app: FastifyInstance,
    deps: { agenda?: Agenda; io?: SocketIOServer }
) {
    const ensureMongo = (reply: any) => {
        if (mongoose.connection.readyState !== 1) {
            reply.status(503).send({ error: "MongoDB not connected" });
            return false;
        }
        return true;
    };

    app.get("/tasks", async (request, reply) => {
        if (!ensureMongo(reply)) return;
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
        if (!ensureMongo(reply)) return;
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

    // Add Task Endpoint
    app.post("/tasks", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const taskData = request.body as Record<string, any>;
            if (!taskData.id) {
                taskData.id = taskData.slug || `task-${Date.now()}`;
            }
            if (!taskData.slug) {
                taskData.slug = taskData.id;
            }

            const task = new Task(taskData);
            await task.save();

            return reply.status(201).send({ success: true, task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to create task", details: error.message });
        }
    });

    // Endpoint de prueba que el Dashboard puede llamar
    app.post("/tasks/trigger", async (request, reply) => {
        if (!deps.agenda) {
            return reply.status(503).send({ success: false, error: "Agenda not ready" });
        }
        // agenda.now() añade la tarea a MongoDB para ejecución inmediata
        await deps.agenda.now("dummy-task", { name: "Usuario de Prueba del Dashboard" });
        deps.io?.emit("tasks:enqueued", { name: "dummy-task" });

        return reply.send({
            success: true,
            message: "La tarea 'dummy-task' ha sido encolada correctamente para su ejecución inmediata."
        });
    });

}
