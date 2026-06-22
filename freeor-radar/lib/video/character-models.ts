import { VideoModelConfig } from './models';

/** Models recommended for Character Clip (input_references support). */
export const CHARACTER_VIDEO_MODELS: VideoModelConfig[] = [
    { id: 'bytedance/seedance-2.0', name: 'Seedance 2.0', badge: 'PAID', maxDuration: 12, defaultDuration: 10 },
    { id: 'bytedance/seedance-2.0-fast', name: 'Seedance 2.0 Fast', badge: 'PAID', maxDuration: 12, defaultDuration: 10 },
    { id: 'alibaba/wan-2.7', name: 'Wan 2.7', badge: 'PAID', maxDuration: 10, defaultDuration: 10 },
];

export const DEFAULT_CHARACTER_MODEL = CHARACTER_VIDEO_MODELS[0].id;

export function isCharacterCapableModel(modelId: string): boolean {
    return CHARACTER_VIDEO_MODELS.some(m => m.id === modelId);
}

export function getCharacterModelConfig(modelId: string): VideoModelConfig {
    return CHARACTER_VIDEO_MODELS.find(m => m.id === modelId) ?? CHARACTER_VIDEO_MODELS[0];
}

/** Target durations for multi-segment mode (P5-M2). */
export const MULTI_SEGMENT_TARGETS = [20, 30, 36] as const;

export function segmentCountForTarget(targetSec: number, maxPerSegment: number): number {
    return Math.max(1, Math.ceil(targetSec / maxPerSegment));
}
