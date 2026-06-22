import { NextRequest, NextResponse } from 'next/server';
import { planCharacterClip } from '@/lib/video/clip/plan-character';
import { isCharacterCapableModel } from '@/lib/video/character-models';

/**
 * POST /api/video/clip/plan
 * Body: { theme, target_duration_sec, model, character_name, character_description?, lang? }
 * Header: Authorization: Bearer <openrouter_key> (optional, enables LLM segments)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let theme = '';
    let targetDurationSec = 30;
    let model = 'bytedance/seedance-2.0';
    let characterName = '';
    let characterDescription = '';
    let lang = 'zh';

    try {
        const body = await req.json();
        theme = (body.theme || '').trim();
        if (body.target_duration_sec != null) {
            targetDurationSec = Math.max(8, Math.min(60, Number(body.target_duration_sec) || 30));
        }
        if (body.model) model = body.model;
        characterName = (body.character_name || '').trim();
        characterDescription = (body.character_description || '').trim();
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';

    if (!theme || theme.length < 4) {
        return NextResponse.json(
            { error: zh ? '请提供至少 4 字的场景/剧情描述' : 'Provide a scene/story (min 4 chars)' },
            { status: 400 }
        );
    }
    if (!characterName) {
        return NextResponse.json(
            { error: zh ? '请提供角色名称' : 'Character name required' },
            { status: 400 }
        );
    }
    if (!isCharacterCapableModel(model)) {
        return NextResponse.json(
            { error: zh ? '所选模型不支持角色参考图' : 'Model does not support character references' },
            { status: 400 }
        );
    }

    const apiKey = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();

    try {
        const plan = await planCharacterClip(
            theme,
            targetDurationSec,
            model,
            characterName,
            characterDescription,
            lang,
            apiKey || undefined
        );
        return NextResponse.json({ plan });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Plan failed';
        return NextResponse.json({ error: msg }, { status: 502 });
    }
}
