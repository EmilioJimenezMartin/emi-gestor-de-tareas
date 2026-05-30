// Global single-permit semaphores for external AI API calls.
// imageSemaphore: all Pollinations / image-generation requests (1 slot).
// llmSemaphore:   all LLM text-generation requests — Gemini, HuggingFace (1 slot).
// The two semaphores are independent: an image call and an LLM call can run
// concurrently, but two image calls or two LLM calls cannot.
//
// Priority queue: callers with higher priority skip ahead of lower-priority waiters.
// Use niche score (0-100) as priority so high-score niches are served first.

class Semaphore {
    private busy = false;
    private holder: string | null = null;
    private acquiredAt: number | null = null;
    private queue: Array<{ resolve: () => void; name: string; priority: number }> = [];
    private timeoutId: NodeJS.Timeout | null = null;

    constructor(private readonly timeoutMs: number, private readonly label: string) {}

    async acquire(name: string, priority = 0): Promise<void> {
        if (!this.busy) {
            this._lock(name);
            return;
        }
        return new Promise<void>(resolve => {
            const entry = { resolve, name, priority };
            // Insert so that higher-priority entries come first; ties are FIFO
            const idx = this.queue.findIndex(q => q.priority < priority);
            if (idx === -1) this.queue.push(entry);
            else this.queue.splice(idx, 0, entry);
            console.log(`[${this.label}] queued "${name}" p=${priority} (${this.queue.length} waiting · holder: "${this.holder}")`);
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
            console.log(`[${this.label}] released by "${prev}" → next: "${next.name}" p=${next.priority} (${this.queue.length} remaining)`);
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
            queue: this.queue.map(q => ({ name: q.name, priority: q.priority })),
        };
    }
}

// 7 min timeout matches HARD_ABORT_MS (5 min) + Cloudinary upload buffer
export const imageSemaphore = new Semaphore(7 * 60_000, "img-lock");
// 5 min timeout for LLM calls
export const llmSemaphore   = new Semaphore(5 * 60_000, "llm-lock");

export async function withImageSlot<T>(name: string, fn: () => Promise<T>, priority = 0): Promise<T> {
    await imageSemaphore.acquire(name, priority);
    try { return await fn(); } finally { imageSemaphore.release(); }
}

export async function withLlmSlot<T>(name: string, fn: () => Promise<T>, priority = 0): Promise<T> {
    await llmSemaphore.acquire(name, priority);
    try { return await fn(); } finally { llmSemaphore.release(); }
}
