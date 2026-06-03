/**
 * Intercepts console.log/warn/error and streams entries to connected
 * Socket.IO clients via the "logs:line" event.
 * Also keeps a ring buffer (last LOG_BUFFER_SIZE entries) so new clients
 * can fetch history via the REST endpoint.
 */

export interface LogEntry {
    t: number;
    level: "info" | "warn" | "error";
    msg: string;
}

const LOG_BUFFER_SIZE = 400;
const buffer: LogEntry[] = [];
let _io: any = null;

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

function push(level: LogEntry["level"], args: any[]) {
    const msg = args
        .map(a => {
            if (typeof a === "string") return a;
            try { return JSON.stringify(a); } catch { return String(a); }
        })
        .join(" ");

    const entry: LogEntry = { t: Date.now(), level, msg };
    buffer.push(entry);
    if (buffer.length > LOG_BUFFER_SIZE) buffer.shift();
    _io?.emit("logs:line", entry);
}

export function initLogStreamer(io: any) {
    _io = io;

    console.log = (...args: any[]) => { origLog(...args); push("info", args); };
    console.warn = (...args: any[]) => { origWarn(...args); push("warn", args); };
    console.error = (...args: any[]) => { origError(...args); push("error", args); };
}

export function getLogBuffer(): LogEntry[] {
    return [...buffer];
}
