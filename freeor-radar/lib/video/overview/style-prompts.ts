import { OverviewVisualStyle } from '@/types/overview';
import { appendImageQualityConstraints } from './image-constraints';

const STYLE_PREFIX: Record<OverviewVisualStyle, string> = {
    auto: 'Professional explainer illustration, clear composition, soft lighting, no readable text in scene.',
    whiteboard: 'Clean whiteboard style diagram, simple icons and arrows only, no handwritten letters or numbers, educational infographic.',
    minimal: 'Minimal flat vector illustration, muted palette, modern SaaS aesthetic, no typography in image.',
    retro: 'Retro print poster style, textured paper, bold limited colors, vintage, no words or letters printed.',
};

export function applyVisualStyle(style: OverviewVisualStyle, visualPrompt: string): string {
    const prefix = STYLE_PREFIX[style] ?? STYLE_PREFIX.auto;
    return appendImageQualityConstraints(`${prefix} ${visualPrompt}`);
}
