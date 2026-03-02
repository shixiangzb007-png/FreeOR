import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { PLATFORM_CONFIGS, getPlatformConfig } from '@/lib/video-credits/platform-config';

/**
 * POST /api/admin/video-credits
 *
 * 管理员手动更新视频平台额度数据（各平台无公开 API，此为唯一实时更新方式）。
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Body（单条更新）：
 *   { tool: string, used_today?: number, daily_credits?: number }
 *
 * Body（批量更新）：
 *   { updates: Array<{ tool, used_today?, daily_credits? }> }
 *
 * Body（全部重置）：
 *   { action: "reset_all" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    // ── 鉴权 ────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const supabase = createServiceClient();
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

/** GET — 查询当前所有平台额度 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
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
