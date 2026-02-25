// ============================================================
// FreeOR Radar — 首次数据同步脚本（独立 Node.js，无需 Next.js）
// 用法: node scripts/sync-now.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── 读取 .env.local ─────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
    try {
        const raw = readFileSync(filePath, 'utf-8');
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (key && val) process.env[key] = val;
        }
    } catch { /* ignore */ }
}

loadEnv(join(__dir, '..', '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── 日志工具 ─────────────────────────────────────────────────
function log(level, msg, data) {
    const ts = new Date().toISOString();
    const prefix = `[OpenRouter Sync ${level.toUpperCase()}]`;
    console.log(`${prefix} - ${ts} - ${msg}`, data ?? '');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 视频关键词检测 ────────────────────────────────────────────
const VIDEO_KEYWORDS = ['video', 'multimodal', 'image-to-video', 'text-to-video', 'vision', 'visual', 'image'];
function detectVideoSupport(model) {
    const desc = (model.description || '').toLowerCase();
    const mod = (model.architecture?.modality || '').toLowerCase();
    return VIDEO_KEYWORDS.some(kw => desc.includes(kw) || mod.includes(kw));
}

// ── 带超时重试的 fetch ─────────────────────────────────────────
async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 10_000);
        try {
            log('info', `Fetch attempt ${attempt}/${maxRetries}`);
            const res = await fetch(url, { ...opts, signal: ctrl.signal });
            clearTimeout(tid);
            return res;
        } catch (err) {
            clearTimeout(tid);
            lastErr = err;
            if (attempt < maxRetries) {
                const wait = Math.pow(2, attempt - 1) * 1000;
                log('warn', `Retry ${attempt}/${maxRetries} — waiting ${wait}ms`);
                await sleep(wait);
            }
        }
    }
    throw lastErr;
}

// ── 拉取 OpenRouter 免费模型 ──────────────────────────────────
async function fetchFreeModels() {
    log('info', 'Fetching models from OpenRouter...');
    const t0 = Date.now();

    const res = await fetchWithRetry('https://openrouter.ai/api/v1/models', {
        headers: {
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app',
            'X-Title': 'FreeOR Radar',
        },
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status} ${res.statusText}`);

    const json = await res.json();
    const all = json.data ?? [];
    const free = all.filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0');

    log('info', `Fetched ${all.length} total, ${free.length} free in ${Date.now() - t0}ms`);

    return free.map(m => {
        const provider = m.id.includes('/') ? m.id.split('/')[0] : 'unknown';
        const isVideo = detectVideoSupport(m);
        const caps = [];
        const modality = m.architecture?.modality || '';
        if (modality.includes('image') || isVideo) caps.push('vision');
        if (/cod(e|er|ing)/i.test(m.id) || /cod(e|ing)/i.test(m.description || '')) caps.push('coding');
        const toolProviders = ['meta-llama', 'mistralai', 'qwen', 'deepseek', 'google', 'openai'];
        if (toolProviders.includes(provider)) caps.push('tool');

        return {
            id: m.id,
            name: m.name,
            provider: provider !== 'unknown' ? provider : null,
            description: m.description ?? null,
            context: m.context_length ?? null,
            modality: modality || null,
            capabilities: caps,
            pricing: m.pricing,
            throughput_tokens_per_s: null,
            latency_ms: null,
            last_updated: new Date().toISOString(),
            is_free: true,
            is_video_supported: isVideo,
        };
    });
}

// ── 主流程 ───────────────────────────────────────────────────
async function main() {
    console.log('\n🚀 FreeOR Radar — 首次数据同步\n' + '─'.repeat(50));

    if (!SUPABASE_URL || !SUPABASE_SVC) {
        console.error('❌ 缺少 Supabase 环境变量，请先填写 .env.local');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SVC, {
        auth: { persistSession: false },
    });

    // 1. 拉取免费模型
    let newModels;
    try {
        newModels = await fetchFreeModels();
    } catch (err) {
        log('error', `Fetch failed: ${err.message}`);
        process.exit(1);
    }

    const videoCount = newModels.filter(m => m.is_video_supported).length;
    log('info', `Found ${newModels.length} free models (${videoCount} video-supported)`);

    // 2. 读取现有数据
    log('info', 'Reading existing models from DB...');
    const { data: existing, error: fetchErr } = await supabase
        .from('free_models').select('id, is_free');
    if (fetchErr) { log('error', fetchErr.message); process.exit(1); }

    const existingIds = new Set((existing || []).map(m => m.id));
    const newIds = new Set(newModels.map(m => m.id));

    const added = newModels.filter(m => !existingIds.has(m.id));
    const removed = (existing || []).filter(m => m.is_free && !newIds.has(m.id));

    log('info', `Diff: +${added.length} new, -${removed.length} removed`);

    // 3. Upsert
    log('info', `Upserting ${newModels.length} models...`);
    const { error: upsertErr } = await supabase
        .from('free_models')
        .upsert(newModels, { onConflict: 'id' });

    if (upsertErr) {
        log('error', `Upsert failed: ${upsertErr.message}`);
    } else {
        log('info', `✅ Upserted ${newModels.length} models successfully`);
    }

    // 4. 软删除移除的模型
    if (removed.length > 0) {
        const ids = removed.map(m => m.id);
        const { error: rmErr } = await supabase
            .from('free_models')
            .update({ is_free: false, last_updated: new Date().toISOString() })
            .in('id', ids);
        if (rmErr) log('error', `Soft-delete failed: ${rmErr.message}`);
        else log('info', `Soft-deleted ${ids.length} models`);
    }

    // 5. 写变更日志
    const logs = [
        ...added.map(m => ({
            model_id: m.id,
            change_type: 'new',
            description: `New free model: ${m.name}${m.is_video_supported ? ' [VIDEO]' : ''}`,
            new_data: { id: m.id, name: m.name, provider: m.provider, is_video_supported: m.is_video_supported },
        })),
        ...removed.map(m => ({
            model_id: m.id,
            change_type: 'removed',
            description: `Removed from free tier: ${m.id}`,
            old_data: { id: m.id },
        })),
    ];

    if (logs.length > 0) {
        const { error: logErr } = await supabase.from('change_logs').insert(logs);
        if (logErr) log('warn', `Change log insert failed (non-fatal): ${logErr.message}`);
        else log('info', `Inserted ${logs.length} change log entries`);
    }

    // 6. 验证结果
    log('info', 'Verifying final state via get_model_stats()...');
    const { data: stats, error: statsErr } = await supabase.rpc('get_model_stats');

    console.log('\n' + '─'.repeat(50));
    console.log('📊 同步完成！最终统计：');
    if (statsErr) {
        console.log('  （统计查询失败，但数据已写入）');
    } else {
        console.log(`  ✅ 免费模型总数：${stats.total_free_models}`);
        console.log(`  🎬 支持视频：   ${stats.video_supported}`);
        console.log(`  📦 提供商数：   ${stats.providers}`);
        console.log(`  🆕 今日新增：   ${stats.new_today}`);
    }
    console.log('─'.repeat(50) + '\n');
}

main().catch(err => {
    console.error('\n❌ 同步异常:', err.message);
    process.exit(1);
});
