import { FastifyInstance } from "fastify";
import { createRequire } from "module";
import axios from "axios";
import { PassThrough, Readable } from "stream";

const require = createRequire(import.meta.url);
// archiver is CJS-only; load it via require in this ESM context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiver = require("archiver") as (format: string, opts?: any) => import("archiver").Archiver;

export async function registerZipRoutes(app: FastifyInstance) {
    // POST /zip/download — fetch a list of image URLs and return them as a .zip
    app.post("/zip/download", async (request: any, reply) => {
        const { images, name } = request.body || {};
        if (!Array.isArray(images) || images.length === 0) {
            return reply.status(400).send({ error: "images array required" });
        }

        const zipName = (name?.trim() || "imagenes") + ".zip";

        reply.raw.setHeader("Content-Type", "application/zip");
        reply.raw.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(zipName)}"`);
        reply.raw.setHeader("Transfer-Encoding", "chunked");

        const archive = archiver("zip", { zlib: { level: 5 } });
        const passThrough = new PassThrough();
        archive.pipe(passThrough);
        passThrough.pipe(reply.raw);

        for (const item of images as { url: string; filename: string }[]) {
            try {
                const res = await axios.get(item.url, { responseType: "stream", timeout: 20000 });
                archive.append(res.data as Readable, { name: item.filename });
            } catch (e) {
                app.log.warn(e, `Could not fetch image: ${item.url}`);
            }
        }

        await archive.finalize();
        return reply;
    });
}
