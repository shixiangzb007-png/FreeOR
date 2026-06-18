/**
 * OpenRouter video model limits for duration clamping.
 * Max values are conservative; actual caps vary by provider — OpenRouter
 * rejects out-of-range duration at submit time.
 */
export interface VideoModelConfig {
    id: string;
    name: string;
    badge?: 'PAID' | 'FREE';
    /** Maximum seconds supported by this model slug */
    maxDuration: number;
    /** Default when user has not picked a duration */
    defaultDuration: number;
}

export const VIDEO_MODEL_CONFIGS: VideoModelConfig[] = [
    { id: 'bytedance/seedance-2.0-fast', name: 'Seedance 2.0 Fast', badge: 'PAID', maxDuration: 12, defaultDuration: 10 },
    { id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', badge: 'PAID', maxDuration: 12, defaultDuration: 10 },
    { id: 'kwaivgi/kling-v3.0-std', name: 'Kling v3.0 Std', badge: 'PAID', maxDuration: 10, defaultDuration: 10 },
    { id: 'alibaba/wan-2.7', name: 'Wan 2.7', badge: 'PAID', maxDuration: 10, defaultDuration: 10 },
    { id: 'google/veo-3.1-fast', name: 'Google Veo 3.1 Fast', badge: 'PAID', maxDuration: 8, defaultDuration: 8 },
    { id: 'google/veo-3.1', name: 'Google Veo 3.1', badge: 'PAID', maxDuration: 8, defaultDuration: 8 },
];

const CONFIG_BY_ID = new Map(VIDEO_MODEL_CONFIGS.map(c => [c.id, c]));

export function getVideoModelConfig(modelId: string): VideoModelConfig {
    return CONFIG_BY_ID.get(modelId) ?? {
        id: modelId,
        name: modelId,
        maxDuration: 10,
        defaultDuration: 5,
    };
}

/** Clamp requested duration to [1, model max]. */
export function clampVideoDuration(seconds: number, modelId: string): number {
    const { maxDuration } = getVideoModelConfig(modelId);
    const n = Math.round(seconds);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, maxDuration);
}

/** Preset duration options shown in the UI (filtered per model). */
export const DURATION_PRESETS = [5, 8, 10, 15, 30, 60] as const;

export function durationPresetsForModel(modelId: string): number[] {
    const max = getVideoModelConfig(modelId).maxDuration;
    const presets: number[] = DURATION_PRESETS.filter(d => d <= max);
    if (!presets.includes(max)) presets.push(max);
    return presets.sort((a, b) => a - b);
}
