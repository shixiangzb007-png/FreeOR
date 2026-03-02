import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { PLATFORM_CONFIGS } from '@/lib/video-credits/platform-config';

/**
 * POST /api/cron/video-credits
 *
 * 每日 UTC 01:00 由 Vercel Cron 触发（见 vercel.json）。
 * 将所有平台的 used_today 重置为 0，daily_credits 同步为最新配置。
 *
 * 为何不实时抓取：各平台均无公开 API，Playwright 爬取无法在 Vercel 运行。
 * 管理员可通过 POST /api/admin/video-credits 手动 patch 真实已用量。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    // ── 鉴权 ────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServiceClient();
        const now = new Date().toISOString();

        // 构造 upsert payload：每日重置 used_today = 0
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
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
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
