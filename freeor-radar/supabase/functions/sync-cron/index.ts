// ============================================================
// FreeOR Radar — Supabase Edge Function: sync-cron
// ------------------------------------------------------------
// 目的: 满足 PRD "推送延迟 < 5 分钟" 目标。
//   Vercel Hobby 计划的 Cron 频率受限（通常每天/每小时），无法做到 5 分钟级。
//   本 Edge Function 由 Supabase pg_cron 每 5 分钟触发（见 migration 005），
//   转而调用已有的 Next.js 同步端点 /api/cron（复用 fetch/diff/notify 全部逻辑），
//   从而在不重写业务逻辑的前提下把检测+推送延迟压到 5 分钟内。
//
// 部署:
//   supabase functions deploy sync-cron
// 需要在 Edge Function 的 Secrets 中配置:
//   supabase secrets set SITE_URL=https://<你的-vercel-域名>
//   supabase secrets set CRON_SECRET=<与 Next.js 环境变量一致的 CRON_SECRET>
// ============================================================

Deno.serve(async (): Promise<Response> => {
    const siteUrl = Deno.env.get('SITE_URL');
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!siteUrl || !cronSecret) {
        return new Response(
            JSON.stringify({ error: 'Missing SITE_URL or CRON_SECRET secret in the Edge Function environment.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }

    const target = `${siteUrl.replace(/\/+$/, '')}/api/cron`;
    const startedAt = Date.now();

    try {
        const res = await fetch(target, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cronSecret}`,
                'Content-Type': 'application/json',
            },
        });

        const body = await res.text();
        return new Response(
            JSON.stringify({
                triggered: target,
                upstream_status: res.status,
                latency_ms: Date.now() - startedAt,
                upstream_body: safeParse(body),
            }),
            {
                status: res.ok ? 200 : 502,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(
            JSON.stringify({ error: `Failed to trigger ${target}: ${message}` }),
            { status: 502, headers: { 'Content-Type': 'application/json' } },
        );
    }
});

function safeParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text.slice(0, 500);
    }
}
