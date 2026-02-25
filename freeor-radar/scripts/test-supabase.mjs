// ============================================================
// FreeOR Radar — Supabase 连接测试脚本
// 用法：node scripts/test-supabase.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── 读取 .env.local ─────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env.local');

function loadEnv(filePath) {
    try {
        const raw = readFileSync(filePath, 'utf-8');
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [key, ...rest] = trimmed.split('=');
            if (key && rest.length) {
                process.env[key.trim()] = rest.join('=').trim();
            }
        }
    } catch {
        // .env.local 不存在时忽略，使用已有的 process.env
    }
}

loadEnv(envPath);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── 前置检查 ────────────────────────────────────────────────
console.log('\n🔍 FreeOR Radar — Supabase 连接测试\n');
console.log('─'.repeat(50));

const missing = [];
if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_ANON) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_SVC) missing.push('SUPABASE_SERVICE_ROLE_KEY');

if (missing.length > 0) {
    console.error('❌ 以下环境变量未填写，请先完善 freeor-radar/.env.local：');
    missing.forEach(k => console.error(`   • ${k}`));
    console.error('\n请到 Supabase Dashboard → Settings → API 页面复制配置值\n');
    process.exit(1);
}

console.log(`✅ 配置已读取`);
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Anon Key: ${SUPABASE_ANON.slice(0, 20)}...`);
console.log(`   Service Key: ${SUPABASE_SVC.slice(0, 20)}...`);
console.log('');

// ── 测试 1：anon key 连接 ────────────────────────────────────
console.log('━'.repeat(50));
console.log('TEST 1 / 3 — Anon Key 读取权限（public read）');
console.log('━'.repeat(50));

try {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON);

    // 尝试读取 free_models（不依赖数据，只测连接）
    const { data, error, status } = await anon
        .from('free_models')
        .select('id, name')
        .limit(5);

    if (error) {
        if (error.code === '42P01') {
            // Table doesn't exist yet — connection OK, schema not applied
            console.log('⚠️  连接成功，但 free_models 表不存在');
            console.log('   → 请先在 Supabase SQL Editor 中运行 001_initial_schema.sql');
        } else {
            throw error;
        }
    } else {
        console.log(`✅ Anon 连接成功！(HTTP ${status})`);
        console.log(`   free_models 表已存在，当前行数：${data.length} 条（最多显示5条）`);
        if (data.length > 0) {
            data.forEach(m => console.log(`   • ${m.id}`));
        } else {
            console.log('   （表为空，等待首次 Cron 同步）');
        }
    }
} catch (err) {
    console.error('❌ Anon 连接失败:', err.message);
}

console.log('');

// ── 测试 2：service_role 写入权限 ───────────────────────────
console.log('━'.repeat(50));
console.log('TEST 2 / 3 — Service Role Key 写入权限（Cron 使用）');
console.log('━'.repeat(50));

try {
    const svc = createClient(SUPABASE_URL, SUPABASE_SVC, {
        auth: { persistSession: false },
    });

    // 尝试 upsert 一条测试数据，然后立即删除
    const testId = '__freeor_test__';
    const { error: ins } = await svc
        .from('free_models')
        .upsert({
            id: testId,
            name: 'Test Model',
            is_free: true,
            is_video_supported: false,
        }, { onConflict: 'id' });

    if (ins) {
        if (ins.code === '42P01') {
            console.log('⚠️  Service Role 连接成功，但表不存在，请先建表');
        } else {
            throw ins;
        }
    } else {
        // 写入成功，立即清理
        await svc.from('free_models').delete().eq('id', testId);
        console.log('✅ Service Role 写入 + 删除测试通过！（Cron 同步将正常工作）');
    }
} catch (err) {
    console.error('❌ Service Role 写入失败:', err.message);
}

console.log('');

// ── 测试 3：Supabase 函数调用 ────────────────────────────────
console.log('━'.repeat(50));
console.log('TEST 3 / 3 — get_model_stats() 函数调用');
console.log('━'.repeat(50));

try {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data, error } = await anon.rpc('get_model_stats');

    if (error) {
        if (error.code === '42883') {
            console.log('⚠️  函数不存在，请先运行 001_initial_schema.sql 建表');
        } else {
            throw error;
        }
    } else {
        console.log('✅ get_model_stats() 调用成功！');
        console.log('   统计结果:', JSON.stringify(data, null, 2).replace(/\n/g, '\n   '));
    }
} catch (err) {
    console.error('❌ 函数调用失败:', err.message);
}

console.log('\n' + '─'.repeat(50));
console.log('🏁 测试完成\n');
