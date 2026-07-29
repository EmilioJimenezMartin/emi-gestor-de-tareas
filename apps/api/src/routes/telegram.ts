import { FastifyInstance } from "fastify";
import { sendTelegramPhoto } from "../lib/telegram.js";

export async function registerTelegramRoutes(app: FastifyInstance) {
    // POST /telegram/send-photo — plain image send, no inline keyboard/buttons.
    // Used by the image lightbox "Enviar a Telegram" CTA.
    app.post("/telegram/send-photo", async (request: any, reply) => {
        try {
            const { imageUrl, caption } = request.body ?? {};
            if (!imageUrl || typeof imageUrl !== "string") {
                return reply.status(400).send({ error: "imageUrl es obligatorio" });
            }
            const messageId = await sendTelegramPhoto(imageUrl, typeof caption === "string" ? caption : "");
            if (!messageId) return reply.status(502).send({ error: "Telegram no configurado o el envío falló" });
            return reply.send({ ok: true, messageId });
        } catch (e: any) {
            return reply.status(500).send({ error: e.message });
        }
    });
}
