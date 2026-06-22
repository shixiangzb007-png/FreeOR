import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_IMAGE_MODEL } from '@/lib/video/overview/config';
import { applyVisualStyle } from '@/lib/video/overview/style-prompts';
import { OverviewVisualStyle } from '@/types/overview';
import {
    imageModalitiesForModel,
    imageModelFallbackChain,
} from '@/lib/video/overview/image-models';
import { buildHostVisualPrompt } from '@/lib/video/character-prompt';

/**
 * POST /api/video/overview/image
 * Body: { prompt, narration?, visual_style?, model?, lang?, reference_urls?, host_name?, host_description? }
 * Header: Authorization: Bearer <openrouter_key> (required)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let prompt = '';
    let narration = '';
    let visualStyle: OverviewVisualStyle = 'auto';
    let model = DEFAULT_IMAGE_MODEL;
    let lang = 'zh';
    let referenceUrls: string[] = [];
    let hostName = '';
    let hostDescription = '';

    try {
        const body = await req.json();
        prompt = (body.prompt || '').trim();
        narration = (body.narration || '').trim();
        if (body.visual_style) visualStyle = body.visual_style;
        if (body.model) model = body.model;
        if (body.lang) lang = body.lang;
        if (Array.isArray(body.reference_urls)) {
            referenceUrls = body.reference_urls
                .filter((u: unknown) => typeof u === 'string' && (u.startsWith('https://') || u.startsWith('data:image')))
                .slice(0, 3);
        }
        if (body.host_name) hostName = String(body.host_name).slice(0, 64);
        if (body.host_description) hostDescription = String(body.host_description).slice(0, 300);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';
    if (!prompt) {
        return NextResponse.json({ error: zh ? '缺少 prompt' : 'Missing prompt' }, { status: 400 });
    }

    const apiKey = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!apiKey) {
        return NextResponse.json(
            { error: zh ? '需要 OpenRouter API Key' : 'OpenRouter API Key required' },
            { status: 401 }
        );
    }

    let fullPrompt = applyVisualStyle(visualStyle, prompt);
    if (referenceUrls.length > 0) {
        fullPrompt = buildHostVisualPrompt(fullPrompt, {
            name: hostName || 'Host',
            description: hostDescription,
        });
    }
    if (narration && !prompt.includes(narration.slice(0, 40))) {
        const anchor = narration.slice(0, 220);
        fullPrompt = `${fullPrompt} Scene must illustrate this narration: 「${anchor}」`;
    }

    const candidates = imageModelFallbackChain(model);
    let lastError = '';

    for (const candidate of candidates) {
        const result = await requestImage(apiKey, candidate, fullPrompt, referenceUrls);
        if (result.ok) {
            const image_url = await normalizeImageUrl(result.url, apiKey);
            return NextResponse.json({ image_url, model: candidate });
        }
        lastError = result.error;
        // Stop chaining on auth/billing errors
        if (result.stop) {
            return NextResponse.json({ error: lastError }, { status: result.status });
        }
    }

    return NextResponse.json(
        { error: lastError || (zh ? '图像生成失败' : 'Image generation failed') },
        { status: 502 }
    );
}

async function requestImage(
    apiKey: string,
    model: string,
    prompt: string,
    referenceUrls: string[] = []
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number; stop?: boolean }> {
    try {
        const userContent = referenceUrls.length > 0
            ? [
                { type: 'text', text: prompt },
                ...referenceUrls.map(url => ({
                    type: 'image_url',
                    image_url: { url },
                })),
            ]
            : prompt;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://freeor.app',
                'X-Title': 'FreeOR Radar Overview Image',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: userContent }],
                modalities: imageModalitiesForModel(model),
            }),
            signal: AbortSignal.timeout(120_000),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const apiMsg = (data?.error?.message as string) || `HTTP ${response.status}`;
            const invalidModel = /not a valid model/i.test(apiMsg);
            return {
                ok: false,
                error: apiMsg,
                status: response.status,
                stop: response.status === 401 || response.status === 402 || (!invalidModel && response.status < 500),
            };
        }

        const message = data?.choices?.[0]?.message;
        const images = message?.images as Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }> | undefined;
        const url =
            images?.[0]?.image_url?.url ||
            images?.[0]?.imageUrl?.url ||
            extractInlineImage(message?.content);

        if (!url) {
            return { ok: false, error: 'No image in model response', status: 502 };
        }
        return { ok: true, url };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Image request failed';
        return { ok: false, error: msg, status: 502 };
    }
}

function extractInlineImage(content: unknown): string | null {
    if (typeof content === 'string' && content.startsWith('data:image')) return content;
    if (Array.isArray(content)) {
        for (const part of content) {
            if (part?.type === 'image_url' && part.image_url?.url) return part.image_url.url;
        }
    }
    return null;
}

async function normalizeImageUrl(url: string, apiKey: string): Promise<string> {
    if (url.startsWith('data:image')) return url;
    try {
        const res = await fetch(url, {
            headers: url.includes('openrouter.ai') ? { Authorization: `Bearer ${apiKey}` } : {},
            signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) return url;
        const buf = await res.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        const mime = res.headers.get('content-type') || 'image/png';
        return `data:${mime};base64,${b64}`;
    } catch {
        return url;
    }
}
