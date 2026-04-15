import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/video/generate
 * Body: { prompt: string, model: string, lang?: string }
 * Header: Authorization: Bearer <openrouter_key>
 *
 * Proxies to OpenRouter /api/v1/images/generations for text-to-video models.
 * The API key is passed from the client (user's own key) — we never store it.
 *
 * Supports text-to-video models available on OpenRouter, e.g.:
 *   - wan-ai/wan2.1-t2v-turbo (free tier)
 *   - google/veo-3.1 (paid)
 */
export const maxDuration = 120; // Allow up to 2 minutes for video generation

const OPENROUTER_VIDEO_ENDPOINT = 'https://openrouter.ai/api/v1/images/generations';

export async function POST(req: NextRequest): Promise<NextResponse> {
    let prompt = '';
    let model = 'wan-ai/wan2.1-t2v-turbo';
    let lang = 'zh';

    try {
        const body = await req.json();
        prompt = (body.prompt || '').trim();
        if (body.model) model = body.model;
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!prompt) {
        return NextResponse.json(
            { error: lang === 'zh' ? '请提供视频描述 Prompt' : 'Please provide a video prompt' },
            { status: 400 }
        );
    }

    // Read user's OpenRouter API key from the Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();

    if (!apiKey) {
        return NextResponse.json(
            {
                error: lang === 'zh'
                    ? '需要 OpenRouter API Key。请前往设置页填写您的 Key。'
                    : 'OpenRouter API Key is required. Please add your key in Settings.'
            },
            { status: 401 }
        );
    }

    try {
        const response = await fetch(OPENROUTER_VIDEO_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
                'X-Title': 'FreeOR Radar - Video Generation',
            },
            body: JSON.stringify({
                model,
                prompt,
                n: 1,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data?.error?.message || data?.error || 'Unknown error from OpenRouter';
            return NextResponse.json(
                { error: errorMsg },
                { status: response.status }
            );
        }

        // OpenRouter returns: { data: [{ url: string, revised_prompt?: string }] }
        const videoUrl = data?.data?.[0]?.url;
        const revisedPrompt = data?.data?.[0]?.revised_prompt;

        if (!videoUrl) {
            return NextResponse.json(
                {
                    error: lang === 'zh'
                        ? '视频生成失败：未返回视频链接'
                        : 'Video generation failed: no video URL returned'
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            video_url: videoUrl,
            revised_prompt: revisedPrompt || prompt,
            model,
        });

    } catch (err) {
        console.error('[Video Generate] Error:', err);
        return NextResponse.json(
            {
                error: lang === 'zh'
                    ? '服务器错误，请稍后重试'
                    : 'Server error, please try again'
            },
            { status: 500 }
        );
    }
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/video/generate',
        description: 'Proxy to OpenRouter text-to-video generation API',
        body: {
            prompt: 'string (required)',
            model: 'string (optional, default: wan-ai/wan2.1-t2v-turbo)',
            lang: 'string (optional, "zh" | "en")',
        },
        headers: { 'Authorization': 'Bearer <openrouter_key>' },
        supported_models: [
            'wan-ai/wan2.1-t2v-turbo',
            'wan-ai/wan2.1-i2v-480p',
            'google/veo-3.1',
        ],
    });
}
