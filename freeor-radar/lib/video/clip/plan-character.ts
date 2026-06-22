import { CharacterClipPlan, CharacterClipSegment } from '@/types/character';
import { getCharacterModelConfig, segmentCountForTarget } from '../character-models';
import { buildCharacterVideoPrompt, buildSegmentSystemHint } from '../character-prompt';

const DEFAULT_PLAN_MODEL = 'google/gemini-2.0-flash-001';

interface LlmSegmentRaw {
    prompt?: string;
    duration_sec?: number;
}

function normalizeDuration(raw: unknown, max: number, fallback: number): number {
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return Math.max(3, Math.min(max, Math.round(n)));
    }
    return fallback;
}

export function planCharacterClipRules(
    theme: string,
    targetDurationSec: number,
    model: string,
    characterName: string,
    characterDescription: string,
    lang: string
): CharacterClipPlan {
    const modelCfg = getCharacterModelConfig(model);
    const segmentCount = segmentCountForTarget(targetDurationSec, modelCfg.maxDuration);
    const perSegment = Math.min(modelCfg.maxDuration, Math.ceil(targetDurationSec / segmentCount));

    const beats = splitThemeBeats(theme, segmentCount, lang);

    const segments: CharacterClipSegment[] = beats.map((beat, i) => {
        const hint = buildSegmentSystemHint(i + 1, segmentCount);
        const userPart = hint ? `${hint} ${beat}` : beat;
        return {
            index: i + 1,
            prompt: buildCharacterVideoPrompt(userPart, {
                name: characterName,
                description: characterDescription,
            }),
            duration_sec: perSegment,
        };
    });

    return {
        target_duration_sec: targetDurationSec,
        model,
        segments,
        mode: 'rule',
    };
}

function splitThemeBeats(theme: string, count: number, lang: string): string[] {
    const trimmed = theme.trim();
    if (!trimmed) {
        return Array.from({ length: count }, (_, i) =>
            lang === 'zh' ? `第 ${i + 1} 段场景` : `Scene part ${i + 1}`
        );
    }

    const sentences = trimmed.split(/(?<=[.!?。！？；;])\s*/).filter(Boolean);
    if (sentences.length >= count) {
        const per = Math.ceil(sentences.length / count);
        const out: string[] = [];
        for (let i = 0; i < sentences.length; i += per) {
            out.push(sentences.slice(i, i + per).join(' '));
            if (out.length >= count) break;
        }
        while (out.length < count) out.push(trimmed);
        return out.slice(0, count);
    }

    if (count === 1) return [trimmed];

    const zh = lang === 'zh';
    const templates = zh
        ? ['开场：', '发展：', '高潮：', '结尾：']
        : ['Opening: ', 'Build: ', 'Climax: ', 'Ending: '];

    return Array.from({ length: count }, (_, i) => {
        const prefix = templates[i] ?? (zh ? `第 ${i + 1} 段：` : `Part ${i + 1}: `);
        return `${prefix}${trimmed}`;
    });
}

export async function planCharacterClipLlm(
    theme: string,
    targetDurationSec: number,
    model: string,
    characterName: string,
    characterDescription: string,
    lang: string,
    apiKey: string,
    planModel: string = DEFAULT_PLAN_MODEL
): Promise<CharacterClipPlan | null> {
    const modelCfg = getCharacterModelConfig(model);
    const segmentCount = segmentCountForTarget(targetDurationSec, modelCfg.maxDuration);
    const perSegment = Math.min(modelCfg.maxDuration, Math.ceil(targetDurationSec / segmentCount));
    const zh = lang === 'zh';

    const systemPrompt = zh
        ? `你是分镜编剧。输出 JSON（无 markdown）：{"segments":[{"prompt":"英文或中文动作场景描述（不含外貌，外貌由参考图提供）","duration_sec":数字}]}
恰好 ${segmentCount} 段；每段约 ${perSegment} 秒；围绕同一角色 "${characterName}" 的连续叙事。
规则：prompt 只描述动作/场景/镜头；不要重复角色外貌；段与段叙事连贯。`
        : `Storyboard writer. JSON only: {"segments":[{"prompt":"action/scene description (no appearance — references handle look)","duration_sec":number}]}
Exactly ${segmentCount} segments, ~${perSegment}s each, continuous story for character "${characterName}".`;

    const userContent = zh
        ? `主题/剧情：${theme.slice(0, 4000)}\n角色备注：${characterDescription.slice(0, 500)}`
        : `Theme/story: ${theme.slice(0, 4000)}\nCharacter notes: ${characterDescription.slice(0, 500)}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://freeor.app',
            'X-Title': 'FreeOR Radar Character Clip',
        },
        body: JSON.stringify({
            model: planModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            temperature: 0.35,
            max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(60_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return null;

    const raw = (data?.choices?.[0]?.message?.content || '') as string;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let parsed: { segments?: LlmSegmentRaw[] };
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }

    if (!parsed.segments?.length) return null;

    const segments: CharacterClipSegment[] = parsed.segments.slice(0, segmentCount).map((s, i) => {
        const action = (s.prompt || theme).trim();
        const hint = buildSegmentSystemHint(i + 1, segmentCount);
        const userPart = hint ? `${hint} ${action}` : action;
        return {
            index: i + 1,
            prompt: buildCharacterVideoPrompt(userPart, {
                name: characterName,
                description: characterDescription,
            }),
            duration_sec: normalizeDuration(s.duration_sec, modelCfg.maxDuration, perSegment),
        };
    });

    while (segments.length < segmentCount) {
        const i = segments.length;
        const hint = buildSegmentSystemHint(i + 1, segmentCount);
        segments.push({
            index: i + 1,
            prompt: buildCharacterVideoPrompt(`${hint} ${theme}`, {
                name: characterName,
                description: characterDescription,
            }),
            duration_sec: perSegment,
        });
    }

    return {
        target_duration_sec: targetDurationSec,
        model,
        segments,
        mode: 'llm',
    };
}

export async function planCharacterClip(
    theme: string,
    targetDurationSec: number,
    model: string,
    characterName: string,
    characterDescription: string,
    lang: string,
    apiKey?: string
): Promise<CharacterClipPlan> {
    if (apiKey) {
        try {
            const llm = await planCharacterClipLlm(
                theme,
                targetDurationSec,
                model,
                characterName,
                characterDescription,
                lang,
                apiKey
            );
            if (llm) return llm;
        } catch {
            // fallback
        }
    }
    return planCharacterClipRules(
        theme,
        targetDurationSec,
        model,
        characterName,
        characterDescription,
        lang
    );
}
