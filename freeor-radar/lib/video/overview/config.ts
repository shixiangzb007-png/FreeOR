import { OverviewFormat } from '@/types/overview';

export { DEFAULT_IMAGE_MODEL, OVERVIEW_IMAGE_MODELS } from './image-models';

export const DEFAULT_PLAN_MODEL = 'google/gemini-2.0-flash-001';

export interface FormatTarget {
    label: string;
    targetDurationSec: number;
    sceneCount: number;
    defaultSceneDurationSec: number;
}

export const FORMAT_TARGETS: Record<OverviewFormat, FormatTarget> = {
    brief: {
        label: 'Brief (~3 min)',
        targetDurationSec: 180,
        sceneCount: 12,
        defaultSceneDurationSec: 15,
    },
    explainer: {
        label: 'Explainer (~5 min)',
        targetDurationSec: 300,
        sceneCount: 20,
        defaultSceneDurationSec: 15,
    },
};

/** Estimate scene duration from narration length (~140 wpm zh/en mix). */
export function estimateSceneDuration(narration: string, fallback: number): number {
    const words = narration.trim().split(/\s+/).filter(Boolean).length;
    const chars = narration.replace(/\s/g, '').length;
    const units = Math.max(words, Math.ceil(chars / 4));
    const sec = Math.round((units / 140) * 60);
    return Math.max(8, Math.min(25, sec || fallback));
}

/** Coerce LLM/API duration values to a safe integer seconds. */
export function normalizeSceneDuration(
    raw: unknown,
    narration: string,
    fallback: number
): number {
    const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return Math.max(8, Math.min(25, Math.round(n)));
    }
    return estimateSceneDuration(narration, fallback);
}
