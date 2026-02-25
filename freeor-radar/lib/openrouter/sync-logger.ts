// ============================================================
// FreeOR Radar - Structured Sync Logger
// Skill: OpenRouter Data Sync (sync-logger)
// ============================================================

export type LogLevel = 'info' | 'warn' | 'error';

export interface SyncLogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    data?: unknown;
}

// In-memory log buffer (surfaced in cron API response for debugging)
const logBuffer: SyncLogEntry[] = [];

/**
 * Structured logger for OpenRouter sync operations.
 * Format: [OpenRouter Sync LEVEL] - {Timestamp} - {Message}
 */
export function syncLog(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const prefix = `[OpenRouter Sync ${level.toUpperCase()}]`;
    const formatted = `${prefix} - ${timestamp} - ${message}`;

    // Console output
    if (level === 'error') {
        console.error(formatted, data !== undefined ? data : '');
    } else if (level === 'warn') {
        console.warn(formatted, data !== undefined ? data : '');
    } else {
        console.log(formatted, data !== undefined ? data : '');
    }

    // Buffer for structured response
    logBuffer.push({ level, timestamp, message, data });
}

/**
 * Returns and clears the in-memory log buffer.
 * Call this at the end of a sync run to capture all logs.
 */
export function flushLogs(): SyncLogEntry[] {
    const logs = [...logBuffer];
    logBuffer.length = 0;
    return logs;
}

/**
 * Helper: sleep for N milliseconds (used in retry backoff)
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
