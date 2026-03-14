// ============================================================
// FreeOR Radar - OpenRouter API Fetcher
// Skill: OpenRouter Data Sync — Step 1 & 2
// Features: timeout, exponential-backoff retry, isVideoSupported
// ============================================================

import { FreeModel, OpenRouterModel, OpenRouterResponse } from '@/types';
import { syncLog, sleep } from './sync-logger';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

// Keywords that indicate video/multimodal support (Skill Step 2)
const VIDEO_KEYWORDS = [
    'video',
    'multimodal',
    'image-to-video',
    'text-to-video',
    'vision',
    'visual',
    'image',
];

/**
 * Derive a human-readable rate limit level from OpenRouter per_request_limits.
 * Thresholds based on observed OpenRouter free tier policies.
 */
function deriveRateLimitLevel(limits: Record<string, unknown> | null | undefined): string {
    if (!limits) return 'unknown';
    // OpenRouter format: { "prompt_tokens": "20000", "completion_tokens": "5000" }
    const raw = limits['prompt_tokens'] ?? limits['prompt'] ?? limits['tokens'];
    const promptLimit = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
    if (isNaN(promptLimit) || promptLimit <= 0) return 'unknown';
    if (promptLimit >= 200_000) return 'high';
    if (promptLimit >= 50_000)  return 'standard';
    return 'low';
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Fetch all free models from OpenRouter API.
 * No API key required. Has retry + timeout logic.
 * Returns normalized FreeModel[] with is_video_supported flag.
 */
export async function fetchFreeModels(): Promise<FreeModel[]> {
    const startTime = Date.now();
    syncLog('info', 'Starting OpenRouter model fetch...');

    let rawResponse: OpenRouterResponse;

    try {
        const res = await fetchWithRetry(OPENROUTER_MODELS_URL, {
            headers: {
                'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
                'X-Title': 'FreeOR Radar',
            },
            // Bypass Next.js cache — always fresh
            cache: 'no-store',
        });

        if (!res.ok) {
            const msg = `OpenRouter API returned ${res.status} ${res.statusText}`;
            syncLog('error', msg);
            throw new Error(msg);
        }

        rawResponse = await res.json() as OpenRouterResponse;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        syncLog('error', `Fetch failed after ${MAX_RETRIES} attempts: ${msg}`);
        throw err;
    }

    const totalModels = rawResponse.data?.length ?? 0;
    const freeModels = rawResponse.data
        .filter(isModelFree)
        .map(normalizeModel);

    const duration = Date.now() - startTime;

    syncLog(
        'info',
        `Fetched ${totalModels} total models, ${freeModels.length} free, in ${duration}ms`,
        {
            videoSupported: freeModels.filter(m => m.is_video_supported).length,
        }
    );

    return freeModels;
}

/**
 * Get provider display name from model id or provider slug.
 */
export function getProviderDisplayName(provider: string): string {
    const providerMap: Record<string, string> = {
        'meta-llama': 'Meta',
        'mistralai': 'Mistral',
        'google': 'Google',
        'anthropic': 'Anthropic',
        'openai': 'OpenAI',
        'deepseek': 'DeepSeek',
        'qwen': 'Alibaba',
        'microsoft': 'Microsoft',
        'cohere': 'Cohere',
        'nvidia': 'NVIDIA',
    };
    return providerMap[provider] || provider;
}

// ─── Filter ───────────────────────────────────────────────────

/**
 * Skill Step 2 — Core free condition:
 * pricing.prompt == "0" AND pricing.completion == "0"
 */
function isModelFree(model: OpenRouterModel): boolean {
    return (
        model.pricing?.prompt === '0' &&
        model.pricing?.completion === '0'
    );
}

// ─── Video Detection ──────────────────────────────────────────

/**
 * Skill Step 2 — isVideoSupported detection.
 * Checks both description and architecture.modality for video keywords.
 */
function detectVideoSupport(model: OpenRouterModel): boolean {
    const desc = (model.description || '').toLowerCase();
    const modality = (model.architecture?.modality || '').toLowerCase();
    return VIDEO_KEYWORDS.some(kw => desc.includes(kw) || modality.includes(kw));
}

// ─── Normalizer ───────────────────────────────────────────────

/**
 * Skill Step 2 — Normalize raw OpenRouter model to our FreeModel shape.
 * Extracts all required fields and derives capabilities.
 */
function normalizeModel(model: OpenRouterModel): FreeModel {
    const capabilities: string[] = [];
    const modality = model.architecture?.modality || '';
    const isVideoSupported = detectVideoSupport(model);

    // Capability derivation
    if (modality.includes('image') || isVideoSupported) {
        capabilities.push('vision');
    }
    if (
        model.id.includes('coder') ||
        model.id.includes('code') ||
        (model.description || '').toLowerCase().includes('code')
    ) {
        capabilities.push('coding');
    }
    // Tool use heuristic — models known to support function calling
    const toolProviders = ['meta-llama', 'mistralai', 'qwen', 'deepseek', 'google', 'openai'];
    const provider = model.id.includes('/') ? model.id.split('/')[0] : 'unknown';
    if (toolProviders.includes(provider)) {
        capabilities.push('tool');
    }

    return {
        id: model.id,
        name: model.name,
        provider: provider !== 'unknown' ? provider : null,
        description: model.description ?? null,
        context: model.context_length ?? null,
        modality: modality || null,
        capabilities,
        pricing: model.pricing,
        throughput_tokens_per_s: null,
        latency_ms: null,
        last_updated: new Date().toISOString(),
        is_free: true,
        is_video_supported: isVideoSupported,
        per_request_limits: model.per_request_limits ?? null,
        rate_limit_level: deriveRateLimitLevel(model.per_request_limits),
    };
}

// ─── Retry Logic ─────────────────────────────────────────────

/**
 * Skill Step 1 — fetch with AbortController timeout + exponential backoff retry.
 * Timeout: 10s per attempt. Retries: up to 3 times (delays: 1s, 2s, 4s).
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = MAX_RETRIES
): Promise<Response> {
    let lastError: Error = new Error('Unknown fetch error');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            syncLog('info', `Fetch attempt ${attempt}/${maxRetries} — ${url}`);
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response; // Success — return immediately
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err instanceof Error ? err : new Error(String(err));

            const isAborted = lastError.name === 'AbortError';
            const errType = isAborted ? 'timeout' : 'network error';

            if (attempt < maxRetries) {
                const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                syncLog('warn', `Retry ${attempt}/${maxRetries} after ${errType} — waiting ${backoffMs}ms`);
                await sleep(backoffMs);
            } else {
                syncLog('error', `All ${maxRetries} retries exhausted after ${errType}: ${lastError.message}`);
            }
        }
    }

    throw lastError;
}
