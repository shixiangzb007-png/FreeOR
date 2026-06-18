import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/video/poll
 * Body: { polling_url: string, lang?: string }
 * Header: Authorization: Bearer <openrouter_key>
 *
 * Polls OpenRouter once for video job status. Client loops until completed/failed.
 */

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
            ? `OpenRouter 返回了非 JSON 响应（HTTP ${status}）`
            : `OpenRouter returned a non-JSON response (HTTP ${status})`;
    }
    return `HTTP ${status}`;
}

/** Only allow OpenRouter polling URLs to prevent SSRF. */
function isAllowedPollingUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname === 'openrouter.ai';
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    let pollingUrl = '';
    let lang = 'zh';

    try {
        const body = await req.json();
        pollingUrl = (body.polling_url || '').trim();
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';

    if (!pollingUrl || !isAllowedPollingUrl(pollingUrl)) {
        return NextResponse.json(
            { error: zh ? '无效的轮询地址' : 'Invalid polling URL' },
            { status: 400 }
        );
    }

    const apiKey = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!apiKey) {
        return NextResponse.json(
            { error: zh ? '需要 OpenRouter API Key' : 'OpenRouter API Key is required' },
            { status: 401 }
        );
    }

    try {
        const res = await fetch(pollingUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
                'X-Title': 'FreeOR Radar - Video Poll',
            },
            signal: AbortSignal.timeout(30_000),
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

        const status = (parsed.data.status as string) || 'pending';
        const urls = parsed.data.unsigned_urls as string[] | undefined;
        const video_url = urls?.[0] ?? null;
        const jobError = parsed.data.error as string | undefined;

        if (status === 'completed') {
            if (!video_url) {
                return NextResponse.json(
                    { error: zh ? '视频生成完成但未返回视频链接' : 'Job completed but no video URL was returned' },
                    { status: 502 }
                );
            }
            return NextResponse.json({ status: 'completed', video_url });
        }

        if (status === 'failed' || status === 'cancelled' || status === 'expired') {
            const errMsg = jobError ||
                (zh
                    ? `视频生成${status === 'failed' ? '失败' : status === 'cancelled' ? '被取消' : '已过期'}`
                    : `Video generation ${status}`);
            return NextResponse.json({ status, error: errMsg }, { status: 502 });
        }

        return NextResponse.json({ status });
    } catch (err) {
        console.error('[Video Poll] Error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('aborted');
        return NextResponse.json(
            { error: zh ? (isTimeout ? '轮询超时' : '轮询失败') : (isTimeout ? 'Poll timed out' : 'Poll failed') },
            { status: isTimeout ? 504 : 502 }
        );
    }
}
