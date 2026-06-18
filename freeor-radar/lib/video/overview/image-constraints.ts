/**
 * Shared constraints appended to every Overview image prompt.
 * Reduces garbled AI text in images and common anatomy errors (extra hands/limbs).
 */
export const IMAGE_QUALITY_SUFFIX =
    'IMPORTANT: Do not render any text, letters, words, captions, labels, logos, or watermarks in the image. ' +
    'If people appear: exactly two arms and two hands only, anatomically correct proportions, natural pose, ' +
    'no extra limbs, no duplicated hands, no deformed fingers. ' +
    'Prefer symbolic illustrations, objects, landscapes, or diagrams over photorealistic close-up humans.';

/** LLM / rule hints for visual_prompt authoring (English). */
export const VISUAL_PROMPT_GUIDE =
    'Scene without readable text in frame. Avoid tight close-ups of hands or faces. ' +
    'Use editorial illustration or conceptual imagery when explaining abstract topics.';

export function appendImageQualityConstraints(prompt: string): string {
    return `${prompt.trim()} ${IMAGE_QUALITY_SUFFIX}`.trim();
}
