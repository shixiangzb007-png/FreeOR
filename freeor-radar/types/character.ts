/** Character Clip — user-defined character for reference-to-video generation */

export type CharacterContentType = 'illustration' | 'original_character';

export type CharacterImageLabel = 'front' | 'side' | 'full' | 'other';

export interface CharacterImage {
    id: string;
    /** Local cache (data URL) */
    data_url?: string;
    /** Public HTTPS URL (Supabase Storage) */
    url?: string;
    storage_path?: string;
    label?: CharacterImageLabel;
}

export interface VideoCharacter {
    id: string;
    name: string;
    description: string;
    images: CharacterImage[];
    content_type?: CharacterContentType;
    is_overview_host?: boolean;
    created_at: string;
    updated_at: string;
    /** True when loaded from / persisted to cloud */
    synced?: boolean;
}

export interface CharacterClipSegment {
    index: number;
    prompt: string;
    duration_sec: number;
    video_url?: string;
    status?: 'pending' | 'processing' | 'done' | 'failed';
    error?: string;
}

export interface CharacterClipPlan {
    target_duration_sec: number;
    model: string;
    segments: CharacterClipSegment[];
    mode: 'llm' | 'rule';
}

export type CharacterClipJobStatus =
    | 'idle'
    | 'planning'
    | 'generating'
    | 'stitching'
    | 'done'
    | 'failed';

export interface CharacterClipJob {
    id: string;
    character_id: string;
    character_name: string;
    status: CharacterClipJobStatus;
    progress: number;
    progress_label?: string;
    plan?: CharacterClipPlan;
    final_video_url?: string;
    error?: string;
    created_at: string;
}

export type CharacterFeedbackMode = 'single' | 'multi' | 'overview_host';

export interface CharacterFeedbackStats {
    character_id: string;
    up: number;
    down: number;
    score: number;
}
