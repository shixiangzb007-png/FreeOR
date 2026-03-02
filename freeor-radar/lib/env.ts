/**
 * S-7 Fix: Centralized environment variable validation.
 *
 * Import this module in server-side entry points (API routes, cron jobs)
 * to get a clear error at startup if any required env var is missing,
 * rather than a cryptic TypeError at runtime.
 */

const REQUIRED_SERVER_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const REQUIRED_CRON_VARS = [
    ...REQUIRED_SERVER_VARS,
    'CRON_SECRET',
] as const;

/**
 * Validate that all required base env vars are set.
 * Throws a descriptive Error if any are missing.
 */
export function validateBaseEnv(): void {
    const missing = REQUIRED_SERVER_VARS.filter(k => !process.env[k]);
    if (missing.length > 0) {
        throw new Error(
            `[env] Missing required environment variables: ${missing.join(', ')}. ` +
            'Check your .env.local or Vercel dashboard settings.'
        );
    }
}

/**
 * Validate that CRON_SECRET is explicitly set (non-empty).
 * Cron/admin routes MUST call this — a missing secret means the endpoint is unprotected.
 */
export function validateCronEnv(): void {
    validateBaseEnv();
    if (!process.env.CRON_SECRET) {
        throw new Error(
            '[env] CRON_SECRET is not set. All cron/admin endpoints require this. ' +
            'Generate one with: openssl rand -hex 32'
        );
    }
}

/**
 * Validate a Discord webhook URL format to prevent SSRF.
 * S-5 Fix.
 */
export function isValidDiscordWebhook(url: string): boolean {
    return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
}

/**
 * Validate a Telegram Chat ID format (positive integer or -100xxxxxxx group ID).
 */
export function isValidTelegramChatId(id: string): boolean {
    return /^-?\d+$/.test(id.trim());
}
