import { FreeModel, RecommendResult } from '@/types';

// ── 任务关键词 → 能力/偏好 映射 ────────────────────────────────

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
