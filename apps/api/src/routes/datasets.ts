import type { FastifyInstance } from "fastify";
import { Settings } from "../models/settings.js";

async function getSetting(key: string): Promise<string> {
    const s = await Settings.findOne({ key }).lean();
    return (s as any)?.value ?? "";
}

async function hfCreateRepo(token: string, repoName: string, isPrivate: boolean) {
    const res = await fetch("https://huggingface.co/api/repos/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dataset", name: repoName, private: isPrivate }),
    });
    // 409 = repo already exists, that's fine
    if (!res.ok && res.status !== 409) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `Error creando repositorio en HF (${res.status})`);
    }
}

async function hfCommitFiles(
    token: string,
    username: string,
    repoName: string,
    files: Array<{ path: string; content: string }>,
    summary: string
) {
    const lines = [
        JSON.stringify({ summary }),
        ...files.map(f => JSON.stringify({ type: "file", path: f.path, encoding: "utf-8", content: f.content })),
    ].join("\n");

    const res = await fetch(
        `https://huggingface.co/api/datasets/${username}/${repoName}/commit/main`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
            body: lines,
        }
    );
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? `Error subiendo archivos a HuggingFace (${res.status})`);
    }
}

async function kaggleBlobUpload(auth: string, name: string, content: string): Promise<string> {
    const buf = Buffer.from(content, "utf-8");
    const blobRes = await fetch("https://www.kaggle.com/api/v1/blobs/upload", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            contentLength: buf.length,
            lastModifiedEpochSeconds: Math.floor(Date.now() / 1000),
        }),
    });
    if (!blobRes.ok) {
        const err = await blobRes.json().catch(() => ({}));
        throw new Error((err as any).message ?? `Error preparando blob en Kaggle: ${name}`);
    }
    const { createUrl, token: blobToken } = (await blobRes.json()) as any;
    const putRes = await fetch(createUrl as string, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
    });
    if (!putRes.ok) throw new Error(`Error subiendo archivo a Kaggle GCS: ${name}`);
    return blobToken as string;
}

export async function registerDatasetRoutes(app: FastifyInstance) {

    // GET /datasets/settings — check HF + Kaggle config status
    app.get("/datasets/settings", async (_request, reply) => {
        const hfToken    = await getSetting("HUGGINGFACE_WRITE_TOKEN");
        const hfUsername = await getSetting("HUGGINGFACE_USERNAME");
        const kaggleUser = await getSetting("KAGGLE_USERNAME");
        const kaggleKey  = await getSetting("KAGGLE_KEY");
        return reply.send({
            hf:     { configured: !!(hfToken && hfUsername),  username: hfUsername },
            kaggle: { configured: !!(kaggleUser && kaggleKey), username: kaggleUser },
        });
    });

    // POST /datasets/hf-upload
    // Body: { repoName, isPrivate, files: [{ path, content }] }
    app.post("/datasets/hf-upload", async (request: any, reply) => {
        try {
            const { repoName, isPrivate = false, files } = request.body ?? {};
            if (!repoName || !Array.isArray(files) || files.length === 0) {
                return reply.status(400).send({ error: "repoName y files son requeridos" });
            }

            const token    = await getSetting("HUGGINGFACE_WRITE_TOKEN");
            const username = await getSetting("HUGGINGFACE_USERNAME");
            if (!token || !username) {
                return reply.status(503).send({
                    error: "Configura HUGGINGFACE_WRITE_TOKEN y HUGGINGFACE_USERNAME en Ajustes",
                });
            }

            await hfCreateRepo(token, repoName, isPrivate);
            await hfCommitFiles(token, username, repoName, files, "Upload from DataRefinery");

            return reply.send({
                success: true,
                url: `https://huggingface.co/datasets/${username}/${repoName}`,
            });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error subiendo a HuggingFace Hub" });
        }
    });

    // POST /datasets/kaggle-upload
    // Body: { title, slug, description, isPrivate, license, files: [{ path, content }] }
    app.post("/datasets/kaggle-upload", async (request: any, reply) => {
        try {
            const {
                title,
                slug,
                description = "",
                isPrivate = true,
                license = "CC0-1.0",
                files,
            } = request.body ?? {};

            if (!title || !slug || !Array.isArray(files) || files.length === 0) {
                return reply.status(400).send({ error: "title, slug y files son requeridos" });
            }

            const kaggleUsername = await getSetting("KAGGLE_USERNAME");
            const kaggleKey      = await getSetting("KAGGLE_KEY");
            if (!kaggleUsername || !kaggleKey) {
                return reply.status(503).send({
                    error: "Configura KAGGLE_USERNAME y KAGGLE_KEY en Ajustes",
                });
            }

            const auth    = "Basic " + Buffer.from(`${kaggleUsername}:${kaggleKey}`).toString("base64");
            const apiBase = "https://www.kaggle.com/api/v1";
            const hdr     = { Authorization: auth, "Content-Type": "application/json" };

            // Upload all blobs sequentially
            const tokens: Array<{ token: string }> = [];
            for (const file of files as Array<{ path: string; content: string }>) {
                const t = await kaggleBlobUpload(auth, file.path, file.content);
                tokens.push({ token: t });
            }

            // Check if dataset already exists (create new version if so)
            const checkRes = await fetch(`${apiBase}/datasets/${kaggleUsername}/${slug}`, { headers: hdr });

            if (checkRes.status === 404) {
                const createRes = await fetch(`${apiBase}/datasets/create/new`, {
                    method: "POST",
                    headers: hdr,
                    body: JSON.stringify({
                        title,
                        slug,
                        ownerSlug: kaggleUsername,
                        licenseName: license,
                        description,
                        isPrivate,
                        files: tokens,
                    }),
                });
                if (!createRes.ok) {
                    const err = await createRes.json().catch(() => ({}));
                    throw new Error((err as any).message ?? "Error creando dataset en Kaggle");
                }
            } else {
                const vRes = await fetch(
                    `${apiBase}/datasets/create/version/${kaggleUsername}/${slug}`,
                    {
                        method: "POST",
                        headers: hdr,
                        body: JSON.stringify({ versionNotes: "Updated via DataRefinery", files: tokens }),
                    }
                );
                if (!vRes.ok) {
                    const err = await vRes.json().catch(() => ({}));
                    throw new Error((err as any).message ?? "Error actualizando dataset en Kaggle");
                }
            }

            return reply.send({
                success: true,
                url: `https://www.kaggle.com/datasets/${kaggleUsername}/${slug}`,
            });
        } catch (err: any) {
            return reply.status(500).send({ error: err.message ?? "Error subiendo a Kaggle" });
        }
    });
}
