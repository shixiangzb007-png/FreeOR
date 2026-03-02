import { FreeModel, RecommendResult } from '@/types';

// ── LLM 推荐（有 API Key 时优先调用）────────────────────────

/**
 * 使用 OpenRouter LLM 分析任务并推荐最佳免费模型。
 *
 * @param task     用户描述的任务
 * @param models   当前所有免费模型列表
 * @param apiKey   用户的 OpenRouter API Key
 * @returns        RecommendResult，或 null（失败时 fallback 至规则引擎）
 */
export async function llmRecommend(
    task: string,
    models: FreeModel[],
    apiKey: string
): Promise<RecommendResult | null> {
    // 取最新 50 个模型，构造压缩摘要（避免 token 过多）
    const topModels = models.slice(0, 50);
    const modelsSummary = topModels.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        context_k: m.context ? Math.round(m.context / 1000) : null,
        caps: m.capabilities || [],
    }));

    const systemPrompt = `You are an AI model recommendation expert for OpenRouter free models.
Given a user task and a list of available free models, recommend the BEST model.

Respond ONLY with valid JSON in this exact structure (no markdown, no extra text):
{
  "best_model_id": "<exact model id from the list>",
  "reason": "<1-2 sentence explanation in the same language as the user task>",
  "risk_warnings": ["<warning 1>", "<warning 2>"],
  "alternative_ids": ["<id2>", "<id3>", "<id4>"]
}

Rules:
- best_model_id and alternative_ids MUST be exact IDs from the provided model list
- reason should be specific to the task requirements
- risk_warnings should mention rate limits, model-specific caveats (2-3 items)
- alternative_ids: exactly 3 fallback models
- Respond in the same language as the user's task (Chinese if task is in Chinese)`;

    const userPrompt = `User task: ${task}\n\nAvailable free models:\n${JSON.stringify(modelsSummary, null, 2)}`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://freeor.app',
                'X-Title': 'FreeOR Radar',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-lite:free',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 800,
            }),
            signal: AbortSignal.timeout(20_000), // 20s 超时
        });

        if (!response.ok) {
            console.error('[LLM Recommend] API error:', response.status);
            return null;
        }

        const data = await response.json();
        const content: string = data?.choices?.[0]?.message?.content || '';

        // 解析 JSON（兼容有时 LLM 会包在 ```json ``` 中）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]) as {
            best_model_id: string;
            reason: string;
            risk_warnings: string[];
            alternative_ids: string[];
        };

        // 从模型列表中找到对应模型对象
        const modelMap = new Map(models.map(m => [m.id, m]));
        const bestModel = modelMap.get(parsed.best_model_id);
        if (!bestModel) return null;

        const alternatives = (parsed.alternative_ids || [])
            .map(id => modelMap.get(id))
            .filter((m): m is FreeModel => !!m)
            .slice(0, 3);

        return {
            best_model: bestModel,
            reason: parsed.reason || '',
            risk_warnings: Array.isArray(parsed.risk_warnings) ? parsed.risk_warnings : [],
            alternatives,
            wrapper_code: buildWrapperCode(bestModel),
        };

    } catch (err) {
        console.error('[LLM Recommend] Failed:', err instanceof Error ? err.message : err);
        return null;
    }
}

// ── 任务关键词 → 能力/偏好 映射 ─────────────────────────────────

interface TaskSignals {
    needsVision: boolean;
    needsTool: boolean;
    needsCoding: boolean;
    needsLongContext: boolean;    // > 100K tokens
    needsVideo: boolean;
    needsChinese: boolean;
    needsSpeed: boolean;           // 强调快速/实时
    preferredProviders: string[];  // 匹配到的提供商偏好
}

const KEYWORD_MAP: Record<string, Partial<TaskSignals>> = {
    // Vision
    '图片': { needsVision: true },
    '图像': { needsVision: true },
    '截图': { needsVision: true },
    'screenshot': { needsVision: true },
    'image': { needsVision: true },
    'vision': { needsVision: true },
    '视觉': { needsVision: true },
    '看图': { needsVision: true },
    '识别': { needsVision: true },
    'ocr': { needsVision: true },

    // Tool calling
    'tool': { needsTool: true },
    '工具': { needsTool: true },
    '函数': { needsTool: true },
    'function': { needsTool: true },
    'agent': { needsTool: true },
    'bot': { needsTool: true },
    '自动化': { needsTool: true },
    'api': { needsTool: true },
    '调用': { needsTool: true },

    // Coding
    '代码': { needsCoding: true },
    'code': { needsCoding: true },
    '编程': { needsCoding: true },
    'coding': { needsCoding: true },
    'python': { needsCoding: true },
    'javascript': { needsCoding: true },
    'typescript': { needsCoding: true },
    'review': { needsCoding: true },
    '调试': { needsCoding: true },
    'debug': { needsCoding: true },
    '开发': { needsCoding: true },
    'bug': { needsCoding: true },

    // Long context
    '长文': { needsLongContext: true },
    '长文档': { needsLongContext: true },
    '100k': { needsLongContext: true },
    '摘要': { needsLongContext: true },
    'summary': { needsLongContext: true },
    '文章': { needsLongContext: true },
    '报告': { needsLongContext: true },
    '书': { needsLongContext: true },
    'pdf': { needsLongContext: true },
    '全文': { needsLongContext: true },
    '上下文': { needsLongContext: true },

    // Video
    '视频': { needsVideo: true },
    'video': { needsVideo: true },
    '生成视频': { needsVideo: true },

    // Chinese
    '中文': { needsChinese: true },
    '中文对话': { needsChinese: true },
    '翻译': { needsChinese: true },
    '国语': { needsChinese: true },

    // Speed
    '快': { needsSpeed: true },
    '实时': { needsSpeed: true },
    '低延迟': { needsSpeed: true },
    'fast': { needsSpeed: true },
    '流式': { needsSpeed: true },
    'streaming': { needsSpeed: true },
    '聊天': { needsSpeed: true },
    'chat': { needsSpeed: true },

    // Provider hints
    'gemini': { preferredProviders: ['Google'] },
    'google': { preferredProviders: ['Google'] },
    'llama': { preferredProviders: ['Meta'] },
    'deepseek': { preferredProviders: ['DeepSeek'] },
    'qwen': { preferredProviders: ['Qwen', 'Alibaba'] },
    'mistral': { preferredProviders: ['Mistral'] },
    'claude': { preferredProviders: ['Anthropic'] },
};

// ── 任务解析 ───────────────────────────────────────────────────

export function parseTaskSignals(task: string): TaskSignals {
    const lower = task.toLowerCase();
    const signals: TaskSignals = {
        needsVision: false,
        needsTool: false,
        needsCoding: false,
        needsLongContext: false,
        needsVideo: false,
        needsChinese: false,
        needsSpeed: false,
        preferredProviders: [],
    };

    for (const [keyword, partial] of Object.entries(KEYWORD_MAP)) {
        if (lower.includes(keyword.toLowerCase())) {
            Object.assign(signals, {
                ...partial,
                preferredProviders: [
                    ...signals.preferredProviders,
                    ...(partial.preferredProviders || []),
                ],
            });
        }
    }

    return signals;
}

// ── 模型打分 ───────────────────────────────────────────────────

export function scoreModel(model: FreeModel, signals: TaskSignals): number {
    let score = 0;
    const caps = model.capabilities || [];
    const id = model.id.toLowerCase();
    const provider = (model.provider || '').toLowerCase();
    const ctx = model.context || 0;

    // 能力匹配（最高权重）
    if (signals.needsVision && caps.includes('vision')) score += 40;
    if (signals.needsVision && !caps.includes('vision')) score -= 50; // 硬性扣分
    if (signals.needsTool && caps.includes('tool')) score += 35;
    if (signals.needsCoding && caps.includes('coding')) score += 30;
    if (signals.needsVideo && model.is_video_supported) score += 40;

    // 上下文长度
    if (signals.needsLongContext) {
        if (ctx >= 100_000) score += 35;
        else if (ctx >= 50_000) score += 20;
        else if (ctx >= 32_000) score += 10;
        else score -= 20;
    } else {
        // 不需要长上下文时，大 context 也是加分项（稳定性好）
        if (ctx >= 100_000) score += 10;
        else if (ctx >= 50_000) score += 5;
    }

    // 中文友好
    if (signals.needsChinese) {
        if (id.includes('qwen') || id.includes('glm') || id.includes('deepseek') ||
            id.includes('baichuan') || provider.includes('qwen') ||
            provider.includes('alibaba') || provider.includes('deepseek')) {
            score += 25;
        }
    }

    // 速度优先（小模型更快）
    if (signals.needsSpeed) {
        if (id.includes('8b') || id.includes('7b') || id.includes('3b') ||
            id.includes('mini') || id.includes('flash') || id.includes('haiku')) {
            score += 20;
        }
        if (id.includes('70b') || id.includes('72b') || id.includes('405b')) {
            score -= 10; // 大模型较慢
        }
    }

    // 提供商偏好
    if (signals.preferredProviders.length > 0) {
        const matchProvider = signals.preferredProviders.some(p =>
            provider.includes(p.toLowerCase()) || id.includes(p.toLowerCase())
        );
        if (matchProvider) score += 20;
    }

    // 知名度/稳定性加成（启发式）
    if (id.includes('gemini')) score += 15;
    if (id.includes('llama-3')) score += 10;
    if (id.includes('deepseek')) score += 8;
    if (id.includes('qwen')) score += 8;
    if (id.includes('mistral')) score += 6;

    return score;
}

// ── 推荐理由生成 ───────────────────────────────────────────────

export function buildReason(model: FreeModel, signals: TaskSignals): string {
    const parts: string[] = [];
    const caps = model.capabilities || [];
    const ctx = model.context;

    if (signals.needsVision && caps.includes('vision')) {
        parts.push('原生支持图片/视觉输入');
    }
    if (signals.needsTool && caps.includes('tool')) {
        parts.push('支持 Function Calling / Tool Use');
    }
    if (signals.needsCoding && caps.includes('coding')) {
        parts.push('代码能力突出');
    }
    if (ctx && ctx >= 100_000) {
        parts.push(`超长上下文（${Math.round(ctx / 1000)}K tokens）`);
    } else if (ctx && ctx >= 32_000) {
        parts.push(`较大上下文窗口（${Math.round(ctx / 1000)}K tokens）`);
    }
    if (signals.needsChinese) {
        const id = model.id.toLowerCase();
        if (id.includes('qwen') || id.includes('deepseek') || id.includes('glm')) {
            parts.push('中文理解与生成能力优秀');
        }
    }
    if (signals.needsSpeed) {
        parts.push('参数规模适中，响应速度快');
    }
    if (model.is_video_supported) {
        parts.push('支持视频/多模态输出');
    }

    if (parts.length === 0) {
        parts.push('综合能力均衡，是当前免费 tier 的优质选择');
    }

    const providerStr = model.provider ? `由 ${model.provider} 提供，` : '';
    return `${providerStr}${parts.join('，')}。在当前 OpenRouter 免费模型中匹配度最高。`;
}

// ── 风险提示生成 ───────────────────────────────────────────────

export function buildRiskWarnings(model: FreeModel, signals: TaskSignals): string[] {
    const warnings: string[] = [];
    const id = model.id.toLowerCase();

    warnings.push('免费 tier 存在速率限制（Rate Limit），高频使用时可能触发 429 错误');

    if (id.includes('deepseek') || id.includes('r1')) {
        warnings.push('DeepSeek 模型在高峰期（尤其 UTC 白天）限流较严，建议备用方案');
    }
    if (id.includes('70b') || id.includes('72b') || id.includes('405b')) {
        warnings.push('大参数模型响应较慢（约 5-15s），不适合需要实时响应的场景');
    }
    if (signals.needsVision && !(model.capabilities || []).includes('vision')) {
        warnings.push('⚠️ 该模型不支持图片输入，请切换至 Vision 标签筛选的模型');
    }
    if (signals.needsTool && !(model.capabilities || []).includes('tool')) {
        warnings.push('该模型可能不支持标准 Function Calling，请测试验证');
    }

    return warnings;
}

// ── Wrapper 代码生成 ───────────────────────────────────────────

export function buildWrapperCode(model: FreeModel): RecommendResult['wrapper_code'] {
    const modelId = model.id;

    const python = `import openai

client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_OPENROUTER_KEY",  # 可选，免费模型可留空
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {"role": "user", "content": "你好，请介绍一下你自己"}
    ],
    extra_headers={
        "HTTP-Referer": "https://freeor.app",
        "X-Title": "FreeOR Radar",
    }
)
print(response.choices[0].message.content)`;

    const javascript = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",  // 免费模型可留空
  defaultHeaders: {
    "HTTP-Referer": "https://freeor.app",
    "X-Title": "FreeOR Radar",
  },
});

const response = await client.chat.completions.create({
  model: "${modelId}",
  messages: [{ role: "user", content: "你好，请介绍一下你自己" }],
});
console.log(response.choices[0].message.content);`;

    const curl = `curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "HTTP-Referer: https://freeor.app" \\
  -H "X-Title: FreeOR Radar" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下你自己"}
    ]
  }'`;

    return { python, javascript, curl };
}
