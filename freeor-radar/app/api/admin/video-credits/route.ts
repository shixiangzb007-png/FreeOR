import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PLATFORM_CONFIGS, getPlatformConfig } from '@/lib/video-credits/platform-config';

/**
 * POST /api/admin/video-credits
 *
 * Admin endpoint to manually patch video credit data.
 * S-2 Fix: CRON_SECRET strictly required — returns 503 if unset, 401 if wrong.
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Body (single):   { tool: string, used_today?: number, daily_credits?: number }
 * Body (batch):    { updates: Array<{ tool, used_today?, daily_credits? }> }
 * Body (reset all): { action: "reset_all" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
    const now = new Date().toISOString();

    // ── 全部重置 ────────────────────────────────────────────────
    if (body.action === 'reset_all') {
        const rows = PLATFORM_CONFIGS.map(p => ({
            tool: p.tool,
            daily_credits: p.daily_credits,
            used_today: 0,
            updated_at: now,
        }));
        const { error } = await supabase
            .from('video_credits')
            .upsert(rows, { onConflict: 'tool' });
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, action: 'reset_all', count: rows.length });
    }

    // ── 批量更新 ────────────────────────────────────────────────
    const updates: Array<{ tool: string; used_today?: number; daily_credits?: number }> =
        Array.isArray(body.updates)
            ? body.updates
            : body.tool
                ? [body as { tool: string; used_today?: number; daily_credits?: number }]
                : [];

    if (updates.length === 0) {
        return NextResponse.json(
            { success: false, error: 'Provide { tool, used_today?, daily_credits? } or { updates: [...] } or { action: "reset_all" }' },
            { status: 400 }
        );
    }

    const rows = updates.map(u => {
        const config = getPlatformConfig(u.tool);
        return {
            tool: u.tool,
            daily_credits: u.daily_credits ?? config?.daily_credits ?? 0,
            used_today: u.used_today ?? 0,
            updated_at: now,
        };
    });

    const { error } = await supabase
        .from('video_credits')
        .upsert(rows, { onConflict: 'tool' });

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        updated: rows.map(r => ({
            tool: r.tool,
            daily_credits: r.daily_credits,
            used_today: r.used_today,
        })),
    });
}

/** GET — query current credits (auth required) */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ success: false, error: 'CRON_SECRET is not configured.' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
    const { data, error } = await supabase
        .from('video_credits')
        .select('*')
        .order('tool');

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
        success: true,
        credits: data,
        config: PLATFORM_CONFIGS,
    });
}
