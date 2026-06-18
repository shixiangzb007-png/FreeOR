import { OverviewFormat, OverviewPlan, OverviewScene, OverviewVisualStyle } from '@/types/overview';
import { DEFAULT_PLAN_MODEL, FORMAT_TARGETS, normalizeSceneDuration } from './config';
import { buildSceneVisualPrompt, planStoryboardRules, splitIntoChunks } from './plan-rules';

interface LlmSceneRaw {
    narration?: string;
    visual_prompt?: string;
    duration_sec?: number;
}

function padScenesToTarget(
    scenes: OverviewScene[],
    sourceText: string,
    format: OverviewFormat,
    lang: string
): OverviewScene[] {
    const target = FORMAT_TARGETS[format];
    if (scenes.length >= target.sceneCount) {
        return scenes.slice(0, target.sceneCount);
    }

    const chunks = splitIntoChunks(sourceText, target.sceneCount);
    const padded: OverviewScene[] = [...scenes];

    for (let i = scenes.length; i < target.sceneCount && i < chunks.length; i++) {
        const narration = chunks[i].slice(0, 500);
        padded.push({
            index: i + 1,
            narration,
            visual_prompt: buildSceneVisualPrompt(narration, lang),
            duration_sec: normalizeSceneDuration(undefined, narration, target.defaultSceneDurationSec),
        });
    }

    return padded.map((s, i) => ({ ...s, index: i + 1 }));
}

export async function planStoryboardLlm(
    sourceText: string,
    format: OverviewFormat,
    visualStyle: OverviewVisualStyle,
    lang: string,
    apiKey: string,
    model: string = DEFAULT_PLAN_MODEL
): Promise<OverviewPlan | null> {
    const target = FORMAT_TARGETS[format];
    const zh = lang === 'zh';

    const systemPrompt = zh
        ? `你是视频分镜编剧。根据用户提供的资料，输出 JSON（不要 markdown），结构：
{"title":"标题","scenes":[{"narration":"旁白（1-3句，中文）","visual_prompt":"英文或中文画面描述（供图像模型）","duration_sec":数字}]}
要求：
- 恰好 ${target.sceneCount} 个场景；总时长约 ${target.targetDurationSec} 秒；旁白连贯
- 用户资料是唯一事实来源：旁白只能改写/摘要用户资料，禁止编造资料中没有的主题、案例或数据
- 每个场景的 narration 必须对应资料中的不同片段，visual_prompt 必须描述该场景 narration 的具体内容
- visual_prompt：禁止画面内出现任何文字/字母/标签；尽量避免写实人物特写；若有人物则仅两只手臂、解剖正确；优先用示意图、物体、场景、图标`
        : `You are a video storyboard writer. Output JSON only (no markdown):
{"title":"...","scenes":[{"narration":"voiceover 1-3 sentences","visual_prompt":"image prompt","duration_sec":number}]}
Requirements:
- Exactly ${target.sceneCount} scenes; total ~${target.targetDurationSec}s; coherent narrative
- User source text is the ONLY factual basis — do not invent topics, examples, or data not in the source
- Each scene narration must cover a distinct portion of the source; visual_prompt must depict THAT scene's narration
- visual_prompt: NO text/letters/labels in the image; avoid photorealistic human close-ups; prefer diagrams, objects, landscapes, icons`;

    const userContent = zh
        ? `请严格基于以下资料创作 ${target.sceneCount} 个分镜（不要偏离主题）：\n\n${sourceText.slice(0, 12000)}`
        : `Create exactly ${target.sceneCount} storyboard scenes strictly from this source (stay on topic):\n\n${sourceText.slice(0, 12000)}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://freeor.app',
            'X-Title': 'FreeOR Radar Overview',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            max_tokens: 8192,
        }),
        signal: AbortSignal.timeout(90_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) return null;

    const raw = (data?.choices?.[0]?.message?.content || '') as string;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    let parsed: { title?: string; scenes?: LlmSceneRaw[] };
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }

    if (!parsed.scenes || parsed.scenes.length === 0) return null;

    let scenes: OverviewScene[] = parsed.scenes
        .map((s, i) => {
            const narration = (s.narration || '').trim();
            const visual_prompt = (s.visual_prompt || '').trim() || buildSceneVisualPrompt(narration, lang);
            return {
                index: i + 1,
                narration,
                visual_prompt,
                duration_sec: normalizeSceneDuration(
                    s.duration_sec,
                    narration,
                    target.defaultSceneDurationSec
                ),
            };
        })
        .filter(s => s.narration.length > 0);

    if (scenes.length === 0) return null;

    scenes = padScenesToTarget(scenes, sourceText, format, lang);

    if (scenes.length < Math.min(3, target.sceneCount)) return null;

    return {
        title: (parsed.title || '').trim() || sourceText.slice(0, 60),
        format,
        visual_style: visualStyle,
        scenes,
        total_duration_sec: scenes.reduce((sum, s) => sum + s.duration_sec, 0),
        mode: 'llm',
    };
}

export async function planStoryboard(
    sourceText: string,
    format: OverviewFormat,
    visualStyle: OverviewVisualStyle,
    lang: string,
    apiKey?: string
): Promise<OverviewPlan> {
    if (apiKey) {
        try {
            const llm = await planStoryboardLlm(sourceText, format, visualStyle, lang, apiKey);
            if (llm) return llm;
        } catch {
            // fall through to rules
        }
    }
    return planStoryboardRules(sourceText, format, visualStyle, lang);
}
