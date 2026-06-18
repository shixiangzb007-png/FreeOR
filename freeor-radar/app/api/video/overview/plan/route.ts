import { NextRequest, NextResponse } from 'next/server';
import { OverviewFormat, OverviewVisualStyle } from '@/types/overview';
import { planStoryboard } from '@/lib/video/overview/plan-llm';

/**
 * POST /api/video/overview/plan
 * Body: { source_text, format?: 'brief'|'explainer', visual_style?, lang? }
 * Header: Authorization: Bearer <openrouter_key> (optional; enables LLM storyboard)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let sourceText = '';
    let format: OverviewFormat = 'brief';
    let visualStyle: OverviewVisualStyle = 'auto';
    let lang = 'zh';

    try {
        const body = await req.json();
        sourceText = (body.source_text || '').trim();
        if (body.format === 'explainer') format = 'explainer';
        if (body.visual_style) visualStyle = body.visual_style;
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';
    if (!sourceText || sourceText.length < 20) {
        return NextResponse.json(
            { error: zh ? '请提供至少 20 字的资料或主题描述' : 'Provide at least 20 characters of source text' },
            { status: 400 }
        );
    }

    const apiKey = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();

    try {
        const plan = await planStoryboard(sourceText, format, visualStyle, lang, apiKey || undefined);
        return NextResponse.json({ plan });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Plan failed';
        return NextResponse.json({ error: msg }, { status: 502 });
    }
}
