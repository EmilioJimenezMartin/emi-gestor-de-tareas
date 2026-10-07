// Diccionarios de variables del dominio KDP expuestos por el MCP. Son la fuente
// de verdad de lo que el modelo puede mandar en cada parámetro: los esquemas
// de las tools (mcp/server.ts) validan contra estos valores y la tool
// `obtener_diccionario` los devuelve con su descripción.
// Los valores de enum deben coincidir con models/niche.ts y models/catalog.ts.

import { FREE_COMMUNITY_COLORING_TEMPLATE } from "../lib/coloring-book-subject.js";

export const NICHE_STATUS = {
    found: "Recién detectado, sin validar",
    research: "En investigación de mercado",
    active: "Validado y en producción",
    archived: "Aparcado, no se trabaja",
    discarded: "Descartado (no aparece en los listados)",
} as const;

export const LEVEL = {
    unknown: "Sin medir",
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
} as const;

export const PRODUCT_TYPE = {
    "coloring-book": "Libro de colorear para KDP: páginas de contorno negro sobre blanco",
    "printable-poster": "Póster imprimible a color (Etsy/Gelato)",
    "seamless-pattern": "Patrón repetible sin costuras",
    other: "Otro producto digital",
} as const;

export const STYLE_CATEGORY = {
    generic: "Sin estilo marcado",
    funko: "Figura cabezona tipo coleccionable",
    anime: "Anime / manga",
    illustration: "Ilustración editorial",
    children: "Infantil, formas grandes y simples",
    realistic: "Realista detallado",
    watercolor: "Acuarela",
    abstract: "Abstracto",
    "wall-art": "Decoración de pared",
    botanical: "Botánico",
    affirmation: "Frases y afirmaciones",
    geometric: "Geométrico / mandala",
    celestial: "Celestial / místico",
    retro: "Retro / vintage",
} as const;

export const PHASE = {
    niche: "Solo existe el nicho",
    catalog: "Tiene catálogos de imágenes",
    libro: "Tiene el PDF interior montado",
    seo: "Tiene listing SEO",
    cover: "Tiene portada",
    published: "Publicado",
} as const;

/** Qué debe tener un nicho para estar en cada fase. avanzar_fase lo comprueba salvo forzar=true. */
export const PHASE_REQUIREMENTS = {
    niche: "Nada: es la fase inicial",
    catalog: "Al menos un catálogo de imágenes (lanzar_catalogo)",
    libro: "PDF interior montado (se hace en la web, no desde el MCP)",
    seo: "Al menos un listing SEO (generar_seo o guardar_seo)",
    cover: "Portada generada (se hace en la web, no desde el MCP)",
    published: "ASIN informado en el nicho (actualizar_nicho) tras publicar a mano en KDP",
} as const;

export const LIFECYCLE_STAGE = {
    "pre-published": "Subido pero aún no a la venta",
    published: "A la venta",
    "end-of-life": "Retirado o sin ventas",
} as const;

export const TARGET_AUDIENCE = {
    children: "Niños",
    teens: "Adolescentes",
    adults: "Adultos",
    all: "Todos los públicos",
} as const;

export const CATALOG_STATUS = {
    queued: "En cola, esperando hueco",
    pending: "A punto de empezar",
    running: "Generando imágenes",
    completed: "Terminado",
    failed: "Falló",
    cancelled: "Cancelado",
} as const;

export const LISTING_LANGUAGE = {
    en: "Inglés (amazon.com)",
    es: "Español (amazon.es)",
} as const;

/**
 * Modelos de imagen que el MCP puede pedir. `clave` es lo que manda el modelo;
 * el resto es el objeto aiModel que esperan /catalogs y /ai/generate-image.
 * Reglas por proveedor en routes/IMAGE_PROVIDERS.md.
 */
export const IMAGE_MODELS = {
    "flux2-dev-free": {
        id: "pollinations-flux2-dev-free",
        name: "FLUX.2 Dev Free (sin límite)",
        provider: "Pollinations",
        modelId: "scriptsnsenses-sys/flux-2-dev-free",
        nota: "0 pollen con key. Contorno limpio. Salida fija 1024x1024, máx 3 simultáneas, 8 por minuto.",
    },
    "sdxl-lightning-free": {
        id: "pollinations-sdxl-lightning-free",
        name: "SDXL Lightning Free (sin límite)",
        provider: "Pollinations",
        modelId: "scriptsnsenses-sys/sdxl-lightning-free",
        nota: "0 pollen con key. Más detalle y más relleno negro que flux2-dev-free. Salida fija 1024x1024.",
    },
    "pollinations-flux": {
        id: "pollinations-flux",
        name: "FLUX Schnell (Pollinations)",
        provider: "Pollinations",
        modelId: "flux",
        nota: "Gasta pollen (0.002 por imagen). Rápido.",
    },
    "cloudflare-flux": {
        id: "cf-flux-schnell",
        name: "FLUX Schnell (Cloudflare)",
        provider: "Cloudflare",
        modelId: "@cf/black-forest-labs/flux-1-schnell",
        nota: "Cuota diaria gratuita de Workers AI. Pierde el sujeto en escenas de muchos elementos.",
    },
} as const;

export type ImageModelKey = keyof typeof IMAGE_MODELS;

/** Límites que las rutas aplican por su cuenta; se repiten aquí para que el modelo no los descubra a base de errores. */
export const LIMITS = {
    catalogo_imagenes: { min: 1, max: 20, defecto: 5 },
    explotar_catalogos: { min: 2, max: 20, defecto: 5 },
    kdp_keywords: { cantidad: 7, max_caracteres: 50 },
    kdp_titulo_mas_subtitulo_max_caracteres: 200,
} as const;

/** Cómo encadenar las tools para cada objetivo. */
export const METHODS = {
    proponer_nicho: [
        "tendencias → señales de mercado ya cacheadas",
        "escanear_mercado con 2-4 keywords candidatas en inglés → competencia y demanda reales",
        "listar_nichos → no repetir lo que ya existe",
        "crear_nicho con la mejor candidata (puntuar=true para guardar score)",
    ],
    ponerse_al_dia: [
        "resumen_general → cuántos nichos hay por fase, qué está en cola y qué nichos están atascados",
        "ver_nicho en los que interesen → campo falta dice qué le queda a cada uno",
    ],
    producir_libro: [
        "ver_nicho → comprobar fase y qué falta",
        "lanzar_catalogo modo=rapido para la primera tanda, modo=explotar para variar escenas",
        "listar_catalogos / estado_pipeline → seguir el progreso (la generación es asíncrona)",
        "generar_seo o guardar_seo cuando el nicho tenga catálogos",
        "avanzar_fase cuando el nicho cumpla los requisitos de la siguiente (ver requisitos_fase)",
        "marcar_seo_aplicado cuando el usuario confirme que pegó ese listing en KDP",
    ],
    informe: [
        "informe_ventas → regalías y unidades por periodo (solo hay lo importado por CSV)",
        "informe_actividad → nichos, catálogos e imágenes por día",
        "rastrear_seo en los nichos con ASIN → posición actual en Amazon",
    ],
    parar: ["cancelar_catalogo para uno concreto", "parada_emergencia para detener autopilot y toda la cola"],
} as const;

export const DICTIONARY = {
    estado_nicho: NICHE_STATUS,
    nivel: LEVEL,
    tipo_producto: PRODUCT_TYPE,
    estilo: STYLE_CATEGORY,
    fase: PHASE,
    requisitos_fase: PHASE_REQUIREMENTS,
    ciclo_de_vida: LIFECYCLE_STAGE,
    publico: TARGET_AUDIENCE,
    estado_catalogo: CATALOG_STATUS,
    idioma_listing: LISTING_LANGUAGE,
    modelos_imagen: IMAGE_MODELS,
    prompt_por_defecto_modelos_sin_limite: FREE_COMMUNITY_COLORING_TEMPLATE,
    limites: LIMITS,
    metodos: METHODS,
} as const;

export const keysOf = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
