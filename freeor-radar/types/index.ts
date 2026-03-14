// ============================================================
// FreeOR Radar - Global TypeScript Type Definitions
// Updated per Skill: OpenRouter Data Sync v1
// ============================================================

// ── Core Model ───────────────────────────────────────────────

export interface FreeModel {
  /** OpenRouter model ID, e.g. "meta-llama/llama-3.1-8b-instruct:free" */
  id: string;
  name: string;
  provider: string | null;
  /** Original model description from OpenRouter */
  description: string | null;
  /** Context window length in tokens */
  context: number | null;
  /** architecture.modality from OpenRouter API */
  modality: string | null;
  /** Derived capability tags: ["vision","tool","coding"] */
  capabilities: string[];
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  throughput_tokens_per_s: number | null;
  latency_ms: number | null;
  /** ISO8601 timestamp of last sync */
  last_updated: string;
  /** True while model remains in OpenRouter free list */
  is_free: boolean;
  /**
   * Skill-mandated field.
   * True if description or modality contains video/multimodal keywords.
   */
  is_video_supported: boolean;
  /** Raw per_request_limits JSON from OpenRouter API */
  per_request_limits: Record<string, unknown> | null;
  /** Derived level: 'high' | 'standard' | 'low' | 'unknown' */
  rate_limit_level: string;
}

// ── Change Tracking ──────────────────────────────────────────

export type ChangeType = 'new' | 'limit_change' | 'removed' | 'restored';

export interface ChangeLog {
  id: number;
  model_id: string | null;
  change_type: ChangeType;
  description: string | null;
  old_data: Partial<FreeModel> | null;
  new_data: Partial<FreeModel> | null;
  created_at: string;
  /** Joined model record (optional) */
  model?: FreeModel;
}

// ── Video Credits ────────────────────────────────────────────

export interface VideoCredit {
  tool: string;
  daily_credits: number;
  used_today: number;
  updated_at: string;
  reset_at: string | null;
  color?: string;
}

// ── User / Notifications ─────────────────────────────────────

export interface UserPreferences {
  user_id: string;
  favorite_models: string[];
  preferred_capabilities: string[];
  notification_enabled: boolean;
  created_at: string;
}

export type NotificationChannel = 'telegram' | 'discord' | 'email';

export interface NotificationSubscription {
  id: number;
  user_id: string;
  channel: NotificationChannel;
  target: string;
  event_types: ChangeType[];
  is_active: boolean;
  created_at: string;
}

// ── OpenRouter API Raw Shapes ─────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  architecture: {
    /** e.g. "text->text", "text+image->text", "text->image,video" */
    modality: string;
    tokenizer: string;
  };
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: Record<string, unknown> | null;
}

export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

// ── Sync Internals ────────────────────────────────────────────

/** Result of diffing new vs existing models */
export interface ModelDiff {
  added: FreeModel[];
  removed: FreeModel[];
  changed: Array<{
    model: FreeModel;
    changes: Record<string, { old: unknown; new: unknown }>;
  }>;
}

/** Shape returned by POST /api/cron */
export interface CronResult {
  success: boolean;
  updated: number;
  added: number;
  removed: number;
  notified: boolean;
  duration_ms?: number;
  logs?: import('@/lib/openrouter/sync-logger').SyncLogEntry[];
  error?: string;
}

// ── UI / Feature Types ────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  platform: VideoGenPlatform;
  tags: string[];
}

export type VideoGenPlatform = 'kling' | 'veo' | 'runway' | 'genmo' | 'pika' | 'higgsfield' | 'openart' | 'all';

export interface RecommendResult {
  best_model: FreeModel;
  reason: string;
  risk_warnings: string[];
  alternatives: FreeModel[];
  wrapper_code: {
    python: string;
    javascript: string;
    curl: string;
  };
}

export interface ModelTableFilters {
  search: string;
  capabilities: string[];
  videoOnly: boolean;
  sortBy: 'context' | 'latency' | 'last_updated';
  sortOrder: 'asc' | 'desc';
}
