import { NextRequest, NextResponse } from 'next/server';
import { clampVideoDuration, getVideoModelConfig } from '@/lib/video/models';

/**
 * POST /api/video/generate
 * Body: { prompt: string, model: string, lang?: string }
 * Header: Authorization: Bearer <openrouter_key>
 *
 * Submits a video job to OpenRouter (POST /api/v1/videos) and returns immediately
 * with job_id + polling_url. The client polls /api/video/poll until complete.
 */

const OPENROUTER_VIDEO_ENDPOINT = 'https://openrouter.ai/api/v1/videos';

interface ParsedResponse {
    data: Record<string, unknown> | null;
    rawText: string;
}

async function parseResponse(res: Response): Promise<ParsedResponse> {
    const rawText = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
        data = null;
    }
    return { data, rawText };
}

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

function readApiKey(req: NextRequest): string {
    return (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
}

function openRouterHeaders(apiKey: string): Record<string, string> {
    return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
        'X-Title': 'FreeOR Radar - Video Generation',
    };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    let prompt = '';
    let model = 'google/veo-3.1';
    let lang = 'zh';
    let duration: number | undefined;

    try {
        const body = await req.json();
        prompt = (body.prompt || '').trim();
        if (body.model) model = body.model;
        if (body.lang) lang = body.lang;
        if (body.duration != null) {
            const parsed = Number(body.duration);
            if (Number.isFinite(parsed)) duration = clampVideoDuration(parsed, model);
        }
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

    const apiKey = readApiKey(req);
    if (!apiKey) {
        return NextResponse.json(
            {
                error: zh
                    ? '需要 OpenRouter API Key。请前往设置页填写您的 Key。'
                    : 'OpenRouter API Key is required. Please add your key in Settings.',
            },
            { status: 401 }
        );
    }

    try {
        const payload: Record<string, unknown> = { model, prompt };
        // OpenRouter uses the `duration` field (seconds), not prompt text alone.
        if (duration != null) {
            payload.duration = duration;
        } else {
            payload.duration = getVideoModelConfig(model).defaultDuration;
        }

        const res = await fetch(OPENROUTER_VIDEO_ENDPOINT, {
            method: 'POST',
            headers: openRouterHeaders(apiKey),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60_000),
        });
        const parsed = await parseResponse(res);

        if (!res.ok) {
            return NextResponse.json(
                { error: extractError(parsed, res.status, zh) },
                { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
            );
        }

        if (!parsed.data) {
            return NextResponse.json(
                { error: extractError(parsed, res.status, zh) },
                { status: 502 }
            );
        }

        const job = parsed.data as {
            id?: string;
            polling_url?: string;
            status?: string;
            unsigned_urls?: string[];
            error?: string;
        };

        const firstUrl = job.unsigned_urls?.[0] ?? null;
        if (job.status === 'completed' && firstUrl) {
        return NextResponse.json({
            status: 'completed',
            video_url: firstUrl,
            revised_prompt: prompt,
            model,
            job_id: job.id ?? null,
            duration: payload.duration as number,
        });
        }

        if (job.status === 'failed') {
            return NextResponse.json(
                { error: job.error || (zh ? '视频生成失败' : 'Video generation failed') },
                { status: 502 }
            );
        }

        if (!job.polling_url) {
            return NextResponse.json(
                { error: zh ? '未获取到任务轮询地址' : 'No polling URL returned by OpenRouter' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            status: job.status || 'pending',
            job_id: job.id ?? null,
            polling_url: job.polling_url,
            model,
            revised_prompt: prompt,
            duration: payload.duration as number,
        });
    } catch (err) {
        console.error('[Video Generate] Submit failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('aborted');
        return NextResponse.json(
            {
                error: zh
                    ? (isTimeout ? '提交超时，请稍后重试' : '提交视频任务失败，请稍后重试')
                    : (isTimeout ? 'Submit timed out, please retry' : 'Failed to submit video job, please try again'),
            },
            { status: isTimeout ? 504 : 502 }
        );
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/video/generate',
        description: 'Submit OpenRouter async video job; poll status via POST /api/video/poll',
        body: {
            prompt: 'string (required)',
            model: 'string (optional, default: google/veo-3.1)',
            lang: 'string (optional, "zh" | "en")',
        },
        headers: { Authorization: 'Bearer <openrouter_key>' },
    });
}
