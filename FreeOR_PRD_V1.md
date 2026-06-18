# FreeOR Radar - 产品需求文档 (PRD v3.1)

**产品名称**：FreeOR Radar（免费 OpenRouter 雷达）  
**Slogan**：一键发现 OpenRouter 最新免费资源 + 视频生成智能助手  
**版本路线**：MVP（已完成）→ v1（多平台视频额度，已完成）→ v2（视频双线：Clip + Overview）→ v3（全 AI 网关）  
**目标**：让开发者与视频创作者以接近零成本使用顶级 AI  
**文档更新日期**：2026-06-11（v3.1，视频能力双线规划 + 已实现功能对齐）  
**开发者**：1 人

> 📌 **v3.1 说明**：本版 PRD 以实际代码为准修订（应用位于 `freeor-radar/` 子目录）。
> 数据库结构以 `freeor-radar/supabase/migrations/` 为唯一事实来源；部署流程见根目录 `DEPLOY.md`。
> **v3.1 重点**：将视频能力拆为 **Video Clip**（已实现）与 **Video Overview**（NotebookLM 式，规划中）两条产品线，并记录时长参数、分段生成与合成方案的技术决策。

---

## 1. 产品概述与核心需求

FreeOR Radar 是 OpenRouter 免费资源的实时雷达 + 智能路由器，专注解决用户痛点：
- 免费模型随时新增/下线/限流，手动刷官网效率低
- 视频生成额度分散（Kling、Pika、Genmo、Higgsfield、OpenArt 等），无统一参考
- Prompt 优化难度高；长视频（3–5 分钟解说）与单镜头短片需求不同，需分产品应对

**MVP 核心价值**：实时推送 + 任务智能推荐 + 视频 Prompt 一键生成 + 一键免费路由

> ⚠️ **定位修正（v3）**：
> - "视频额度追踪器"展示的是**各平台公开免费额度上限（参考值）**，并非用户账户的实时余额（UI 已明确标注）。
> - OpenRouter 的**视频生成模型均按量计费**，无免费视频模型；视频相关功能均需用户自带有余额的 OpenRouter Key（BYOK）。

> 📌 **视频双线定位（v3.1 新增）**：
>
> | 产品线 | 用户价值 | 典型时长 | 状态 |
> |--------|----------|----------|------|
> | **Video Clip** | 单镜头 AI 视频片段（广告、B-roll、动效预览） | 5–12s / 段（受模型上限约束） | ✅ 已实现 |
> | **Video Overview** | 资料/主题 → 旁白解说型长视频（对标 Google NotebookLM Video Overview） | 3–5 分钟（Brief）/ 更长（Explainer） | 📋 规划中 |
>
> **不可混淆**：OpenRouter `POST /api/v1/videos` 单次调用**不能**直接生成数分钟连续镜头；NotebookLM 的长时长来自「多场景脚本 + 配图/短片 + 旁白 + 后台合成」，FreeOR Overview 路线将模仿该**编排范式**，而非把 `duration` 设为 300。

---

## 2. 用户画像

**Persona A：独立开发者**（30岁，构建 agent/bot，每天刷 X 找免费模型）
- 场景：早上打开产品看"今日新增免费模型"，发现新 Gemini 模型即刻一键测试

**Persona B：视频内容创作者**（25岁，用 Kling/Sora 生产内容）
- 痛点：额度不够 + prompt 难写 + 想要 30s 广告片或 3min 解说视频  
- 场景（Clip）：生成 10s 产品镜头 + 专业 Prompt  
- 场景（Overview，规划）：粘贴文稿/主题 → 3 分钟 Brief 解说视频，可下载分镜与旁白稿

**Persona C：知识工作者**（对标 NotebookLM 用户）
- 痛点：长 PDF/笔记难以快速消费  
- 场景（Overview，规划）：上传摘要或粘贴要点 → Explainer 格式 5 分钟视频概览

---

## 3. 技术栈（v3.1 对齐实际实现）

- **Framework**：Next.js 16.1.6（App Router + Turbopack + React 19）
- **UI**：Tailwind CSS 4 自研组件 + Lucide Icons（未使用 shadcn/ui / Radix）
- **状态管理**：React Server Components + 客户端 useState/Context（未使用 Zustand）
- **数据库**：Supabase（Postgres + Realtime + RLS + Vault；pgvector 列已预留但暂未启用 RAG）
- **国际化**：自研 `LangProvider` + 翻译表（`lib/i18n/lang-context.tsx`），中/英双语
- **实时通知**：Telegram Bot API + Discord Webhook + X (Twitter) API v2
- **同步与推送调度**：
  - Vercel Cron：每小时 `/api/cron`（兜底）+ 每小时 `:30` `/api/cron/probe`（可用性探测）+ 每日 UTC 01:00 重置视频额度
  - Supabase Edge Function `sync-cron` + pg_cron 每 5 分钟触发 → **推送延迟 < 5min 已达成**
- **Video Clip（已实现）**：
  - OpenRouter `POST /api/v1/videos` 提交 + `POST /api/video/poll` 客户端轮询（BYOK）
  - 请求体必传 `duration`（秒）；Prompt 内 `Duration: {{duration}}` 与 API 字段对齐
  - 模型时长上限见 `lib/video/models.ts`（Seedance 12s / Kling·Wan 10s / Veo 8s 等）
- **Video Overview（规划）**：
  - LLM 分镜脚本（免费规则引擎或用户 Key）→ 配图（OpenRouter 图像模型）→ TTS 旁白 → ffmpeg 合成 MP4
  - 可选增强：关键场景用 Video Clip 管线插入 8–12s 动态镜头
  - 后台长任务队列（localStorage + 可选 Supabase job 表），生成时间目标：数分钟～30 分钟（对标 NotebookLM）
- **部署**：Vercel（Hobby 计划，Root Directory = `freeor-radar`）

---

## 4. UI/UX 原型描述

**整体风格**：深色模式优先（dark bg #0a0a0a），科技感，绿色强调（#22c55e = 免费）。响应式，手机优先。支持中/英双语切换。

### 4.1 全局布局（Layout）✅
- **Sidebar（左侧固定）**：Logo + 导航（仪表盘 / 视频专区 / 智能推荐 / 变更日志 / 集成中心 / 操作说明 / 设置）+ GitHub Star + 实时状态 + 语言切换（中/EN）
- **Topbar**：全局模型搜索、"今日新增"徽章（实时计数）、通知设置入口

### 4.2 首页 - 仪表盘（/）✅
- Hero 卡片：当前免费模型总数 + 今日新增
- 免费模型表格：
  - 列：模型名、提供商、上下文、能力、**限流提示**、**可用性**（探测延迟/状态）、最后更新
  - 过滤：搜索（URL `?search=` 同步）+ 能力 + Video + **已关注** + 排序（上下文/更新时间/响应速度）
  - 星标关注模型；CSV 导出
- 视频额度参考条（7 平台，诚实标注）
- Top 5 推荐免费模型卡片

### 4.3 视频专区（/video）✅ + 📋 规划扩展

**Tab A — Video Clip（✅ 已实现）**
- 左侧：目标平台 + 7 大 Prompt 模板 + 主题输入 + **视频时长选择**（按模型 max 过滤）+ 模型选择 + 提交
- 右侧：Prompt 预览/编辑 + 额度参考 + Prompt 历史 + **多任务面板**（pending / processing / succeed / failed；localStorage 持久化；刷新可恢复轮询）
- 时长逻辑：模板 `durationSeconds` → UI 选择 → API `duration` 字段；超出模型上限时 clamp 并提示

**Tab B — Video Overview（📋 规划，见 §5.7）**
- 输入：粘贴长文 / 主题描述 /（远期）PDF 摘要
- 格式：**Brief**（~3min）/ **Explainer**（~5min+）
- 视觉风格：白板 / 极简 / 复古等（Prompt 级，非 Google Nano Banana 同款）
- 输出：成片 MP4 + 分镜 JSON + 旁白稿下载；后台进度条

### 4.4 智能推荐页（/recommend）✅
- 规则/LLM 双模式推荐 + 页面内 OpenRouter 测试调用

### 4.5 其他页面 ✅
- 变更日志、集成中心、操作说明、设置（含通知订阅、测试消息、Key 管理）

---

## 5. 核心功能规格（现状 + 规划）

### 5.1 仪表盘首页 ✅
- 实时免费模型表格 + 限流提示 + **可用性探测列**
- 每 5 分钟同步；模型关注（星标）与定向提醒（见 5.8）

### 5.2 变更追踪与推送 ✅
- 变更四类：new / limit_change / removed / restored
- 全量推送 + 按用户订阅 + **被关注模型定向提醒**
- 推送延迟 < 5 分钟；订阅/测试 API 限速

### 5.3 智能推荐引擎 ✅
- 规则引擎 + LLM（用户 Key）+ 一键测试

### 5.4 Video Clip — 单镜头视频生成 ✅

**能力摘要**
- Prompt 模板（7 种）+ `{{duration}}` 占位 + 平台过滤
- OpenRouter 异步视频：`POST /api/video/generate`（提交）→ `POST /api/video/poll`（轮询至完成或 10min 超时）
- 每模型 `maxDuration` / `defaultDuration`（`lib/video/models.ts`）
- 任务状态：localStorage；支持重试、删除、刷新后续 poll

**API 契约（已实现）**

| 端点 | 作用 |
|------|------|
| `POST /api/video/generate` | Body: `{ prompt, model, duration?, lang? }` + `Authorization: Bearer <key>` → `{ polling_url, job_id, duration }` 或即时 `{ video_url }` |
| `POST /api/video/poll` | Body: `{ polling_url, lang? }` → `{ status, video_url? }`；polling_url 限域 `openrouter.ai`（SSRF 防护） |

**时长根因说明（v3.1 已修复）**  
此前 Prompt 写「30 seconds」但未传 OpenRouter `duration` 字段，模型默认 ~5s。现 UI、`duration` API 字段与 Prompt 三者一致。

**额度参考**  
Kling / Pika / Genmo / Runway / Veo / Higgsfield / OpenArt 公开免费额度参考（非账户余额）；`scripts/scrape-credits.mjs` 为可选运维脚本。

### 5.5 集成中心 ✅
- Python / JS / cURL / Aider / Clawdbot / OpenClaw

### 5.6 国际化 ✅
- 中/英双语，含视频时长、可用性、关注等文案

### 5.7 Video Overview — 长视频解说（📋 规划）

> **对标**：Google NotebookLM [Video Overview](https://support.google.com/notebooklm/answer/16454555)（Brief 约 3–5 分钟；Explainer 更长；后台多模型编排 + 合成，生成常需数分钟～30+ 分钟）。  
> **FreeOR 差异**：OpenRouter BYOK、模型可选、可导出分镜/旁白供开发者二次加工。

#### 5.7.1 产品目标

| 格式 | 目标时长 | 适用场景 |
|------|----------|----------|
| **Brief** | ~3 分钟 | 快览、会议 recap、产品要点 |
| **Explainer** | ~5–8 分钟 | 深度讲解、教程概览 |
| **Highlight Reel**（可选） | 30–60s | 从 Overview 自动摘高光片段 |

用户输入：**主题描述** / **粘贴 Markdown 或纯文本** /（P2）**PDF 上传 → 文本提取**。

#### 5.7.2 技术路线（推荐：路线 A 为主，路线 B 为增强）

```
┌─────────────────────────────────────────────────────────────┐
│                    Video Overview 管线                        │
├─────────────────────────────────────────────────────────────┤
│ ① 输入解析     主题 / 长文 / PDF 文本                        │
│ ② 脚本生成     LLM 或规则 → N 段分镜（旁白 + 画面描述）       │
│ ③ 视觉生产     每段 1 张配图（OpenRouter 图像模型，低成本）   │
│ ④ 旁白         TTS（OpenRouter 音频-capable 模型 或 Web TTS）│
│ ⑤ 合成         ffmpeg：图 + Ken Burns + 字幕轨 + 音轨 → MP4  │
│ ⑥ 交付         成片下载 + 分镜 JSON + 旁白稿                  │
└─────────────────────────────────────────────────────────────┘
```

**路线 A — 轻量解说（MVP 推荐）**  
- 时长自然达 3–5 分钟；成本远低于「全程 Veo」  
- 视觉为「配图 + 动效」，非电影级连续镜头  
- 与 NotebookLM 经典 Video Overview 形态最接近  

**路线 B — 多段 Video Clip 拼接（增强，可选）**  
- 适用：用户要 30s 广告级连续画面，但单模型 max 仅 12s  
- 流程：目标 30s → 拆 ⌈30/max⌉ 段 → LLM 分镜（段间叙事承接）→ **串行**生成各段 → 可选 `frame_images.first_frame` = 上段末帧 → ffmpeg 拼接  
- 限制：费用/时间成倍；画面连续性不保证；仅对支持 `frame_images` 的模型启用  

**路线 C — 混合（远期）**  
- Overview 主体用路线 A；片头/转场用路线 B 插入 8s Cinematic clip  

#### 5.7.3 与 NotebookLM 对照

| 维度 | NotebookLM | FreeOR Overview（规划） |
|------|------------|-------------------------|
| 输入 | 笔记本多文档 | 粘贴文本 / 主题（PDF 远期） |
| 脚本 | Gemini 内置 | 免费规则 LLM 或用户 Key |
| 画面 | Nano Banana + Veo 3（Cinematic） | OpenRouter 图像 + 可选 Clip |
| 旁白 | Google TTS | OpenRouter / 第三方 TTS |
| 合成 | Google 后台 | ffmpeg（客户端 wasm 或服务端 Worker） |
| 时长 | 3–5min+ | Brief 3min / Explainer 5min+（可配置） |
| 成本 | 订阅制（Ultra 限额） | BYOK 透明计费 |

#### 5.7.4 API / 数据（规划）

| 端点 | 说明 |
|------|------|
| `POST /api/video/overview/plan` | 输入 + 格式 → 分镜脚本 `{ scenes: [{ narration, visual_prompt, duration_sec }] }` |
| `POST /api/video/overview/render` | 启动后台任务 → `{ job_id }` |
| `GET /api/video/overview/status?id=` | 进度 + 成片 URL |

可选表 `video_overview_jobs`（client_id、status、scenes_json、output_url）——与 Clip 任务 localStorage 并存，Overview 因耗时长建议云端 job 记录。

#### 5.7.5 分期交付

| 阶段 | 范围 | 验收 |
|------|------|------|
| **P4-M1** | 路线 A：文本 → 分镜 → 配图 → TTS → 合成 Brief ~3min | 可下载 MP4 |
| **P4-M2** | Explainer 格式 + 视觉风格选择 + 进度 UI | 5min 级成片 |
| **P4-M3** | 路线 B：Clip 多段拼接（30s 目标）+ 段间分镜 LLM | 3 段连续叙事（best-effort） |
| **P4-M4** | PDF 输入、Highlight Reel、job 持久化 | 对标 NotebookLM 核心路径 |

#### 5.7.6 风险与诚实边界

- 路线 B **不能承诺**电影级无缝衔接；需 UI 标注「实验性」  
- Overview 生成时间可能 **10–30 分钟**；必须异步 + 可离开页面  
- 所有生成均 BYOK；需在 UI 预估 token/秒级费用  
- 不复制 Google 专有模型栈；定位为 **OpenRouter 生态的 NotebookLM 式解说工具**

### 5.8 模型关注与可用性监控 ✅（v3.1 已实现）

- **模型关注**：`model_watches`（006）+ `/api/watches` + 表格星标；Cron `notifyWatchers` 定向 TG/Discord  
- **可用性监控**：`model_probes`（007）+ `/api/cron/probe`；表格「可用性」列 + 延迟排序；需 `OPENROUTER_PROBE_API_KEY`

---

## 6. 数据库 Schema（Supabase）

> **唯一事实来源**：`freeor-radar/supabase/migrations/`（001~007，幂等可重复执行）。

| Migration | 内容 |
|-----------|------|
| `001_initial_schema.sql` | `free_models`、`change_logs`、`video_credits`、`notification_subscriptions` 等 |
| `002_add_rate_limits.sql` | `per_request_limits` / `rate_limit_level` |
| `003_notification_subscriptions_anon.sql` | `client_id` 匿名订阅 |
| `004_seed_video_credits.sql` | 7 平台额度 seed |
| `005_schedule_sync_cron.sql` | pg_cron 5 分钟 Edge Function |
| `006_model_watches.sql` | 模型关注 `model_watches` |
| `007_model_availability.sql` | `model_probes` + `free_models.availability_status` 等 |
| `008_video_overview_jobs.sql`（规划） | Overview 长任务 job 表 |

> 预留未启用：`free_models.embedding`（RAG）、`user_preferences`（收藏已用 `model_watches` 替代）

---

## 7. 用户故事（User Stories）

### 已完成 ✅
1. 查看最新免费模型列表，按任务过滤，看到限流与**可用性**。  
2. 视频创作者：一键 Prompt + **可选时长** + Clip 生成 + 额度参考。  
3. 开发者：变更推送 + 推荐页测试 + 集成代码复制。  
4. 中/英切换；Telegram/Discord 测试消息。  
5. **关注模型**并在下线/限流变更时收到定向提醒。

### 规划中 📋
6. As a 用户，我粘贴一篇笔记，得到 **3 分钟 Brief 解说视频**（Video Overview）。  
7. As a 创作者，我要 **30s 广告片**，系统自动拆成多段 Clip 并拼接（路线 B）。  
8. As a 开发者，我下载 **分镜 JSON + 旁白稿**，接入自己的剪辑流程。

---

## 8. 非功能需求

| 需求 | 指标 | 状态 |
|------|------|------|
| 性能 | 页面加载 < 2s | ✅ |
| 推送延迟 | < 5 分钟 | ✅ |
| Clip 轮询 | 单段 poll < 30s；总等待 ≤ 10min | ✅ |
| Overview 生成（规划） | 异步；用户可离开；进度可查询 | 📋 |
| 安全 | Key 仅存 localStorage；Cron/订阅限速；video poll URL 域名校验 | ✅ |
| 多语言 | 中/英 | ✅ |
| 成本 | 雷达/推送/规则推荐免费；Clip/Overview BYOK | ✅ |

---

## 9. 功能路线图（v3.1 状态）

### P0 — MVP ✅
### P1 — 上线前 ✅
### P2 — v1 ✅
### P3 — v2（已决策）✅ / ❌ 跳过项见 v3 记录

### P3+ — v3 迭代 ✅ 大部分已完成
- ✅ 模型收藏/关注 + 定向提醒（006 + watch-alerts）
- ✅ 免费模型可用性监控（007 + `/api/cron/probe`）
- 🔨 推送消息可操作化（deep link + 复制 model id）
- 🔨 Web Push 第四渠道
- 🔨 模型详情页
- 🔨 工程质量（测试、Cron 告警、README）

### P4 — 视频双线（v3.1 新增规划）
- 🔨 **Video Overview M1**：路线 A（文本 → 3min Brief MP4）
- 🔨 **Video Overview M2**：Explainer + 风格 + 长任务 UI
- 🔨 **Video Clip 增强**：路线 B 多段拼接（30s 目标，实验性）
- 🔨 Overview job 表 + PDF 输入（M4）

---

## 10. 变更记录

### v3 → v3.1（2026-06-11）

| 类别 | 变更 |
|------|------|
| 视频战略 | 新增 **Video Clip** vs **Video Overview** 双线；明确不可单次 API 生成数分钟镜头 |
| Video Clip | 文档化 `duration` API 字段、异步 poll 架构、模型 maxDuration、多任务 UI |
| Video Overview | 新增 §5.7：对标 NotebookLM、路线 A/B/C、API 规划、分期与风险 |
| 已实现功能入 PRD | 模型关注（006）、可用性监控（007）、表格可用性列/关注过滤 |
| 路线图 | P3+ 勾选已完成项；新增 P4 视频 Overview 分期 |
| 用户故事 | 新增 Overview / 多段拼接 / 分镜导出故事 |

### v2 → v3（2026-06-11）

| 类别 | 变更 |
|------|------|
| 技术栈 | ImageRouter 废弃；OpenRouter `/api/v1/videos` BYOK |
| 定位修正 | 视频额度为参考值；视频按量计费 |
| 功能补全 | 推荐测试、订阅打通、Clawdbot/OpenClaw、i18n、搜索 URL 同步 |
| 链路修复 | restored / limit_change 推送；视频端点修正 |
| 基础设施 | Edge Function 5min；migrations 003~005 |
