import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLATFORM_CONFIGS } from '@/lib/video-credits/platform-config';

/**
 * POST /api/cron/video-credits
 *
 * Resets all platform video credits daily (UTC 01:00).
 * S-2 Fix: CRON_SECRET is strictly required — returns 503 if unset.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    // ── S-2: Strict auth ─────────────────────────────────────────
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json(
            { success: false, error: 'CRON_SECRET is not configured. Set it in environment variables.' },
            { status: 503 }
        );
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );
        const now = new Date().toISOString();

        const rows = PLATFORM_CONFIGS.map(p => ({
            tool: p.tool,
            daily_credits: p.daily_credits,
            used_today: 0,
            updated_at: now,
            reset_at: now,
        }));

        const { error } = await supabase
            .from('video_credits')
            .upsert(rows, { onConflict: 'tool' });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const duration_ms = Date.now() - startTime;
        return NextResponse.json({
            success: true,
            upserted: rows.length,
            platforms: rows.map(r => r.tool),
            duration_ms,
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        status: 'ok',
        message: 'POST to reset all platform video credits (daily cron)',
        platforms: PLATFORM_CONFIGS.map(p => ({
            tool: p.tool,
            label: p.label,
            daily_credits: p.daily_credits,
            reset_label: p.reset_label,
        })),
    });
}
