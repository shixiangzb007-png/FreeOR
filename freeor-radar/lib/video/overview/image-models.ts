/**
 * OpenRouter image-generation model slugs (verified 2026-06).
 * @see https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */

export type ImageModelKind = 'image_only' | 'multimodal';

export interface OverviewImageModel {
    id: string;
    name: string;
    kind: ImageModelKind;
    /** Lower = try first when using auto fallback chain */
    priority: number;
}

/** Default for Overview (12+ images per job — prefer fast/cheap). */
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/flux.2-klein-4b';

export const OVERVIEW_IMAGE_MODELS: OverviewImageModel[] = [
    {
        id: 'black-forest-labs/flux.2-klein-4b',
        name: 'FLUX.2 Klein 4B',
        kind: 'image_only',
        priority: 1,
    },
    {
        id: 'black-forest-labs/flux.2-flex',
        name: 'FLUX.2 Flex',
        kind: 'image_only',
        priority: 2,
    },
    {
        id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image',
        kind: 'multimodal',
        priority: 3,
    },
    {
        id: 'black-forest-labs/flux.2-pro',
        name: 'FLUX.2 Pro',
        kind: 'image_only',
        priority: 4,
    },
];

const BY_ID = new Map(OVERVIEW_IMAGE_MODELS.map(m => [m.id, m]));

export function getOverviewImageModel(modelId: string): OverviewImageModel | undefined {
    return BY_ID.get(modelId);
}

/** OpenRouter modalities param per model family. */
export function imageModalitiesForModel(modelId: string): ('image' | 'text')[] {
    const meta = getOverviewImageModel(modelId);
    if (meta?.kind === 'multimodal') return ['image', 'text'];
    // FLUX and other image-only models
    return ['image'];
}

/** Models to try in order when the requested slug fails or is invalid. */
export function imageModelFallbackChain(requestedId?: string): string[] {
    const ids = new Set<string>();
    if (requestedId) ids.add(requestedId);
    for (const m of [...OVERVIEW_IMAGE_MODELS].sort((a, b) => a.priority - b.priority)) {
        ids.add(m.id);
    }
    return Array.from(ids);
}

export function isKnownImageModel(modelId: string): boolean {
    return BY_ID.has(modelId);
}
