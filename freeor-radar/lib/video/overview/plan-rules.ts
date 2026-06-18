import { OverviewFormat, OverviewPlan, OverviewScene, OverviewVisualStyle } from '@/types/overview';
import { FORMAT_TARGETS, estimateSceneDuration } from './config';
import { VISUAL_PROMPT_GUIDE } from './image-constraints';

/** Evenly split text into N chunks (used when paragraph/sentence split yields too few). */
export function splitEvenlyByChars(text: string, count: number): string[] {
    const trimmed = text.trim();
    if (!trimmed || count <= 0) return [];

    const size = Math.max(1, Math.ceil(trimmed.length / count));
    const chunks: string[] = [];
    for (let i = 0; i < trimmed.length; i += size) {
        const chunk = trimmed.slice(i, i + size).trim();
        if (chunk) chunks.push(chunk);
        if (chunks.length >= count) break;
    }
    return chunks.length > 0 ? chunks : [trimmed];
}

export function splitIntoChunks(text: string, maxChunks: number): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const paragraphs = trimmed
        .split(/\n\s*\n+/)
        .map(p => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    let chunks: string[];

    if (paragraphs.length >= maxChunks) {
        chunks = paragraphs.slice(0, maxChunks);
    } else {
        const sentences = trimmed.replace(/\n+/g, ' ').split(/(?<=[.!?。！？；;])\s*/).filter(Boolean);
        if (sentences.length >= maxChunks) {
            const perChunk = Math.ceil(sentences.length / maxChunks);
            chunks = [];
            for (let i = 0; i < sentences.length; i += perChunk) {
                chunks.push(sentences.slice(i, i + perChunk).join(' '));
                if (chunks.length >= maxChunks) break;
            }
        } else if (sentences.length > 1) {
            const perChunk = Math.ceil(sentences.length / maxChunks);
            chunks = [];
            for (let i = 0; i < sentences.length; i += perChunk) {
                chunks.push(sentences.slice(i, i + perChunk).join(' '));
                if (chunks.length >= maxChunks) break;
            }
        } else {
            chunks = [];
        }
    }

    // Ensure we always produce enough scenes (fixes single-segment videos).
    if (chunks.length < maxChunks) {
        chunks = splitEvenlyByChars(trimmed, maxChunks);
    }

    return chunks.slice(0, maxChunks).filter(Boolean);
}

/** Build image prompt from narration — keep source language so models stay on-topic. */
export function buildSceneVisualPrompt(narration: string, lang: string): string {
    const excerpt = narration.slice(0, 280).replace(/\s+/g, ' ').trim();
    if (lang === 'zh') {
        return (
            `Educational illustration that literally depicts this scene: 「${excerpt}」. ` +
            `The image must match this specific topic, not a generic stock scene. ${VISUAL_PROMPT_GUIDE}`
        );
    }
    return (
        `Educational illustration that literally depicts: "${excerpt}". ` +
        `The image must match this specific topic, not a generic stock scene. ${VISUAL_PROMPT_GUIDE}`
    );
}

export function planStoryboardRules(
    sourceText: string,
    format: OverviewFormat,
    visualStyle: OverviewVisualStyle,
    lang: string
): OverviewPlan {
    const target = FORMAT_TARGETS[format];
    const chunks = splitIntoChunks(sourceText.trim(), target.sceneCount);
    const zh = lang === 'zh';

    const scenes: OverviewScene[] = chunks.map((chunk, i) => {
        const narration = chunk.slice(0, 500);
        return {
            index: i + 1,
            narration,
            visual_prompt: buildSceneVisualPrompt(narration, lang),
            duration_sec: estimateSceneDuration(narration, target.defaultSceneDurationSec),
        };
    });

    const total_duration_sec = scenes.reduce((s, sc) => s + sc.duration_sec, 0);
    const title = sourceText.trim().slice(0, 60) + (sourceText.length > 60 ? '…' : '');

    return {
        title: title || (zh ? '视频概览' : 'Video Overview'),
        format,
        visual_style: visualStyle,
        scenes,
        total_duration_sec,
        mode: 'rule',
    };
}
