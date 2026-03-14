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
 * Body: { task: string, lang?: string, limit?: number }
 * Header (optional): Authorization: Bearer <user's OpenRouter API key>
 * 
 * Returns: RecommendResult & { mode: 'llm' | 'rule' }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let task: string = '';
    let limit = 3;
    let lang = 'en';

    try {
        const body = await req.json();
        task = (body.task || '').trim();
        if (body.limit) limit = Math.min(Number(body.limit), 10);
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!task) {
        return NextResponse.json(
            { error: lang === 'zh' ? '请提供任务描述' : 'Please provide task description' },
            { status: 400 }
        );
    }

    // ── 1. Load free models from Supabase ────────────────────────
    const supabase = await createClient();
    const { data: modelsData, error: dbError } = await supabase
        .from('free_models')
        .select('*')
        .eq('is_free', true)
        .order('last_updated', { ascending: false })
        .limit(300);

    if (dbError) {
        return NextResponse.json({ error: `DB error: ${dbError.message}` }, { status: 500 });
    }

    const models = (modelsData as FreeModel[]) || [];

    if (models.length === 0) {
        return NextResponse.json(
            { error: lang === 'zh' ? '暂无免费模型数据，请先触发数据同步（POST /api/cron）' : 'No free models data available, please sync first' },
            { status: 404 }
        );
    }

    // ── 2. Try LLM recommend (requires API key) ──────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();
    const isAiMode = apiKey.length > 0;

    let bestModelResult: (RecommendResult & { mode: 'llm' | 'rule' }) | null = null;

    if (isAiMode) {
        try {
            const llmResult = await llmRecommend(task, models, apiKey);
            if (llmResult) {
                bestModelResult = { ...llmResult, mode: 'llm' };
            }
        } catch (error) {
            console.warn('[Recommend] LLM failed, falling back to rule engine:', error);
        }
    }

    // ── 3. Rule engine fallback ───────────────────────────────────
    if (!bestModelResult) {
        const signals = parseTaskSignals(task);

        const scored = models
            .map(m => ({ model: m, score: scoreModel(m, signals) }))
            .filter(({ score }) => score > -30)
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
            return NextResponse.json(
                { error: lang === 'zh' ? '没有找到匹配的模型，请尝试更通用的任务描述' : 'No matching models found, please try a more general description' },
                { status: 404 }
            );
        }

        const best = scored[0].model;
        const alternatives = scored
            .slice(1, limit + 1)
            .map(({ model }) => model);

        bestModelResult = {
            best_model: best,
            reason: buildReason(best, signals),
            risk_warnings: buildRiskWarnings(best, signals),
            alternatives,
            wrapper_code: buildWrapperCode(best),
            mode: 'rule',
        };
    }

    return NextResponse.json(bestModelResult);
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/recommend',
        description: '基于规则引擎或 LLM 的免费模型推荐',
        body: { task: 'string (required)', lang: 'string (optional, "zh" | "en")', limit: 'number (optional, default 3)' },
        headers: { 'Authorization': 'Bearer <key> (optional, enables LLM mode)' },
        example: { task: '我需要一个支持图片分析的免费模型' },
    });
}
