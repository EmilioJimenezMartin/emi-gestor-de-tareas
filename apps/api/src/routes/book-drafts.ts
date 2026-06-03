import { FastifyInstance } from "fastify";
import { BookDraft } from "../models/book-draft.js";
import { getMongoStatus } from "../lib/mongo.js";

function ensureMongo(reply: any): boolean {
    if (getMongoStatus() !== "connected") {
        reply.status(503).send({ error: "Base de datos no disponible" });
        return false;
    }
    return true;
}

export async function registerBookDraftRoutes(app: FastifyInstance) {
    app.get("/book-drafts", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { nicheId } = request.query ?? {};
            const filter: any = {};
            if (nicheId) filter.nicheId = nicheId;
            const drafts = await BookDraft.find(filter).sort({ savedAt: -1 }).lean();
            return reply.send({ drafts });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.post("/book-drafts", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const body = request.body ?? {};
            const draft = await BookDraft.create({
                nicheId: body.nicheId ?? undefined,
                fileName: body.fileName ?? "libro-kdp",
                pages: body.pages ?? [],
                pdfUrl: body.pdfUrl ?? undefined,
                pageCount: body.pageCount ?? (body.pages?.length ?? 0),
                savedAt: body.savedAt ? new Date(body.savedAt) : new Date(),
            });
            return reply.status(201).send({ draft });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.patch("/book-drafts/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const body = request.body ?? {};
            const update: any = { savedAt: new Date() };
            if (body.fileName !== undefined) update.fileName = body.fileName;
            if (body.pages !== undefined) { update.pages = body.pages; update.pageCount = body.pages.length; }
            if (body.pdfUrl !== undefined) update.pdfUrl = body.pdfUrl;
            if (body.nicheId !== undefined) update.nicheId = body.nicheId;
            const draft = await BookDraft.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' });
            if (!draft) return reply.status(404).send({ error: "Draft no encontrado" });
            return reply.send({ draft });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });

    app.delete("/book-drafts/:id", async (request: any, reply) => {
        if (!ensureMongo(reply)) return;
        try {
            const { id } = request.params as { id: string };
            const result = await BookDraft.findByIdAndDelete(id);
            if (!result) return reply.status(404).send({ error: "Draft no encontrado" });
            return reply.send({ ok: true });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
