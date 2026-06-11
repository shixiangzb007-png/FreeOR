import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { probeFreeModels, ProbeRunResult } from '@/lib/openrouter/probe-models';
import { syncLog, flushLogs } from '@/lib/openrouter/sync-logger';

export interface ProbeCronResult extends ProbeRunResult {
    success: boolean;
    duration_ms: number;
    logs?: ReturnType<typeof flushLogs>;
    error?: string;
}

/**
 * POST /api/cron/probe
 * Probes a batch of free models for real availability (latency / 429 / failures).
 * Requires CRON_SECRET + OPENROUTER_PROBE_API_KEY.
 *
 * Scheduled hourly at :30 via vercel.json (offset from main sync at :00).
 */
export async function POST(req: NextRequest): Promise<NextResponse<ProbeCronResult>> {
    const startTime = Date.now();

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json(
            {
                success: false,
                probed: 0,
                healthy: 0,
                slow: 0,
                rate_limited: 0,
                down: 0,
                skipped: true,
                duration_ms: Date.now() - startTime,
                error: 'CRON_SECRET is not configured',
            },
            { status: 503 }
        );
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            {
                success: false,
                probed: 0,
                healthy: 0,
                slow: 0,
                rate_limited: 0,
                down: 0,
                skipped: true,
                duration_ms: Date.now() - startTime,
                error: 'Unauthorized',
            },
            { status: 401 }
        );
    }

    syncLog('info', '=== Availability probe started ===');

    try {
        const supabase = createServiceClient();
        const result = await probeFreeModels(supabase);
        const duration_ms = Date.now() - startTime;

        syncLog('info', `=== Availability probe completed in ${duration_ms}ms ===`);

        return NextResponse.json({
            success: true,
            ...result,
            duration_ms,
            logs: flushLogs(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const duration_ms = Date.now() - startTime;
        syncLog('error', `Availability probe failed: ${message}`);

        return NextResponse.json(
            {
                success: false,
                probed: 0,
                healthy: 0,
                slow: 0,
                rate_limited: 0,
                down: 0,
                skipped: false,
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
        message: 'POST with Bearer CRON_SECRET to run availability probe batch',
        requires: ['CRON_SECRET', 'OPENROUTER_PROBE_API_KEY'],
    });
}
