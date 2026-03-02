import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FreeModel, RecommendResult } from '@/types';
import {
    llmRecommend,
    parseTaskSignals,
    scoreModel,
    buildReason,
    buildRiskWarnings,
    buildWrapperCode,
} from '@/lib/recommend/engine';

/**
 * POST /api/recommend
 * Body: { task: string, limit?: number }
 * Header (optional): X-OpenRouter-Key: <user's OpenRouter API key>
 *
 * S-3 Fix: API key now read from header (not body) to prevent accidental logging.
 * When key present: tries LLM (gemini-2.0-flash-lite:free) first.
 * On LLM failure or no key: falls back to rule engine.
 *
 * Returns: RecommendResult & { mode: 'llm' | 'rule' }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let task: string;
    let limit = 3;

    // S-3 Fix: read API key from header, not body
    const apiKey = req.headers.get('x-openrouter-key')?.trim() ?? '';

    try {
        const body = await req.json();
        task = (body.task || '').trim();
        if (body.limit) limit = Math.min(Number(body.limit), 10);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!task) {
        return NextResponse.json({ error: 'task is required' }, { status: 400 });
    }

    // ── 1. Load free models from Supabase ────────────────────────
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('free_models')
        .select('*')
        .eq('is_free', true)
        .order('last_updated', { ascending: false })
        .limit(300);

    if (error) {
        return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
    }

    const models = (data as FreeModel[]) || [];

    if (models.length === 0) {
        return NextResponse.json(
            { error: '暂无免费模型数据，请先触发数据同步（POST /api/cron）' },
            { status: 404 }
        );
    }

    // ── 2. Try LLM recommend (requires API key) ──────────────────
    if (apiKey) {
        const llmResult = await llmRecommend(task, models, apiKey);
        if (llmResult) {
            return NextResponse.json({ ...llmResult, mode: 'llm' });
        }
        console.warn('[Recommend] LLM failed, falling back to rule engine');
    }

    // ── 3. Rule engine fallback ───────────────────────────────────
    const signals = parseTaskSignals(task);

    const scored = models
        .map(m => ({ model: m, score: scoreModel(m, signals) }))
        .filter(({ score }) => score > -30)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
        return NextResponse.json(
            { error: '没有找到匹配的模型，请尝试更通用的任务描述' },
            { status: 404 }
        );
    }

    const best = scored[0].model;
    const alternatives = scored
        .slice(1, limit + 1)
        .map(({ model }) => model);

    const result: RecommendResult & { mode: string } = {
        best_model: best,
        reason: buildReason(best, signals),
        risk_warnings: buildRiskWarnings(best, signals),
        alternatives,
        wrapper_code: buildWrapperCode(best),
        mode: 'rule',
    };

    return NextResponse.json(result);
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/recommend',
        description: '基于规则引擎或 LLM 的免费模型推荐',
        body: { task: 'string (required)', limit: 'number (optional, default 3)' },
        headers: { 'X-OpenRouter-Key': 'string (optional, enables LLM mode)' },
        example: { task: '我需要一个支持图片分析的免费模型' },
    });
}
