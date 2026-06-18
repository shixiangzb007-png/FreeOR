import { PromptTemplate, VideoGenPlatform } from '@/types';

export const VIDEO_PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        id: 'product-demo',
        name: '产品演示',
        description: '展示产品功能与使用场景',
        platform: 'all',
        tags: ['产品', '商业', 'SaaS'],
        durationSeconds: 30,
        template: `Create a professional product demonstration video.
Scene: A sleek modern workspace environment.
Subject: {{subject}} being used naturally and intuitively.
Camera: Dynamic shots — wide establishing, tight close-ups on key interactions, smooth tracking shots.
Lighting: Soft professional lighting, blue-tinted background gradient.
Duration: {{duration}} seconds.
Style: Clean, minimal, high-tech. Text overlay: "{{tagline}}".
Mood: Confident, innovative, impressive.`,
    },
    {
        id: 'cinematic-story',
        name: '影视叙事',
        description: '电影感叙事视频',
        platform: 'kling',
        tags: ['电影', '故事', '艺术'],
        durationSeconds: 15,
        template: `A cinematic short film sequence.
Setting: {{setting}}, golden hour lighting, atmospheric depth.
Character: {{character}}, {{emotion}} expression, deliberate movement.
Camera: Slow dolly-in, shallow depth of field (f/1.8), anamorphic lens flare.
Color grading: Teal & orange, high contrast, film grain.
Duration: {{duration}} seconds.
Mood: {{mood}}. 
End on: A meaningful pause, leaving the viewer wanting more.`,
    },
    {
        id: 'social-media',
        name: '社交媒体',
        description: '适合 TikTok/Reels 的短视频',
        platform: 'pika',
        tags: ['社交', '病毒', '快节奏'],
        durationSeconds: 15,
        template: `A viral social media short video.
Hook (first 3 seconds): Eye-catching {{opening_action}} that immediately grabs attention.
Content: Fast-paced showcase of {{content_subject}}.
Style: Trendy, energetic transitions, bold text overlays.
Aspect ratio: 9:16 (vertical).
Color: Vibrant, saturated, high contrast.
Effects: Light leaks, glitch transitions, particle effects.
Duration: {{duration}} seconds.
CTA: "{{call_to_action}}" at the end.`,
    },
    {
        id: 'explainer',
        name: '概念解释',
        description: '清晰解释复杂概念',
        platform: 'genmo',
        tags: ['教育', '科技', '动画'],
        durationSeconds: 30,
        template: `An animated explainer video.
Topic: {{topic}} — explaining {{concept}} in simple terms.
Style: Clean 2D motion graphics, whiteboard animation, or infographic style.
Color palette: {{brand_colors}} or professional blues and greens.
Narration pace: Clear, measured, educational.
Visual metaphors: Use {{metaphor}} to illustrate the concept.
Duration: {{duration}} seconds.
End with: Key takeaway text and brand logo.`,
    },
    {
        id: 'nature-ambient',
        name: '自然环境',
        description: '放松的自然风光视频',
        platform: 'veo',
        tags: ['自然', '冥想', '背景'],
        durationSeconds: 30,
        template: `A serene nature ambient video.
Location: {{location}} — lush, pristine, untouched.
Time of day: {{time}} light, long shadows, dreamy atmosphere.
Camera movement: Extremely slow drone rise, imperceptible movement.
Sound design: Gentle {{natural_sounds}}, no music.
Focus: Ultra-sharp foreground, soft bokeh background.
Wildlife: {{wildlife}} moving naturally, undisturbed.
Duration: {{duration}} seconds seamless loop.
Feeling: Peace, wonder, timelessness.`,
    },
    {
        id: 'brand-story',
        name: '品牌故事',
        description: '传达品牌价值与使命',
        platform: 'runway',
        tags: ['品牌', '情感', '企业'],
        durationSeconds: 30,
        template: `A compelling brand story video.
Brand: {{brand_name}} — {{brand_mission}}.
Narrative arc: Problem → Journey → Transformation → Hope.
Scenes: Real-life moments, authentic emotions, {{industry}} context.
Cinematic style: Documentary-inspired, natural lighting, handheld camera.
Color treatment: Warm tones, {{brand_color}} accents.
Music: Uplifting instrumental, building to climax.
Duration: {{duration}} seconds.
Closing: Brand logo reveal with tagline "{{tagline}}".`,
    },
    {
        id: 'ai-abstract',
        name: 'AI 抽象艺术',
        description: '科幻感 AI 艺术视频',
        platform: 'all',
        tags: ['AI', '抽象', '科幻', '艺术'],
        durationSeconds: 30,
        template: `A mesmerizing AI-generated abstract art video.
Theme: {{theme}} — futuristic, digital, otherworldly.
Visuals: Flowing particle systems, neural network visualizations, liquid metal morphing.
Color: Deep space blacks with {{accent_color}} neon highlights.
Movement: Organic, fluid, hypnotic — as if alive.
Geometry: Sacred geometry patterns evolving and transforming.
Lighting: Internal glow, volumetric light rays, prismatic refraction.
Duration: {{duration}} seconds seamless loop.
Mood: Awe-inspiring, mysterious, transcendent.`,
    },
];

/**
 * Fill template variables with provided values
 */
export function fillTemplate(
    template: PromptTemplate,
    variables: Record<string, string>
): string {
    let filled = template.template;
    for (const [key, value] of Object.entries(variables)) {
        filled = filled.replaceAll(`{{${key}}}`, value);
    }
    return filled;
}

/**
 * Get templates compatible with a specific platform
 */
export function getTemplatesForPlatform(platform: VideoGenPlatform): PromptTemplate[] {
    return VIDEO_PROMPT_TEMPLATES.filter(
        t => t.platform === platform || t.platform === 'all'
    );
}

/**
 * Extract all template variables from a template string
 */
export function extractVariables(templateStr: string): string[] {
    const matches = templateStr.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
}
