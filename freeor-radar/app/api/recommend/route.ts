import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FreeModel, RecommendResult } from '@/types';
import {
    parseTaskSignals,
    scoreModel,
    buildReason,
    buildRiskWarnings,
    buildWrapperCode,
} from '@/lib/recommend/engine';

/**
 * POST /api/recommend
 * Body: { task: string, limit?: number }
 *
 * Returns: RecommendResult
 *   - best_model: top-scored FreeModel
 *   - reason: human-readable explanation
 *   - risk_warnings: list of caveats
 *   - alternatives: top 3 runners-up
 *   - wrapper_code: { python, javascript, curl }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let task: string;
    let limit = 3;

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

    // ── 1. 从 Supabase 加载所有在线免费模型 ─────────────────────
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

    // ── 2. 解析任务信号 ──────────────────────────────────────────
    const signals = parseTaskSignals(task);

    // ── 3. 打分排序 ──────────────────────────────────────────────
    const scored = models
        .map(m => ({ model: m, score: scoreModel(m, signals) }))
        .filter(({ score }) => score > -30) // 排除明显不匹配
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
        return NextResponse.json(
            { error: '没有找到匹配的模型，请尝试更通用的任务描述' },
            { status: 404 }
        );
    }

    // ── 4. 组装结果 ──────────────────────────────────────────────
    const best = scored[0].model;
    const alternatives = scored
        .slice(1, limit + 1)
        .map(({ model }) => model);

    const result: RecommendResult = {
        best_model: best,
        reason: buildReason(best, signals),
        risk_warnings: buildRiskWarnings(best, signals),
        alternatives,
        wrapper_code: buildWrapperCode(best),
    };

    return NextResponse.json(result);
}

// GET — 说明文档
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        endpoint: 'POST /api/recommend',
        description: '基于规则引擎的免费模型推荐',
        body: { task: 'string (required)', limit: 'number (optional, default 3)' },
        example: { task: '我需要一个支持图片分析的免费模型' },
    });
}
