/**
 * Despliega el Worker de relay de Pollinations en Cloudflare.
 * Llamar una vez — actualiza el script si ya existe.
 */

const WORKER_NAME = "pollinations-relay";

const WORKER_SCRIPT = (pollinationsToken: string) => `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const target = new URL("https://image.pollinations.ai" + url.pathname + url.search);

    const token = "${pollinationsToken}";
    if (token) target.searchParams.set("token", token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(target.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; relay/1.0)" },
      });
      clearTimeout(timer);

      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-Relayed-By", "cf-worker");

      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      clearTimeout(timer);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};
`.trim();

export async function deployPollinationsRelay(): Promise<{ workerUrl: string }> {
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken  = process.env.CF_API_TOKEN;
    const pollinationsToken = process.env.POLLINATIONS_TOKEN || "";

    if (!accountId || !apiToken) {
        throw new Error("CF_ACCOUNT_ID o CF_API_TOKEN no configurados");
    }

    const script = WORKER_SCRIPT(pollinationsToken);

    // 1 — Sube el script
    const uploadRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/javascript",
            },
            body: script,
        }
    );

    const uploadBody = await uploadRes.json() as any;
    if (!uploadBody.success) {
        throw new Error(`Upload failed: ${JSON.stringify(uploadBody.errors)}`);
    }

    // 2 — Activa workers.dev subdomain
    const subdomainRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}/subdomain`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled: true }),
        }
    );
    const subdomainBody = await subdomainRes.json() as any;

    // 3 — Obtén el subdomain del account para construir la URL
    const subRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
        { headers: { "Authorization": `Bearer ${apiToken}` } }
    );
    const subBody = await subRes.json() as any;
    const accountSubdomain = subBody.result?.subdomain;

    const workerUrl = accountSubdomain
        ? `https://${WORKER_NAME}.${accountSubdomain}.workers.dev`
        : `https://${WORKER_NAME}.workers.dev`;

    console.log(`[cf-worker-deploy] Worker desplegado: ${workerUrl}`);
    return { workerUrl };
}
