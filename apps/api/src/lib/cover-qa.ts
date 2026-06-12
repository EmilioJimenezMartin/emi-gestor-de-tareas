/**
 * QA de portadas: contraste y saturación globales.
 * Las portadas oscuras o lavadas mueren en el thumbnail de Amazon (~1 cm² en móvil).
 * No bloquea la generación — puntúa candidatas para elegir la mejor y avisar.
 */
import sharp from "sharp";

export interface CoverQA {
    ok: boolean;
    /** desviación típica de luminancia 0-128 — <35 = plana/apagada */
    contrast: number;
    /** saturación media 0-1 — <0.12 = lavada */
    saturation: number;
    /** luminancia media 0-255 */
    brightness: number;
    warnings: string[];
}

export async function analyzeCoverQuality(buffer: Buffer): Promise<CoverQA> {
    try {
        // 64×64 es suficiente para métricas globales y es casi instantáneo
        const raw = await sharp(buffer).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer();
        let sum = 0, sumSq = 0, satSum = 0;
        const n = raw.length / 3;
        for (let i = 0; i < raw.length; i += 3) {
            const r = raw[i], g = raw[i + 1], b = raw[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            sum += lum;
            sumSq += lum * lum;
            const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
            satSum += maxC > 0 ? (maxC - minC) / maxC : 0;
        }
        const brightness = sum / n;
        const contrast = Math.sqrt(Math.max(0, sumSq / n - brightness * brightness));
        const saturation = satSum / n;

        const warnings: string[] = [];
        if (contrast < 35) warnings.push(`contraste bajo (${contrast.toFixed(0)} — mín. recomendado 35)`);
        if (saturation < 0.12) warnings.push(`colores lavados (saturación ${(saturation * 100).toFixed(0)}%)`);
        if (brightness < 60) warnings.push(`demasiado oscura (brillo ${brightness.toFixed(0)}/255) — invisible en thumbnail`);
        if (brightness > 230) warnings.push(`demasiado clara (brillo ${brightness.toFixed(0)}/255) — se funde con el fondo blanco de Amazon`);

        return { ok: warnings.length === 0, contrast, saturation, brightness, warnings };
    } catch {
        return { ok: true, contrast: 0, saturation: 0, brightness: 0, warnings: [] }; // QA falló → no bloquear
    }
}
