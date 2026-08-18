# Proveedores de generación de imagen — contexto y reglas por proveedor

Este documento existe porque el 2026-08-14 se rompió la fidelidad al prompt en
Cloudflare (flux-1-schnell): con la fórmula completa de coloring-book (~350
palabras) el modelo ignoraba el sujeto pedido por completo y alucinaba otro
(un loro, luego un gallo, pidiendo un jardín japonés con puente y templo). Se
verificó con generaciones reales, no con suposiciones. La causa NO era el
orden del prompt (se probó y no bastó) sino la LONGITUD total — es un modelo
"schnell" (distillado, optimizado para velocidad) con una ventana de atención
efectiva corta. Ver el fix en `routes/ai.ts`, rama `provider === "Cloudflare"`.

**Actualización — el fix de longitud REDUCE el problema, no lo elimina.**
Con un sujeto corto (3 elementos: puente + estanque + templo) el prompt
acortado dio el resultado correcto en la prueba real. Con un sujeto más
complejo (7 elementos: estanque + puente + farolillo de piedra + árboles +
flores + arbustos + vegetación) el MISMO prompt acortado, con el mismo fix
activo, volvió a fallar (dibujó un pájaro/mariposa). Conclusión: flux-1-schnell
en Cloudflare es **probabilístico, no determinista**, para escenas con varios
elementos — acortar y poner el sujeto al frente mejora la tasa de acierto pero
NO la garantiza al 100%. No hay ningún prompt que "arregle" esto de forma
fiable; es una limitación del modelo, no de nuestro código.
**Por eso la única forma real de garantizar fidelidad es verificar la imagen
generada (visión) contra el sujeto pedido, y reintentar si no coincide — igual
que ya se hace con `runQualityCheck` en `jobs/catalog.ts` para relleno
gris/color/líneas, pero comprobando SUJETO, no solo píxeles.** Ese check de
calidad actual no detecta esto: una imagen de un pájaro en blanco y negro con
líneas limpias PASA el control de calidad (nada gris, nada de color, buenas
líneas) aunque el sujeto esté completamente equivocado — el pipeline no tiene
ninguna verificación de contenido, solo de estilo/pixeles. Se implementó un
gate de visión para esto — ver sección al final de este documento.

## Rollout completo a "toda la familia schnell" (2026-08-14, tarde)

El fix inicial solo se aplicó a la rama `provider === "Cloudflare"` de
`routes/ai.ts`. Ese mismo día, más tarde, saltó el mismo bug en un sitio
completamente distinto: **Clone Engine** (`routes/niches.ts` →
`/niches/clone-telegram`, la imagen de descubrimiento que se manda a Telegram
para aprobar un nicho) — ese código llama a Pollinations **directamente**
(sin pasar por `routes/ai.ts` ni por `lib/image-gen.ts`), con la fórmula
completa sin acortar. Se verificó con una prueba real cruzada (mismo prompt,
sin relación con pájaros) que **Pollinations y SiliconFlow también dibujan un
pájaro** con la fórmula completa — el problema nunca fue exclusivo de
Cloudflare, es de cualquier modelo "schnell" que reciba el prompt sin acortar.

**Consecuencia de diseño:** la lógica de "extraer sujeto + destilarlo con IA +
montar un prompt corto" se sacó de `routes/ai.ts` y se centralizó en
`lib/coloring-book-subject.ts` → `buildDistilledSchnellPrompt(prompt)`, y se
aplicó en **todos** los sitios que mandan un prompt a un modelo "schnell":

- `routes/ai.ts` — ramas Cloudflare, Pollinations (la real, no la de
  fallback-por-402-de-Together), SiliconFlow, Segmind, Hugging Face,
  Together AI, **fal.ai** (su modelo por defecto es `fal-ai/flux/schnell` —
  no estaba ni documentado en este archivo hasta ahora).
- `lib/image-gen.ts` — Pollinations, Cloudflare, SiliconFlow, Segmind,
  Hugging Face (toda la cadena de fallback usada por autopilot/Telegram).
- `routes/niches.ts` — la llamada directa a Pollinations de
  `/niches/clone-telegram` (Clone Engine).

**Ojo con `routes/ai.ts`: hay DOS bloques de Pollinations.** Uno es la rama
real y principal (`if (provider === "Pollinations" && ...)`, ~línea 773,
comentario "explicit, passes model param"). El otro es
`if ((provider === "Together AI" || provider === "Pollinations") && apiKey)`
(~línea 731), que en realidad es el fallback de Together AI para cuando
Pollinations devuelve 402 — solo se activa si hay `TOGETHER_API_KEY`
configurada. La primera vez que se aplicó este fix, se editó SOLO el segundo
bloque por error (parecía el sitio correcto por el nombre del proveedor en la
condición) y una prueba real con Pollinations siguió fallando — hay que
tocar los dos si se vuelve a tocar esta zona del archivo.

**No se aplicó** (a propósito) a: Dezgo, Tensor.art, Leonardo, Ideogram,
Google, Stable Horde — proveedores SDXL/completos que toleran la fórmula
larga y soportan `negative_prompt` de verdad (ver tabla arriba). Aplicar el
acortado ahí no está probado que ayude y sí podría regresar la fórmula que
ya funciona para ellos.

**Verificado con pruebas reales tras el rollout completo:**
- Pollinations, prompt "a cozy mountain cabin in autumn" → antes: pájaro:
  después del fix del bloque correcto: cabaña de montaña correcta.
- Cloudflare, prompt real de un catálogo cancelado por el usuario (jardín +
  puente + estanque + farolillo de piedra) → correcto tras destilar.
- SiliconFlow — fix aplicado y typecheck limpio, pero la verificación final
  en vivo dio 503 (probable rate-limit de SiliconFlow por volumen de pruebas
  ese mismo día, no un fallo del fix — su primera prueba, antes del fix, sí
  había completado y mostrado el pájaro).

## Regla de oro — leer antes de tocar cualquier construcción de prompt

1. **No hay una fórmula universal segura para todos los proveedores.** Cada
   uno tiene su propio límite de longitud, su propio soporte (o no) de
   `negative_prompt`, y sus propias manías. Ver tabla abajo antes de asumir
   que un cambio que funciona en un proveedor funciona en todos.
2. **Verifica con una generación real, no con typecheck ni con lectura de
   código.** Haz una llamada real a `POST /ai/generate-image` con un sujeto
   específico y reconocible (3+ elementos distintos, ej. "puente de madera +
   estanque + templo") y abre la imagen resultante. Un prompt genérico donde
   cualquier salida "parece válida" no sirve para detectar pérdida de
   fidelidad.
3. **Si tocas `buildColoringBookPrompt` / `buildPosterPrompt` /
   `buildSeamlessPatternPrompt` en `autopilot.ts`**, recuerda que esa fórmula
   alimenta DOS flujos independientes:
   - `routes/ai.ts` → `POST /ai/generate-image` → usado por el AI Studio
     manual y por la creación de catálogos (`jobs/catalog.ts`).
   - `lib/image-gen.ts` → `generateImage()` → usado por el autopilot y por
     Telegram (crítico, no romper — ver memoria del proyecto).
   Estos dos archivos tienen implementaciones de Cloudflare **separadas y
   duplicadas**. Un fix en una no se aplica automáticamente a la otra.
4. **Sospecha primero de la longitud del prompt** si el proveedor es un
   modelo "schnell" (ver tabla) y el sujeto se pierde — no del orden, no del
   seed, no de random noise.

## Resumen por proveedor

### Cloudflare Workers AI — `@cf/black-forest-labs/flux-1-schnell`
- Código: `routes/ai.ts` (rama `"Cloudflare"`), y por separado en
  `lib/image-gen.ts` (usada por autopilot/Telegram).
- **Verificado (2026-08-14):** con la fórmula completa de coloring-book
  (~350 palabras) el modelo ignora el sujeto y alucina otro. Con un prompt
  corto (~40-60 palabras) y el sujeto al frente, es fiel.
- **No soporta `negative_prompt`** (confirmado — se ignora en silencio).
  Todas las exclusiones de estilo tienen que ir en el prompt positivo, lo
  que agrava el problema de longitud en este proveedor en concreto.
- `steps`: usar siempre 8 (el máximo real del modelo). Con 4 se pierde
  composición/detalle además de fidelidad.
- **Fix aplicado en `routes/ai.ts`:** en esta rama ya NO se manda
  `buildColoringBookPrompt` completo. Se extrae el sujeto real usando los
  marcadores exportados `CB_FIDELITY` / `CB_ANATOMY` (de `autopilot.ts`) y se
  monta un prompt corto propio con solo las reglas de estilo esenciales.
- ⚠️ **`lib/image-gen.ts` tiene su PROPIA llamada a Cloudflare** (la que usa
  Telegram/autopilot) y **no tiene este fix**. No se tocó a propósito para no
  arriesgar el flujo de Telegram sin verificar antes. Si se reproduce el
  mismo síntoma ahí, aplicar la misma estrategia — pero verificar con
  generación real primero (y confirmar que las imágenes le siguen llegando a
  Telegram después).

### Pollinations (gateway `gen.pollinations.ai`)
- Código: `lib/pollinations-circuit.ts` (`capPollinationsPrompt`) — se aplica
  a TODOS los llamadores automáticamente, no hace falta nada por proveedor.
- Cap duro: ~460 tokens estimados (calibrado contra el T5 real de Fireworks).
  Trunca **cláusulas completas desde el final** — por eso `CB_STYLE_EXCLUSIONS`
  se colocó pronto en la fórmula de `autopilot.ts`: si quedara al final, era
  lo primero que se perdía (de ahí los rechazos por "rellenos grises" en su
  momento).
- El endpoint viejo sin key (`image.pollinations.ai` directo) responde 200
  pero IGNORA las restricciones de estilo del prompt (coloring book, sin
  color, fondo blanco) — no reintroducir sin verificar visualmente la salida.

### Leonardo.AI
- Límite duro de la API: 1500 caracteres (rechaza con 400 por encima). Se
  recorta a 1480 por cláusulas desde el final, mismo patrón que Pollinations.
- Soporta `negative_prompt` real de verdad — si se retoca este proveedor,
  usarlo para exclusiones en vez de inflar el prompt positivo.
- Requiere seed explícito o repite la misma imagen para el mismo prompt.

### SiliconFlow (FLUX.1-schnell)
- Mismo modelo base "schnell" que Cloudflare, pero vía su propia API.
  Soporta `negative_prompt`. `num_inference_steps: 20` (bastante más margen
  que Cloudflare).
- No hay reporte de pérdida de sujeto con la fórmula larga, pero **no está
  verificado** — al ser también un modelo distillado, no descartar el mismo
  problema si aparece un caso similar. No asumir que está "a salvo" solo
  porque no se ha quejado nadie todavía.

### Segmind (FLUX.1-schnell)
- Soporta `negative_prompt`. `steps: 4` en el fallback de `image-gen.ts` —
  mismo riesgo potencial que Cloudflare (schnell + pocos steps), tampoco
  verificado.

### Dezgo (SDXL)
- SDXL real, no distillado. 25 steps, soporta `negative_prompt` — tolera
  prompts largos mejor que los "schnell" en general.

### Tensor.art (SDXL + LoRA)
- Soporta `negativePrompts` real, hasta 60 steps, `clipSkip: 2` — el más
  tolerante a prompts largos de todo el set.

### Hugging Face (router inference, modelo configurable, default FLUX.1-schnell)
- Soporta `negative_prompt` vía `parameters`. El modelo por defecto vuelve a
  ser "schnell" — mismo riesgo no verificado que SiliconFlow/Segmind.
- Reintentos automáticos en 503/429.

### Google Gemini (imagen)
- Modelo multimodal grande, sin límite de prompt conocido ni problemas de
  fidelidad reportados.

### Ideogram
- Soporta `negative_prompt` y su propio parámetro `style` (`ideogramStyle`).
  Sin límite de longitud documentado en el código.

### Stable Horde
- Backend crowd-sourced (workers de la comunidad) — `negative_prompt` se
  concatena con `###`. El modelo real que responde varía por worker, así que
  la fidelidad es inherentemente menos predecible que el resto. No hay nada
  que "arreglar" en nuestro código aquí — es una limitación del proveedor,
  no tratar un resultado raro de Horde como si fuera el mismo bug que
  Cloudflare.

### Together AI (FLUX.1-schnell-Free)
- Mismo modelo "schnell" que Cloudflare, `steps` fijo a 4. Es el candidato
  más probable a tener el MISMO bug de pérdida de sujeto con prompts largos.
  No verificado — probablemente no se ha reportado porque se usa menos, no
  porque esté libre del problema.

## Patrón general observado

Los proveedores que fallan (o son sospechosos de fallar) en fidelidad al
prompt son todos modelos **"schnell"/distillados** — Cloudflare, SiliconFlow,
Segmind, Hugging Face (con el modelo por defecto), Together AI. Están
optimizados para velocidad a costa de adherencia al prompt, y encima ninguno
de ellos soporta bien `negative_prompt` (Cloudflare directamente lo ignora),
así que las +200 palabras de exclusiones de estilo de
`buildColoringBookPrompt` se comen el presupuesto de atención que necesitaría
el sujeto real. Los modelos SDXL "completos" (Dezgo, Tensor.art, Leonardo)
toleran mejor la fórmula larga porque sí usan `negative_prompt` de verdad.

**Confirmado (2026-08-14) con prueba real cruzada:** el "atractor pájaro" no es
exclusivo de Cloudflare. Se probó el mismo prompt sin relación con aves ("a
cozy mountain cabin in autumn") con la fórmula completa SIN modificar en
Pollinations y en SiliconFlow — las dos dibujaron un pájaro. Es decir, el
problema de fondo (la fórmula de ~350 palabras satura la atención del modelo
y este cae en el sujeto más frecuente de su dataset de coloring books) afecta
a proveedores más allá de Cloudflare, no solo a los "schnell" declarados. Por
eso el gate de visión (ver más abajo) se aplica de forma universal a TODOS
los proveedores en `jobs/catalog.ts`, no solo a Cloudflare — es la única
defensa que generaliza, porque acortar el prompt provider por provider no
escala y ya ha demostrado no ser suficiente incluso donde se aplicó.

## Checklist antes de dar por cerrado un cambio en construcción de prompt

1. Identifica qué proveedor(es) toca el cambio.
2. Si toca una fórmula compartida (`autopilot.ts`), comprueba **los dos**
   flujos: `routes/ai.ts` (manual/catálogos) y `lib/image-gen.ts`
   (autopilot/Telegram) — no asumas que arreglar uno arregla el otro.
3. Haz una llamada real a `POST /ai/generate-image` con el proveedor
   afectado y un sujeto específico de 3+ elementos reconocibles.
4. Abre la imagen resultante y confirma visualmente que el sujeto pedido
   está presente — un HTTP 200 no significa que el prompt se respetó.
5. Si el proveedor es "schnell" (ver tabla), sospecha primero de la
   LONGITUD del prompt antes que de cualquier otra causa.
6. Aceptar que para modelos "schnell" (Cloudflare, SiliconFlow, Segmind, HF
   por defecto, Together AI) NINGÚN prompt garantiza el sujeto al 100% — son
   probabilísticos. Una sola prueba en verde no es prueba de que está
   arreglado; probarlo con un sujeto de varios elementos y, si se puede,
   más de una vez.

## Verificación de sujeto por visión (implementado 2026-08-14)

`jobs/catalog.ts` ya rechazaba y reintentaba automáticamente imágenes con
relleno gris, color, o sin líneas (`analyzeImageQuality`) — pero eso no
comprueba el CONTENIDO. Una imagen en blanco y negro, bien entintada, de un
sujeto completamente distinto al pedido, pasaba ese control igual.

Se añadió un segundo gate, justo después del de píxeles, que verifica con
visión (Gemini) que el sujeto pedido esté realmente presente:

- `lib/subject-check.ts` — `verifySubjectFidelity(imageBuffer, subjectDescription)`.
  Le pasa la imagen + el sujeto pedido a Gemini y le pide un JSON
  `{matches, reason}`. **Fail-safe por diseño**: si la verificación en sí falla
  (cuota, proveedor no-Google, timeout, respuesta rara), cuenta como `ok:
  true` — nunca bloquea un catálogo por un problema de infraestructura ajeno a
  si la imagen es correcta.
- `lib/ai.ts` — `generateVisionWithLLMFromBuffer()`, hermano de
  `generateVisionWithLLM()` pero que acepta un Buffer en memoria en vez de una
  URL pública (la imagen aún no se ha subido a Cloudinary en ese punto del
  pipeline). Solo soporta Google Gemini.
- `routes/autopilot.ts` — `extractColoringBookSubject(prompt)`, helper
  compartido que extrae el sujeto real de un prompt ya envuelto por
  `buildColoringBookPrompt` (mismos marcadores `CB_FIDELITY`/`CB_ANATOMY` que
  ya usaba el fix de longitud de Cloudflare en `routes/ai.ts` — se refactorizó
  ese fix para usar este mismo helper en vez de duplicar la lógica).
- `jobs/catalog.ts` — el gate se ejecuta cuando `quality.ok` es `true` (es
  decir, después del check de píxeles), usa el mismo mecanismo de
  reject+reintento que ya existía (`saveRejectedImageToVault` + `throw` →
  reintento automático hasta `MAX_IMAGE_RETRIES`), y se puede desactivar con
  la key de Settings `SUBJECT_CHECK_ENABLED` (mismo patrón que
  `QUALITY_CHECK_ENABLED`).

**Verificado con casos reales** (no simulados): la imagen del pájaro/mariposa
generada para el prompt del jardín se marcó correctamente como `ok: false`
("La imagen muestra un pájaro con alas de mariposa, no un jardín idílico...");
la imagen correcta del jardín japonés con puente y templo se marcó
correctamente como `ok: true` — sin falso positivo.

**Alcance de este cambio — qué NO cubre:** solo se añadió en `jobs/catalog.ts`
(creación de catálogos, manual y automática). El flujo de Telegram/autopilot
(`lib/image-gen.ts` → `generateImage()`) no tiene ningún mecanismo de
reject+reintento hoy (es una cadena de fallback simple, sin quality gate), así
que añadir este check ahí sería un cambio de arquitectura mayor, no una
extensión directa — no se tocó a propósito para no arriesgar Telegram sin
que el usuario lo pida explícitamente.

## Pollinations Anónimo (implementado 2026-08-14)

Modelo nuevo en el selector — usa `image.pollinations.ai` directo (sin API
key, sin gasto de "pollen"), a diferencia del resto de modelos "Pollinations"
que van por el gateway de pago `gen.pollinations.ai`. Separación estricta y
verificada: `pollinationsAnonymousFetch()` (`lib/pollinations-circuit.ts`)
nunca pasa por `toGenPollinationsUrl` (la reescritura al gateway de pago), ni
siquiera en los fallbacks internos (`generateImage()` con `opts.anonymous`,
la cadena de emergencia de `routes/ai.ts` ya excluía Pollinations por
completo de antes). Verificado con auditoría real de catálogos: ningún
catálogo con proveedor autenticado se creó mientras el modelo anónimo estaba
seleccionado.

**Calidad de estilo — limitación conocida, no arreglable solo con prompt.**
El backend detrás de este endpoint (modelo "sana" según metadatos EXIF,
distinto del "flux" del gateway de pago) ignora las restricciones de estilo
del prompt genérico casi por completo — con el mismo prompt que funciona bien
en el resto de proveedores, devolvía ilustraciones realistas con textura de
lápiz, a veces metidas dentro de un marco/caballete. Se creó
`buildAnonymousColoringBookPrompt()` (`lib/coloring-book-subject.ts`), una
plantilla más agresiva y afinada específicamente para este pipeline (probada
en 4 iteraciones reales) que mejora sustancialmente el resultado — sujeto
más reconocible, fondo blanco más consistente — pero el pipeline sigue
teniendo sesgos tercos hacia viñetas circulares y rellenos negros/grises que
NINGUNA instrucción negativa elimina del todo, y la fidelidad varía mucho de
una generación a otra con el mismo prompt.

**No hay forma de "arreglar" esto solo con prompt.** La única defensa real
para catálogos es el gate de calidad + sujeto de `jobs/catalog.ts` (rechaza y
reintenta automáticamente rellenos grises/negros y sujetos incorrectos). Para
generaciones sueltas fuera de un catálogo (creador manual con preview
inmediato, Telegram `/img`), no hay ese gate — el usuario puede ver
directamente una salida de baja fidelidad de este proveedor en concreto. Si
esto resulta ser un problema recurrente, la solución real sería añadir el
mismo gate de calidad a `lib/image-gen.ts`, no seguir puliendo el prompt.
