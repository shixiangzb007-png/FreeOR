// ============================================================
// FreeOR Radar - Free Model Availability Probing
// Sends minimal chat/completions requests to measure latency,
// 429 rate, and success rate. Updates free_models snapshot cols.
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { syncLog } from './sync-logger';

export type AvailabilityStatus = 'healthy' | 'slow' | 'rate_limited' | 'down' | 'unknown';

export interface ProbeRunResult {
    probed: number;
    healthy: number;
    slow: number;
    rate_limited: number;
    down: number;
    skipped: boolean;
    reason?: string;
}

interface ProbeOutcome {
    model_id: string;
    latency_ms: number | null;
    success: boolean;
    status_code: number | null;
    error_type: 'rate_limit' | 'timeout' | 'error' | null;
    completion_tokens: number | null;
    availability_status: AvailabilityStatus;
    throughput_tokens_per_s: number | null;
}

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PROBE_PROMPT = 'Reply with one word: OK';
const PROBE_MAX_TOKENS = 8;
const PROBE_TIMEOUT_MS = 25_000;
const DEFAULT_BATCH_SIZE = 20;
const CONCURRENCY = 3;
const SLOW_THRESHOLD_MS = 5_000;

/** Strip probe-owned fields so model sync upserts don't reset them. */
export function stripProbeFields<T extends Record<string, unknown>>(row: T): Omit<T,
    'latency_ms' | 'throughput_tokens_per_s' | 'availability_status' | 'last_probed_at' | 'probe_success_rate'
> {
    const {
        latency_ms: _l,
        throughput_tokens_per_s: _t,
        availability_status: _a,
        last_probed_at: _p,
        probe_success_rate: _r,
        ...rest
    } = row;
    return rest;
}

/**
 * Probe a batch of stalest free models and persist results.
 * Requires OPENROUTER_PROBE_API_KEY (server-side, not user BYOK).
 */
export async function probeFreeModels(
    supabase: SupabaseClient,
    batchSize: number = DEFAULT_BATCH_SIZE
): Promise<ProbeRunResult> {
    const apiKey = process.env.OPENROUTER_PROBE_API_KEY?.trim();
    if (!apiKey) {
        syncLog('info', 'Probe skipped: OPENROUTER_PROBE_API_KEY not configured');
        return { probed: 0, healthy: 0, slow: 0, rate_limited: 0, down: 0, skipped: true, reason: 'no_api_key' };
    }

    const { data: candidates, error: selectError } = await supabase
        .from('free_models')
        .select('id, probe_success_rate')
        .eq('is_free', true)
        .order('last_probed_at', { ascending: true, nullsFirst: true })
        .limit(batchSize);

    if (selectError) {
        syncLog('error', `Probe model selection failed: ${selectError.message}`);
        throw new Error(selectError.message);
    }

    const models = candidates || [];
    if (models.length === 0) {
        syncLog('info', 'Probe skipped: no free models in database');
        return { probed: 0, healthy: 0, slow: 0, rate_limited: 0, down: 0, skipped: true, reason: 'no_models' };
    }

    syncLog('info', `Probing ${models.length} free model(s) (batch=${batchSize}, concurrency=${CONCURRENCY})...`);

    const outcomes: ProbeOutcome[] = [];
    for (let i = 0; i < models.length; i += CONCURRENCY) {
        const chunk = models.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
            chunk.map(m => probeOneModel(m.id, apiKey))
        );
        outcomes.push(...chunkResults);
    }

    const now = new Date().toISOString();
    const probeRows = outcomes.map(o => ({
        model_id: o.model_id,
        latency_ms: o.latency_ms,
        success: o.success,
        status_code: o.status_code,
        error_type: o.error_type,
        completion_tokens: o.completion_tokens,
        probed_at: now,
    }));

    const { error: insertError } = await supabase.from('model_probes').insert(probeRows);
    if (insertError) {
        syncLog('warn', `Probe history insert failed (non-fatal): ${insertError.message}`);
    }

    for (const outcome of outcomes) {
        const prev = models.find(m => m.id === outcome.model_id);
        const prevRate = typeof prev?.probe_success_rate === 'number' ? prev.probe_success_rate : null;
        const probe_success_rate = prevRate === null
            ? (outcome.success ? 1 : 0)
            : prevRate * 0.7 + (outcome.success ? 1 : 0) * 0.3;

        const { error: updateError } = await supabase
            .from('free_models')
            .update({
                latency_ms: outcome.latency_ms,
                throughput_tokens_per_s: outcome.throughput_tokens_per_s,
                availability_status: outcome.availability_status,
                last_probed_at: now,
                probe_success_rate,
            })
            .eq('id', outcome.model_id);

        if (updateError) {
            syncLog('warn', `Probe update failed for ${outcome.model_id}: ${updateError.message}`);
        }
    }

    const summary: ProbeRunResult = {
        probed: outcomes.length,
        healthy: outcomes.filter(o => o.availability_status === 'healthy').length,
        slow: outcomes.filter(o => o.availability_status === 'slow').length,
        rate_limited: outcomes.filter(o => o.availability_status === 'rate_limited').length,
        down: outcomes.filter(o => o.availability_status === 'down').length,
        skipped: false,
    };

    syncLog('info', `Probe complete: ${summary.probed} tested — healthy=${summary.healthy} slow=${summary.slow} rate_limited=${summary.rate_limited} down=${summary.down}`);
    return summary;
}

async function probeOneModel(modelId: string, apiKey: string): Promise<ProbeOutcome> {
    const startedAt = Date.now();
    let status_code: number | null = null;
    let error_type: ProbeOutcome['error_type'] = null;
    let completion_tokens: number | null = null;

    try {
        const response = await fetch(OPENROUTER_CHAT_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://freeor.app',
                'X-Title': 'FreeOR Radar Probe',
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: PROBE_PROMPT }],
                temperature: 0,
                max_tokens: PROBE_MAX_TOKENS,
            }),
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });

        status_code = response.status;
        const data = await response.json().catch(() => null);

        if (response.status === 429) {
            return finishProbe(modelId, startedAt, false, status_code, 'rate_limit', null);
        }

        if (!response.ok) {
            const msg = (data?.error?.message || '').toLowerCase();
            const isRateLimit = response.status === 429 || msg.includes('rate limit') || msg.includes('too many');
            return finishProbe(
                modelId,
                startedAt,
                false,
                status_code,
                isRateLimit ? 'rate_limit' : 'error',
                null
            );
        }

        completion_tokens = data?.usage?.completion_tokens ?? null;
        return finishProbe(modelId, startedAt, true, status_code, null, completion_tokens);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('aborted');
        return finishProbe(modelId, startedAt, false, status_code, isTimeout ? 'timeout' : 'error', null);
    }
}

function finishProbe(
    model_id: string,
    startedAt: number,
    success: boolean,
    status_code: number | null,
    error_type: ProbeOutcome['error_type'],
    completion_tokens: number | null
): ProbeOutcome {
    const latency_ms = success ? Date.now() - startedAt : null;
    let availability_status: AvailabilityStatus = 'down';

    if (success && latency_ms !== null) {
        availability_status = latency_ms > SLOW_THRESHOLD_MS ? 'slow' : 'healthy';
    } else if (error_type === 'rate_limit') {
        availability_status = 'rate_limited';
    }

    const throughput_tokens_per_s =
        success && latency_ms && latency_ms > 0 && completion_tokens
            ? Math.round((completion_tokens / (latency_ms / 1000)) * 10) / 10
            : null;

    return {
        model_id,
        latency_ms,
        success,
        status_code,
        error_type,
        completion_tokens,
        availability_status,
        throughput_tokens_per_s,
    };
}
