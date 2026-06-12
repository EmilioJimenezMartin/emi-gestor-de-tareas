/**
 * Limpieza de almacenamiento Cloudinary — corre a diario.
 * Dos fuentes de crecimiento silencioso:
 *   1. Vault de rechazadas (emi-kdp-rejected): cada rechazo del QA sube una imagen
 *      que nadie borra. Se purgan las pendientes con > 14 días.
 *   2. Catálogos cancelados (> 30 días): tiradas fallidas que el usuario nunca va
 *      a retomar — se borran sus imágenes de Cloudinary y el doc de Mongo.
 * Acotado: borra como máximo 200 assets por ejecución (sin bucles infinitos).
 */
import type { Agenda, Job } from "agenda";
import { Catalog } from "../models/catalog.js";
import { getCloudinaryConfig, initCloudinary } from "../routes/cloudinary.js";

export const STORAGE_CLEANUP_JOB_NAME = "storage-cleanup";
const MAX_DELETES_PER_RUN = 200;
const REJECTED_TTL_DAYS = 14;
const CANCELLED_TTL_DAYS = 30;

export function defineStorageCleanupJob(agenda: Agenda, io?: any) {
    agenda.define(STORAGE_CLEANUP_JOB_NAME, async (_job: Job) => {
        const config = await getCloudinaryConfig();
        if (!config) {
            console.log("[storage-cleanup] Cloudinary no configurado — skip");
            return;
        }
        const cld = await initCloudinary(config);
        let deleted = 0;

        // ── 1. Vault de rechazadas caducadas ──
        try {
            const { RejectedImage } = await import("../models/rejected-image.js");
            const cutoff = new Date(Date.now() - REJECTED_TTL_DAYS * 24 * 3600 * 1000);
            const stale = await RejectedImage.find({
                reviewStatus: "pending",
                createdAt: { $lt: cutoff },
            }).limit(MAX_DELETES_PER_RUN).lean();

            for (const r of stale as any[]) {
                if (deleted >= MAX_DELETES_PER_RUN) break;
                if (r.publicId) {
                    await cld.uploader.destroy(r.publicId).catch(() => {});
                    deleted++;
                }
                await RejectedImage.findByIdAndDelete(r._id);
            }
            if (stale.length > 0) console.log(`[storage-cleanup] Vault: ${stale.length} rechazadas caducadas (> ${REJECTED_TTL_DAYS}d) eliminadas`);
        } catch (e: any) {
            console.warn(`[storage-cleanup] Vault cleanup falló: ${e?.message}`);
        }

        // ── 2. Catálogos cancelados antiguos ──
        try {
            const cutoff = new Date(Date.now() - CANCELLED_TTL_DAYS * 24 * 3600 * 1000);
            const old = await Catalog.find({
                status: "cancelled",
                updatedAt: { $lt: cutoff },
            }).limit(20).lean();

            for (const cat of old as any[]) {
                if (deleted >= MAX_DELETES_PER_RUN) break;
                const publicIds: string[] = (cat.images ?? []).map((i: any) => i.publicId).filter(Boolean);
                // delete_resources admite máx 100 por llamada
                for (let i = 0; i < publicIds.length; i += 100) {
                    await cld.api.delete_resources(publicIds.slice(i, i + 100), { type: "upload" }).catch(() => {});
                }
                deleted += publicIds.length;
                await Catalog.findByIdAndDelete(cat._id);
                console.log(`[storage-cleanup] Catálogo cancelado "${cat.name}" (${publicIds.length} imgs) purgado`);
            }
            if (old.length > 0) io?.emit("catalogs:updated");
        } catch (e: any) {
            console.warn(`[storage-cleanup] Catálogos cancelados cleanup falló: ${e?.message}`);
        }

        console.log(`[storage-cleanup] Hecho — ${deleted} assets eliminados de Cloudinary`);
    });
}

export async function scheduleStorageCleanup(agenda: Agenda): Promise<void> {
    // Diario a las 5:00 — antes de los jobs de negocio
    await agenda.every("0 5 * * *", STORAGE_CLEANUP_JOB_NAME);
}
