import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/video/generate
 * Body: { prompt: string, model: string, lang?: string }
 * Header: Authorization: Bearer <openrouter_key>
 *
 * Proxies to OpenRouter's async video generation API (POST /api/v1/videos).
 * The endpoint returns a polling URL; we poll server-side until the job
 * completes (or times out) and return the final video URL to the client.
 *
 * The API key is passed from the client (user's own key) — we never store it.
 *
 * Docs: https://openrouter.ai/docs/api/api-reference/video-generation/create-videos
 */
export const maxDuration = 120; // Allow up to 2 minutes for video polling

const OPENROUTER_VIDEO_ENDPOINT = 'https://openrouter.ai/api/v1/videos';

// How long (ms) to keep polling before giving up, kept under maxDuration.
const POLL_BUDGET_MS = 100_000;
const POLL_INTERVAL_MS = 4_000;

interface ParsedResponse {
    data: Record<string, unknown> | null;
    rawText: string;
}

/** Safely read a fetch Response that may return non-JSON (e.g. an HTML error page). */
async function parseResponse(res: Response): Promise<ParsedResponse> {
    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
        data = null; // Non-JSON body (HTML, plain text, etc.)
    }
    return { data, rawText };
}

/** Build a human-friendly error message from an OpenRouter (possibly non-JSON) response. */
function extractError(parsed: ParsedResponse, status: number, zh: boolean): string {
    const { data, rawText } = parsed;
    const err = data?.error as { message?: string } | string | undefined;
    if (err && typeof err === 'object' && typeof err.message === 'string') return err.message;
    if (typeof err === 'string') return err;
    if (typeof data?.message === 'string') return data.message as string;

    const looksHtml = /^\s*<(?:!doctype|html)/i.test(rawText.trimStart());
    if (looksHtml || !data) {
        return zh
            ? `OpenRouter 返回了非 JSON 响应（HTTP ${status}）。请确认所选模型是受支持的视频生成模型，且 API Key 有效。`
            : `OpenRouter returned a non-JSON response (HTTP ${status}). Verify the model is a supported video model and your API key is valid.`;
    }
    return `HTTP ${status}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    let prompt = '';
    let model = 'google/veo-3.1';
    let lang = 'zh';

    try {
        const body = await req.json();
        prompt = (body.prompt || '').trim();
        if (body.model) model = body.model;
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';

    if (!prompt) {
        return NextResponse.json(
            { error: zh ? '请提供视频描述 Prompt' : 'Please provide a video prompt' },
            { status: 400 }
        );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();

    if (!apiKey) {
        return NextResponse.json(
            {
                error: zh
                    ? '需要 OpenRouter API Key。请前往设置页填写您的 Key。'
                    : 'OpenRouter API Key is required. Please add your key in Settings.'
            },
            { status: 401 }
        );
    }

    const baseHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
        'X-Title': 'FreeOR Radar - Video Generation',
    };

    // ── 1. Submit the video generation job ───────────────────────
    let submit: ParsedResponse;
    let submitStatus: number;
    try {
        const res = await fetch(OPENROUTER_VIDEO_ENDPOINT, {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({ model, prompt }),
        });
        submitStatus = res.status;
        submit = await parseResponse(res);

        if (!res.ok) {
            return NextResponse.json(
                { error: extractError(submit, res.status, zh) },
                { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
            );
        }
    } catch (err) {
        console.error('[Video Generate] Submit failed:', err);
        return NextResponse.json(
            { error: zh ? '提交视频任务失败，请稍后重试' : 'Failed to submit video job, please try again' },
            { status: 502 }
        );
    }

    if (!submit.data) {
        return NextResponse.json(
            { error: extractError(submit, submitStatus, zh) },
            { status: 502 }
        );
    }

    const job = submit.data as {
        id?: string;
        polling_url?: string;
        status?: string;
        unsigned_urls?: string[];
        error?: string;
    };

    // Some jobs may already be complete on submission.
    const firstUrl = (job.unsigned_urls && job.unsigned_urls[0]) || null;
    if (job.status === 'completed' && firstUrl) {
        return NextResponse.json({ video_url: firstUrl, revised_prompt: prompt, model });
    }
    if (job.status === 'failed') {
        return NextResponse.json(
            { error: job.error || (zh ? '视频生成失败' : 'Video generation failed') },
            { status: 502 }
        );
    }

    const pollingUrl = job.polling_url;
    if (!pollingUrl) {
        return NextResponse.json(
            { error: zh ? '未获取到任务轮询地址' : 'No polling URL returned by OpenRouter' },
            { status: 502 }
        );
    }

    // ── 2. Poll until the job completes (or budget runs out) ─────
    const deadline = Date.now() + POLL_BUDGET_MS;
    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);

        try {
            const res = await fetch(pollingUrl, { method: 'GET', headers: baseHeaders });
            const parsed = await parseResponse(res);

            if (!res.ok) {
                // Transient errors: keep polling unless it's a hard client error.
                if (res.status >= 400 && res.status < 500) {
                    return NextResponse.json(
                        { error: extractError(parsed, res.status, zh) },
                        { status: res.status }
                    );
                }
                continue;
            }

            const status = parsed.data?.status as string | undefined;
            const urls = parsed.data?.unsigned_urls as string[] | undefined;

            if (status === 'completed') {
                const url = urls && urls[0];
                if (!url) {
                    return NextResponse.json(
                        { error: zh ? '视频生成完成但未返回视频链接' : 'Job completed but no video URL was returned' },
                        { status: 502 }
                    );
                }
                return NextResponse.json({ video_url: url, revised_prompt: prompt, model });
            }

            if (status === 'failed' || status === 'cancelled' || status === 'expired') {
                const errMsg = (parsed.data?.error as string) ||
                    (zh ? `视频生成${status === 'failed' ? '失败' : status === 'cancelled' ? '被取消' : '已过期'}` : `Video generation ${status}`);
                return NextResponse.json({ error: errMsg }, { status: 502 });
            }
            // status pending / in_progress → keep polling
        } catch (err) {
            console.error('[Video Generate] Poll error:', err);
            // Network blip — keep polling until the deadline.
        }
    }

    // ── 3. Timed out: return job id so the user can check later ──
    return NextResponse.json(
        {
            error: zh
                ? '视频生成仍在进行中（已等待约 100 秒）。视频模型生成较慢，请稍后在 OpenRouter 控制台查看结果。'
                : 'Video is still generating (waited ~100s). Video models can be slow; check the OpenRouter dashboard for the result.',
            job_id: job.id || null,
            pending: true,
        },
        { status: 504 }
    );
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/video/generate',
        description: 'Proxy to OpenRouter async video generation API (/api/v1/videos)',
        body: {
            prompt: 'string (required)',
            model: 'string (optional, default: google/veo-3.1)',
            lang: 'string (optional, "zh" | "en")',
        },
        headers: { 'Authorization': 'Bearer <openrouter_key>' },
        note: 'Submits the job, polls the returned polling_url until completion, and returns video_url.',
    });
}
