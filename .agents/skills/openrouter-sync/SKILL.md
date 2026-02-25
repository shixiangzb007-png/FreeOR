---
description: OpenRouter 数据同步专家 - 精准抓取免费模型、isVideoSupported 标记、重试与结构化日志
---

# Skill: OpenRouter Data Sync（OpenRouter 数据同步专家）

## 角色定义

你是一个专注于 API 集成与数据清洗的后端架构专家。你的核心任务是与 OpenRouter API 进行交互，精准筛选出所有完全免费的模型（特别是支持视频生成或多模态的模型），并将清洗后的数据标准化地存入 PostgreSQL 数据库中。

---

## 技术栈约束

- **运行环境:** Node.js（优先使用原生 `fetch` API）
- **框架集成:** Next.js App Router — Server Actions 或 API Routes
- **数据库:** PostgreSQL（通过 Supabase + `@supabase/ssr`）
- **类型安全:** 全量 TypeScript 类型定义在 `types/index.ts`
- **核心模块路径:**
  - `lib/openrouter/fetch-models.ts` — API 请求 + 过滤 + 清洗
  - `lib/openrouter/diff-models.ts` — 变更检测 + 数据库 Upsert
  - `lib/openrouter/sync-logger.ts` — 结构化日志工具

---

## 执行流程

### Step 1: API 请求封装

**文件:** `lib/openrouter/fetch-models.ts`

**要求：**
- 请求目标: `GET https://openrouter.ai/api/v1/models`
- 必须使用 `AbortController` 实现超时 (默认 10 秒)
- 必须实现指数退避重试 (最多 3 次，间隔 1s → 2s → 4s)
- 记录请求耗时 (`Date.now()` diff) 和状态码
- 所有异常 `throw` 前要先调用 `syncLog('error', message)`

```typescript
// 超时 + 重试模板
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === maxRetries) throw err;
      await sleep(Math.pow(2, attempt - 1) * 1000); // 指数退避
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Step 2: 严格的数据过滤与清洗

**核心免费条件:**
```typescript
model.pricing.prompt === '0' && model.pricing.completion === '0'
```

**必要字段提取:**
- `id`, `name`, `description`, `context_length`
- `architecture.modality`

**视频/多模态标记 (`isVideoSupported`):**
```typescript
// 检测关键词（描述 + modality 字段）
const VIDEO_KEYWORDS = ['video', 'multimodal', 'image-to-video', 'text-to-video', 'vision', 'visual'];

function detectVideoSupport(model: OpenRouterModel): boolean {
  const desc = (model.description || '').toLowerCase();
  const modality = (model.architecture?.modality || '').toLowerCase();
  return VIDEO_KEYWORDS.some(kw => desc.includes(kw) || modality.includes(kw));
}
```

**数据清洗后输出 `FreeModel` 对象，必须包含字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 原始 OpenRouter model ID |
| `name` | `string` | 模型显示名称 |
| `provider` | `string` | 从 `id` 提取（斜杠前） |
| `description` | `string \| null` | 原始描述 |
| `context` | `number \| null` | `context_length` |
| `modality` | `string` | `architecture.modality` |
| `capabilities` | `string[]` | 派生能力标签 |
| `is_video_supported` | `boolean` | 视频/多模态支持标记 |
| `pricing` | `object` | 原始定价对象 |
| `is_free` | `boolean` | 始终 `true`（已过滤） |
| `last_updated` | `string` | ISO8601 时间戳 |

### Step 3: 数据库交互（PostgreSQL / Supabase）

**文件:** `lib/openrouter/diff-models.ts`

**Upsert 逻辑（ON CONFLICT）：**
```sql
-- 必须以 openrouter id 为冲突键
INSERT INTO free_models (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  context = EXCLUDED.context,
  is_video_supported = EXCLUDED.is_video_supported,
  last_updated = EXCLUDED.last_updated;
```

**软删除（不删记录，只标记下架）：**
```typescript
// 若模型在 DB 中存在但新拉取列表不含，执行软删除
await supabase
  .from('free_models')
  .update({ is_free: false, last_updated: now })
  .in('id', removedIds);
```

**事务安全要求：**
- Supabase JS 客户端不支持显式事务，但必须使用 `Promise.allSettled` 保证单步失败不阻塞整体
- 所有数据库操作必须有独立的 `try/catch`，失败后记录 `syncLog('error', ...)` 并继续

### Step 4: 结构化日志规范

**文件:** `lib/openrouter/sync-logger.ts`

**输出格式：**
```
[OpenRouter Sync INFO] - 2026-02-25T13:00:00.000Z - Fetched 247 models in 432ms
[OpenRouter Sync ERROR] - 2026-02-25T13:00:01.000Z - Upsert failed: connection timeout
[OpenRouter Sync WARN] - 2026-02-25T13:00:01.500Z - Retry attempt 2/3
```

**日志函数签名：**
```typescript
type LogLevel = 'info' | 'warn' | 'error';
function syncLog(level: LogLevel, message: string, data?: unknown): void
```

---

## 异常处理规范

1. **永远不要让 API 失败崩溃进程** — 使用 `try/catch` 包裹所有外部调用
2. **数据库操作事务安全** — 每步独立错误处理，失败继续下一步
3. **错误输出格式严格统一** — 使用 `syncLog('error', ...)` 而非 `console.error`

---

## 触发条件

当以下任何一条出现时，执行本 Skill：
- 用户说：**"同步 OpenRouter 免费模型"**
- 用户说：**"更新模型列表"**
- `POST /api/cron` 被 Vercel Cron 触发

---

## 文件引用

| 文件 | 职责 |
|------|------|
| [`fetch-models.ts`](file:///d:/MyProjects/FreeOR/freeor-radar/lib/openrouter/fetch-models.ts) | API 请求、过滤、清洗 |
| [`diff-models.ts`](file:///d:/MyProjects/FreeOR/freeor-radar/lib/openrouter/diff-models.ts) | 变更检测、Upsert、软删除 |
| [`sync-logger.ts`](file:///d:/MyProjects/FreeOR/freeor-radar/lib/openrouter/sync-logger.ts) | 结构化日志工具 |
| [`types/index.ts`](file:///d:/MyProjects/FreeOR/freeor-radar/types/index.ts) | 所有 TS 类型定义 |
| [`supabase/migrations/001_initial_schema.sql`](file:///d:/MyProjects/FreeOR/freeor-radar/supabase/migrations/001_initial_schema.sql) | 数据库 Schema |
| [`app/api/cron/route.ts`](file:///d:/MyProjects/FreeOR/freeor-radar/app/api/cron/route.ts) | Cron 触发入口 |
