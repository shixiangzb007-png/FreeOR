/** Video Overview（NotebookLM 式解说视频）类型 */

export type OverviewFormat = 'brief' | 'explainer';
export type OverviewVisualStyle = 'auto' | 'whiteboard' | 'minimal' | 'retro';

export interface OverviewScene {
    index: number;
    narration: string;
    visual_prompt: string;
    duration_sec: number;
    /** data URL or remote URL after image generation */
    image_url?: string;
}

export interface OverviewPlan {
    title: string;
    format: OverviewFormat;
    visual_style: OverviewVisualStyle;
    scenes: OverviewScene[];
    total_duration_sec: number;
    mode: 'llm' | 'rule';
}

export type OverviewJobStatus =
    | 'idle'
    | 'planning'
    | 'generating_images'
    | 'composing'
    | 'done'
    | 'failed';

export interface OverviewJob {
    id: string;
    status: OverviewJobStatus;
    progress: number; // 0-100
    progress_label?: string;
    plan?: OverviewPlan;
    video_blob_url?: string;
    error?: string;
    created_at: string;
}
