import { NextRequest, NextResponse } from 'next/server';
import { fetchFreeModels } from '@/lib/openrouter/fetch-models';
import { diffAndSyncModels } from '@/lib/openrouter/diff-models';
import { notifyTelegram } from '@/lib/notifications/telegram';
import { notifyDiscord } from '@/lib/notifications/discord';
import { notifyX } from '@/lib/notifications/x-twitter';
import { createServiceClient } from '@/lib/supabase/server';
import { syncLog, flushLogs } from '@/lib/openrouter/sync-logger';
import { CronResult } from '@/types';

/**
 * POST /api/cron
 * Triggered by Vercel Cron every hour (see vercel.json).
 * Supports manual trigger via Authorization header.
 *
 * Returns structured result with logs for debugging.
 */
export async function POST(req: NextRequest): Promise<NextResponse<CronResult>> {
    const startTime = Date.now();

    // ── Auth check ──────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { success: false, updated: 0, added: 0, removed: 0, notified: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    syncLog('info', '=== Cron sync started ===');

    try {
        // ── Step 1: Fetch free models from OpenRouter ─────────────
        // Skill: timeout + retry logic is inside fetchFreeModels()
        const newModels = await fetchFreeModels();
        syncLog('info', `Fetched ${newModels.length} free models (${newModels.filter(m => m.is_video_supported).length} video-supported)`);

        // ── Step 2: Diff & sync to Supabase ──────────────────────
        // Skill: independent try/catch per DB op inside diffAndSyncModels()
        const supabase = createServiceClient();
        const diff = await diffAndSyncModels(supabase, newModels);

        // ── Step 3: Notify on changes ─────────────────────────────
        let notified = false;
        const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

        if (hasChanges) {
            syncLog('info', `Changes detected — sending notifications...`);
            const tasks: Promise<void>[] = [];

            if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                tasks.push(
                    notifyTelegram(diff, process.env.TELEGRAM_CHAT_ID)
                        .catch(e => syncLog('error', `Telegram notify failed: ${e.message}`))
                );
            }
            if (process.env.DISCORD_WEBHOOK_URL) {
                tasks.push(
                    notifyDiscord(diff, process.env.DISCORD_WEBHOOK_URL)
                        .catch(e => syncLog('error', `Discord notify failed: ${e.message}`))
                );
            }
            // P2: X (Twitter) 推送
            if (process.env.X_ACCESS_TOKEN && process.env.X_API_KEY) {
                tasks.push(
                    notifyX(diff)
                        .catch(e => syncLog('error', `X notify failed: ${e.message}`))
                );
            }

            await Promise.allSettled(tasks);
            notified = tasks.length > 0;
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
