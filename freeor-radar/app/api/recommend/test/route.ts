import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/recommend/test
 * Body: { model: string, prompt?: string, lang?: string }
 * Header: Authorization: Bearer <user's OpenRouter API key>  (required)
 *
 * Directly calls OpenRouter chat/completions with the recommended model so the
 * user can verify it works before integrating. Proxied server-side to avoid CORS
 * and to keep request shape consistent with /api/recommend.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let model = '';
    let prompt = '';
    let lang = 'en';

    try {
        const body = await req.json();
        model = (body.model || '').trim();
        prompt = (body.prompt || '').trim();
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';

    if (!model) {
        return NextResponse.json(
            { error: zh ? '缺少模型 ID' : 'Missing model id' },
            { status: 400 }
        );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();
    if (!apiKey) {
        return NextResponse.json(
            { error: zh ? '请先在设置页配置 OpenRouter API Key' : 'Please configure your OpenRouter API Key in Settings first' },
            { status: 401 }
        );
    }

    const userContent = prompt || (zh ? '你好，请用一句话介绍你自己。' : 'Hi, introduce yourself in one sentence.');

    const startedAt = Date.now();

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://freeor.app',
                'X-Title': 'FreeOR Radar',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: userContent }],
                temperature: 0.7,
                max_tokens: 512,
            }),
            signal: AbortSignal.timeout(30_000),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const apiMsg = data?.error?.message || `HTTP ${response.status}`;
            return NextResponse.json(
                { error: zh ? `调用失败：${apiMsg}` : `Call failed: ${apiMsg}` },
                { status: response.status === 401 ? 401 : 502 }
            );
        }

        const content: string = data?.choices?.[0]?.message?.content || '';
        const usage = data?.usage || null;

        return NextResponse.json({
            content,
            model: data?.model || model,
            usage,
            latency_ms: Date.now() - startedAt,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('aborted');
        return NextResponse.json(
            { error: zh ? (isTimeout ? '调用超时（30s），请稍后重试' : `网络错误：${msg}`) : (isTimeout ? 'Request timed out (30s)' : `Network error: ${msg}`) },
            { status: 504 }
        );
    }
}
