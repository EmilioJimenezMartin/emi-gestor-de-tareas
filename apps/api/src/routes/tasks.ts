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

    const buildTaskQuery = (id: string) => {
        const query: any = { $or: [{ id: id }, { slug: id }] };
        if (id && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
            query.$or.push({ _id: new mongoose.Types.ObjectId(id) });
        }
        return query;
    };

    const normalizeComments = (raw: any): any[] => {
        if (!Array.isArray(raw)) return [];
        return raw
            .map((c) => {
                if (typeof c === "string") {
                    const text = c.trim();
                    if (!text) return null;
                    return { id: new mongoose.Types.ObjectId().toString(), text, createdAt: new Date() };
                }
                if (c && typeof c === "object") {
                    const text = typeof c.text === "string" ? c.text.trim() : "";
                    if (!text) return null;
                    const id = typeof c.id === "string" && c.id ? c.id : new mongoose.Types.ObjectId().toString();
                    const createdAt = c.createdAt ? new Date(c.createdAt) : new Date();
                    const updatedAt = c.updatedAt ? new Date(c.updatedAt) : undefined;
                    return { id, text, createdAt, ...(updatedAt ? { updatedAt } : {}) };
                }
                return null;
            })
            .filter(Boolean);
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
            const id = request.params.id;
            const updateProps = request.body || {};

            if (Object.prototype.hasOwnProperty.call(updateProps, "comments")) {
                updateProps.comments = normalizeComments(updateProps.comments);
            }

            console.log("[PATCH /tasks/" + id + "] Updating with:", JSON.stringify(updateProps));

            const query = buildTaskQuery(id);

            // Using the Mongoose model but with strict: false (set in the model file)
            // findOneAndUpdate with { returnDocument: 'after' } returns the updated document
            const task = await Task.findOneAndUpdate(
                query,
                { $set: updateProps },
                { returnDocument: 'after', runValidators: false }
            );

            if (!task) {
                console.warn("[PATCH /tasks/" + id + "] Task not found");
                return reply.status(404).send({ error: "Task not found", searched: id });
            }

            console.log("[PATCH /tasks/" + id + "] SUCCESS. Comments count:", (task as any).comments ? (task as any).comments.length : 0);
            return reply.send({ success: true, task: task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to update task", message: error.message });
        }
    });

    // Add a single comment to an existing task (atomic $push)
    app.post("/tasks/:id/comments", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const id = request.params.id;
            const body = request.body || {};
            const text = typeof body.text === "string" ? body.text.trim() : "";

            if (!text) {
                return reply.status(400).send({ success: false, error: "Comment text is required" });
            }

            const comment = {
                id: new mongoose.Types.ObjectId().toString(),
                text,
                createdAt: new Date()
            };

            const query = buildTaskQuery(id);
            const task = await Task.findOneAndUpdate(
                query,
                { $push: { comments: comment } },
                { returnDocument: 'after', runValidators: false }
            );

            if (!task) {
                return reply.status(404).send({ success: false, error: "Task not found", searched: id });
            }

            return reply.status(201).send({ success: true, comment, task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ success: false, error: "Failed to add comment", message: error.message });
        }
    });

    app.patch("/tasks/:id/comments/:commentId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const id = request.params.id;
            const commentId = request.params.commentId;
            const body = request.body || {};
            const text = typeof body.text === "string" ? body.text.trim() : "";

            if (!text) {
                return reply.status(400).send({ success: false, error: "Comment text is required" });
            }

            const query = buildTaskQuery(id);
            const task = await Task.findOneAndUpdate(
                { ...query, "comments.id": commentId },
                {
                    $set: {
                        "comments.$.text": text,
                        "comments.$.updatedAt": new Date()
                    }
                },
                { returnDocument: 'after', runValidators: false }
            );

            if (!task) {
                return reply.status(404).send({ success: false, error: "Task or comment not found" });
            }

            return reply.send({ success: true, task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ success: false, error: "Failed to update comment", message: error.message });
        }
    });

    app.delete("/tasks/:id/comments/:commentId", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const id = request.params.id;
            const commentId = request.params.commentId;

            const query = buildTaskQuery(id);
            const task = await Task.findOneAndUpdate(
                query,
                { $pull: { comments: { id: commentId } } },
                { returnDocument: 'after', runValidators: false }
            );

            if (!task) {
                return reply.status(404).send({ success: false, error: "Task not found" });
            }

            return reply.send({ success: true, task });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ success: false, error: "Failed to delete comment", message: error.message });
        }
    });

    // Add Task Endpoint
    app.post("/tasks", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const taskData = request.body || {};
            if (!taskData.id) {
                taskData.id = taskData.slug || "task-" + Date.now();
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

    // Trigger dummy task
    app.post("/tasks/trigger", async (request, reply) => {
        if (!deps.agenda) {
            return reply.status(503).send({ success: false, error: "Agenda not ready" });
        }
        await deps.agenda.now("dummy-task", { name: "Usuario de Prueba del Dashboard" });
        deps.io?.emit("tasks:enqueued", { name: "dummy-task" });

        return reply.send({
            success: true,
            message: "La tarea ha sido encolada correctamente."
        });
    });

    // Delete Task Endpoint
    app.delete("/tasks/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const id = request.params.id;

            const query = buildTaskQuery(id);

            const deleted = await Task.findOneAndDelete(query);

            if (!deleted) {
                return reply.status(404).send({ error: "Task not found" });
            }

            return reply.send({ success: true, message: "Task deleted successfully" });
        } catch (error: any) {
            app.log.error(error);
            return reply.status(500).send({ error: "Failed to delete task" });
        }
    });
}
