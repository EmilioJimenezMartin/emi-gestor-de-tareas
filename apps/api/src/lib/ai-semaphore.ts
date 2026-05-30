// Global single-permit semaphores for external AI API calls.
// imageSemaphore: all Pollinations / image-generation requests (1 slot).
// llmSemaphore:   all LLM text-generation requests — Gemini, HuggingFace (1 slot).
// The two semaphores are independent: an image call and an LLM call can run
// concurrently, but two image calls or two LLM calls cannot.

class Semaphore {
    private busy = false;
    private holder: string | null = null;
    private acquiredAt: number | null = null;
    private queue: Array<{ resolve: () => void; name: string }> = [];
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(private readonly timeoutMs: number, private readonly label: string) {}

    async acquire(name: string): Promise<void> {
        if (!this.busy) {
            this._lock(name);
            return;
        }
        return new Promise<void>(resolve => {
            this.queue.push({ resolve, name });
            console.log(`[${this.label}] queued "${name}" (${this.queue.length} waiting · holder: "${this.holder}")`);
        });
    }

    release(): void {
        if (this.timeoutId) { clearTimeout(this.timeoutId); this.timeoutId = null; }
        const prev = this.holder;
        this.busy = false;
        this.holder = null;
        this.acquiredAt = null;

        if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            console.log(`[${this.label}] released by "${prev}" → next: "${next.name}" (${this.queue.length} remaining)`);
            this._lock(next.name);
            next.resolve();
        } else {
            console.log(`[${this.label}] released by "${prev}" — idle`);
        }
    }

    private _lock(name: string): void {
        this.busy = true;
        this.holder = name;
        this.acquiredAt = Date.now();
        this.timeoutId = setTimeout(() => {
            console.warn(`[${this.label}] force-releasing stale lock held by "${name}" after ${this.timeoutMs / 60_000}min`);
            this.release();
        }, this.timeoutMs);
        console.log(`[${this.label}] acquired by "${name}"`);
    }

    status() {
        return {
            busy: this.busy,
            holder: this.holder,
            heldMs: this.acquiredAt ? Date.now() - this.acquiredAt : 0,
            queueLength: this.queue.length,
            queue: this.queue.map(q => q.name),
        };
    }
}

// 7 min timeout matches HARD_ABORT_MS (5 min) + Cloudinary upload buffer
export const imageSemaphore = new Semaphore(7 * 60_000, "img-lock");
// 5 min timeout for LLM calls
export const llmSemaphore   = new Semaphore(5 * 60_000, "llm-lock");

export async function withImageSlot<T>(name: string, fn: () => Promise<T>): Promise<T> {
    await imageSemaphore.acquire(name);
    try { return await fn(); } finally { imageSemaphore.release(); }
}

export async function withLlmSlot<T>(name: string, fn: () => Promise<T>): Promise<T> {
    await llmSemaphore.acquire(name);
    try { return await fn(); } finally { llmSemaphore.release(); }
}
