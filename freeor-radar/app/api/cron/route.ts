import { NextRequest, NextResponse } from 'next/server';
import { fetchFreeModels } from '@/lib/openrouter/fetch-models';
import { diffAndSyncModels } from '@/lib/openrouter/diff-models';
import { notifyTelegram } from '@/lib/notifications/telegram';
import { notifyDiscord } from '@/lib/notifications/discord';
import { notifyX } from '@/lib/notifications/x-twitter';
import { createServiceClient } from '@/lib/supabase/server';
import { syncLog, flushLogs } from '@/lib/openrouter/sync-logger';
import { validateCronEnv, isValidDiscordWebhook, isValidTelegramChatId } from '@/lib/env';
import { CronResult, ModelDiff } from '@/types';
import { SupabaseClient } from '@supabase/supabase-js';

/** Keep only the change categories the subscriber opted into. */
function filterDiffByEventTypes(diff: ModelDiff, eventTypes: string[]): ModelDiff {
    return {
        added: eventTypes.includes('new') ? diff.added : [],
        removed: eventTypes.includes('removed') ? diff.removed : [],
        changed: eventTypes.includes('limit_change') ? diff.changed : [],
    };
}

interface SubscriptionRow {
    channel: string;
    target: string;
    event_types: string[] | null;
}

/**
 * Fan out notifications to every active per-user subscription saved from the
 * settings page (stored in notification_subscriptions). Returns the number of
 * notification calls dispatched.
 */
async function notifySubscriptions(
    supabase: SupabaseClient,
    diff: ModelDiff
): Promise<number> {
    const { data, error } = await supabase
        .from('notification_subscriptions')
        .select('channel, target, event_types')
        .eq('is_active', true);

    if (error) {
        syncLog('warn', `Could not load subscriptions: ${error.message}`);
        return 0;
    }

    const subs = (data || []) as SubscriptionRow[];
    if (subs.length === 0) return 0;

    const tasks: Promise<void>[] = [];

    for (const sub of subs) {
        const eventTypes = sub.event_types && sub.event_types.length > 0 ? sub.event_types : ['new', 'removed'];
        const scoped = filterDiffByEventTypes(diff, eventTypes);
        if (scoped.added.length === 0 && scoped.removed.length === 0 && scoped.changed.length === 0) continue;

        if (sub.channel === 'telegram' && isValidTelegramChatId(sub.target)) {
            tasks.push(
                notifyTelegram(scoped, sub.target)
                    .catch(e => syncLog('error', `Subscriber Telegram notify failed: ${e.message}`))
            );
        } else if (sub.channel === 'discord' && isValidDiscordWebhook(sub.target)) {
            tasks.push(
                notifyDiscord(scoped, sub.target)
                    .catch(e => syncLog('error', `Subscriber Discord notify failed: ${e.message}`))
            );
        }
    }

    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
        syncLog('info', `Dispatched ${tasks.length} subscriber notification(s)`);
    }
    return tasks.length;
}

/**
 * POST /api/cron
 * Triggered by Vercel Cron every hour (see vercel.json).
 * Supports manual trigger via Authorization header.
 *
 * S-2 Fix: CRON_SECRET is now REQUIRED — returns 401 if not set at all.
 * S-5 Fix: Discord webhook URL validated before use.
 */
export async function POST(req: NextRequest): Promise<NextResponse<CronResult>> {
    const startTime = Date.now();

    // ── S-2: Strict auth — CRON_SECRET must be set AND match ───
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        // Secret not configured at all — refuse to run (prevents misconfigured deploys)
        return NextResponse.json(
            { success: false, updated: 0, added: 0, removed: 0, notified: false, error: 'CRON_SECRET is not configured. Set it in environment variables.' },
            { status: 503 }
        );
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { success: false, updated: 0, added: 0, removed: 0, notified: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    syncLog('info', '=== Cron sync started ===');

    try {
        // ── Step 1: Fetch free models from OpenRouter ─────────────
        const newModels = await fetchFreeModels();
        syncLog('info', `Fetched ${newModels.length} free models (${newModels.filter(m => m.is_video_supported).length} video-supported)`);

        // ── Step 2: Diff & sync to Supabase ──────────────────────
        const supabase = createServiceClient();
        const diff = await diffAndSyncModels(supabase, newModels);

        // ── Step 3: Notify on changes ─────────────────────────────
        let notified = false;
        const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

        if (hasChanges) {
            syncLog('info', `Changes detected — sending notifications...`);
            const tasks: Promise<void>[] = [];

            if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                tasks.push(
                    notifyTelegram(diff, process.env.TELEGRAM_CHAT_ID)
                        .catch(e => syncLog('error', `Telegram notify failed: ${e.message}`))
                );
            }

            // S-5 Fix: validate Discord webhook URL format before sending
            const discordUrl = process.env.DISCORD_WEBHOOK_URL;
            if (discordUrl && isValidDiscordWebhook(discordUrl)) {
                tasks.push(
                    notifyDiscord(diff, discordUrl)
                        .catch(e => syncLog('error', `Discord notify failed: ${e.message}`))
                );
            } else if (discordUrl) {
                syncLog('warn', 'DISCORD_WEBHOOK_URL format is invalid — skipping Discord notification');
            }

            if (process.env.X_ACCESS_TOKEN && process.env.X_API_KEY) {
                tasks.push(
                    notifyX(diff)
                        .catch(e => syncLog('error', `X notify failed: ${e.message}`))
                );
            }

            await Promise.allSettled(tasks);

            // Per-user subscriptions saved from the settings page (Telegram / Discord).
            const subscriberCount = await notifySubscriptions(supabase, diff);

            notified = tasks.length > 0 || subscriberCount > 0;
        } else {
            syncLog('info', 'No changes detected — skipping notifications');
        }

        const duration_ms = Date.now() - startTime;
        syncLog('info', `=== Cron sync completed in ${duration_ms}ms ===`);

        const result: CronResult = {
            success: true,
            updated: newModels.length,
            added: diff.added.length,
            removed: diff.removed.length,
            notified,
            duration_ms,
            logs: flushLogs(),
        };

        return NextResponse.json(result);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const duration_ms = Date.now() - startTime;

        syncLog('error', `Cron sync failed: ${message}`);

        return NextResponse.json(
            {
                success: false,
                updated: 0,
                added: 0,
                removed: 0,
                notified: false,
                duration_ms,
                logs: flushLogs(),
                error: message,
            },
            { status: 500 }
        );
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        status: 'ok',
        message: 'POST to this endpoint to trigger a sync',
        skill: 'openrouter-sync v1',
    });
}
