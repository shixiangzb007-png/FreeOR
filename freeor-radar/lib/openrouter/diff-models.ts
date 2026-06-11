// ============================================================
// FreeOR Radar - Model Diff & DB Sync
// Skill: OpenRouter Data Sync — Step 3
// Features: structured logging, soft-delete, per-step error safety
// ============================================================

import { FreeModel, ModelDiff } from '@/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { syncLog } from './sync-logger';
import { stripProbeFields } from './probe-models';

// ─── Public API ───────────────────────────────────────────────

/**
 * Skill Step 3 — Diff new models against DB, upsert all changes,
 * soft-delete removed models, write change_logs.
 *
 * Each DB operation is independent (no global tx) — failures are
 * logged and execution continues to preserve partial progress.
 */
export async function diffAndSyncModels(
    supabase: SupabaseClient,
    newModels: FreeModel[]
): Promise<ModelDiff> {
    syncLog('info', `Diffing ${newModels.length} fetched models against database...`);

    // ── 1. Read ALL existing models (incl. soft-deleted) ──────
    // Soft-deleted rows (is_free=false) are needed to distinguish
    // "restored" models from genuinely "new" ones.
    let existing: FreeModel[] = [];
    try {
        const { data, error } = await supabase
            .from('free_models')
            .select('*');

        if (error) throw new Error(error.message);
        existing = (data as FreeModel[]) || [];
        const freeCount = existing.filter(m => m.is_free !== false).length;
        syncLog('info', `Loaded ${existing.length} existing models from DB (${freeCount} free, ${existing.length - freeCount} soft-deleted)`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        syncLog('error', `Failed to read existing models from DB: ${msg}`);
        throw err; // Cannot continue without baseline
    }

    // ── 2. Build diff maps ────────────────────────────────────
    const existingMap = new Map<string, FreeModel>(existing.map(m => [m.id, m]));
    const newMap = new Map<string, FreeModel>(newModels.map(m => [m.id, m]));

    const diff: ModelDiff = { added: [], removed: [], changed: [] };
    // Models that were soft-deleted and are back on the free list.
    // They stay inside diff.added (they ARE newly available to users)
    // but get logged as change_type 'restored'.
    const restoredIds = new Set<string>();

    // Newly added / restored models
    for (const [id, model] of newMap) {
        const old = existingMap.get(id);
        if (!old) {
            diff.added.push(model);
        } else if (old.is_free === false) {
            diff.added.push(model);
            restoredIds.add(id);
        }
    }

    // Removed models (soft-delete candidates) — only currently-free rows
    for (const [id, model] of existingMap) {
        if (model.is_free !== false && !newMap.has(id)) {
            diff.removed.push(model);
        }
    }

    // Changed models (context or video support changed)
    for (const [id, newModel] of newMap) {
        const oldModel = existingMap.get(id);
        // Skip unknown and restored models (those are handled above)
        if (!oldModel || oldModel.is_free === false) continue;

        const changes: Record<string, { old: unknown; new: unknown }> = {};

        if (oldModel.context !== newModel.context) {
            changes.context = { old: oldModel.context, new: newModel.context };
        }
        if (oldModel.is_video_supported !== newModel.is_video_supported) {
            changes.is_video_supported = {
                old: oldModel.is_video_supported,
                new: newModel.is_video_supported,
            };
        }
        if (JSON.stringify(oldModel.capabilities?.sort()) !== JSON.stringify(newModel.capabilities?.sort())) {
            changes.capabilities = { old: oldModel.capabilities, new: newModel.capabilities };
        }

        if (Object.keys(changes).length > 0) {
            diff.changed.push({ model: newModel, changes });
        }
    }

    syncLog('info', `Diff result: +${diff.added.length} new (${restoredIds.size} restored), -${diff.removed.length} removed, ~${diff.changed.length} changed`);

    // ── 3. Upsert all current free models ─────────────────────
    // Skill: ON CONFLICT (id) DO UPDATE — upsert idempotent
    if (newModels.length > 0) {
        try {
            // Omit probe-owned columns so hourly sync doesn't reset availability metrics.
            const syncPayload = newModels.map(m => stripProbeFields(m as unknown as Record<string, unknown>));
            const { error } = await supabase
                .from('free_models')
                .upsert(syncPayload, { onConflict: 'id' });

            if (error) throw new Error(error.message);
            syncLog('info', `Upserted ${newModels.length} models to free_models`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            syncLog('error', `Upsert failed: ${msg}`);
            // Non-fatal: continue to soft-delete and logging
        }
    }

    // ── 4. Soft-delete removed models ────────────────────────
    // Skill: Do NOT delete rows — set is_free = false (soft-delete)
    if (diff.removed.length > 0) {
        const removedIds = diff.removed.map(m => m.id);
        try {
            const { error } = await supabase
                .from('free_models')
                .update({
                    is_free: false,
                    last_updated: new Date().toISOString(),
                })
                .in('id', removedIds);

            if (error) throw new Error(error.message);
            syncLog('info', `Soft-deleted ${removedIds.length} models (is_free=false): ${removedIds.slice(0, 3).join(', ')}${removedIds.length > 3 ? '...' : ''}`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            syncLog('error', `Soft-delete failed: ${msg}`);
        }
    }

    // ── 5. Write change_logs ──────────────────────────────────
    const changeLogs = [
        ...diff.added.map(m => ({
            model_id: m.id,
            change_type: (restoredIds.has(m.id) ? 'restored' : 'new') as 'restored' | 'new',
            description: restoredIds.has(m.id)
                ? `Model restored to free tier: ${m.name}`
                : `New free model: ${m.name}${m.is_video_supported ? ' [VIDEO]' : ''}`,
            new_data: {
                id: m.id,
                name: m.name,
                provider: m.provider,
                context: m.context,
                is_video_supported: m.is_video_supported,
                capabilities: m.capabilities,
            },
        })),
        ...diff.removed.map(m => ({
            model_id: m.id,
            change_type: 'removed' as const,
            description: `Model removed from free tier: ${m.name}`,
            old_data: { id: m.id, name: m.name, provider: m.provider },
        })),
        ...diff.changed.map(({ model, changes }) => ({
            model_id: model.id,
            change_type: 'limit_change' as const,
            description: `Model updated: ${model.name}`,
            old_data: changes,
            new_data: {
                id: model.id,
                name: model.name,
                is_video_supported: model.is_video_supported,
            },
        })),
    ];

    if (changeLogs.length > 0) {
        try {
            const { error } = await supabase
                .from('change_logs')
                .insert(changeLogs);

            if (error) throw new Error(error.message);
            syncLog('info', `Inserted ${changeLogs.length} change log entries`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // change_log failure is non-fatal — sync is still complete
            syncLog('warn', `Change log insert failed (non-fatal): ${msg}`);
        }
    } else {
        syncLog('info', 'No changes to log');
    }

    return diff;
}

/**
 * Returns a human-readable diff summary string.
 */
export function formatDiffSummary(diff: ModelDiff): string {
    const parts: string[] = [];
    if (diff.added.length) parts.push(`+${diff.added.length} new`);
    if (diff.removed.length) parts.push(`-${diff.removed.length} removed`);
    if (diff.changed.length) parts.push(`~${diff.changed.length} changed`);
    return parts.length > 0 ? parts.join(', ') : 'no changes';
}
