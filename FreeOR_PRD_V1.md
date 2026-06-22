# FreeOR Radar - 产品需求文档 (PRD v3.2)

**产品名称**：FreeOR Radar（免费 OpenRouter 雷达）  
**Slogan**：一键发现 OpenRouter 最新免费资源 + 视频生成智能助手  
**版本路线**：MVP（已完成）→ v1（多平台视频额度，已完成）→ v2（视频三线：Clip + Character + Overview）→ v3（全 AI 网关）  
**目标**：让开发者与视频创作者以接近零成本使用顶级 AI  
**文档更新日期**：2026-06-11（v3.2，角色参考视频规划 + 仪表盘简介列 + Overview M1 对齐）  
**开发者**：1 人

> 📌 **v3.2 说明**：本版 PRD 以实际代码为准修订（应用位于 `freeor-radar/` 子目录）。
> 数据库结构以 `freeor-radar/supabase/migrations/` 为唯一事实来源；部署流程见根目录 `DEPLOY.md`。
> **v3.2 重点**：新增 **Character Clip（角色视频）** 产品线规划——用户上传角色参考图，通过 OpenRouter `input_references` 生成高一致性人物短片，并与路线 B 多段拼接结合以突破单段时长上限；同步记录仪表盘「功能简介」列与 Video Overview M1 实现状态。

> 📌 **v3.1 说明（保留）**：视频能力拆为 **Video Clip** 与 **Video Overview** 两条产品线；时长参数、分段生成与合成方案的技术决策见 §5.4 / §5.7。

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

> 📌 **视频三线定位（v3.2 更新）**：
>
> | 产品线 | 用户价值 | 典型时长 | 状态 |
> |--------|----------|----------|------|
> | **Video Clip** | 单镜头 AI 视频片段（广告、B-roll、动效预览） | 5–12s / 段（受模型上限约束） | ✅ 已实现 |
> | **Character Clip** | 上传角色参考图 → 按 Prompt 生成**同一角色**的短片（角色参考模式） | 5–12s / 段；多段拼接可达 30s+ | 📋 规划中（§5.9） |
> | **Video Overview** | 资料/主题 → 旁白解说型长视频（对标 NotebookLM Video Overview） | 3–5 分钟（Brief）/ 更长（Explainer） | ✅ M1 已实现（WebM）；M2 规划中 |
>
> **不可混淆**：OpenRouter `POST /api/v1/videos` 单次调用**不能**直接生成数分钟连续镜头。长时长来自「多段编排 + 合成」：Overview 用配图+旁白；Character Clip / 路线 B 用多段 Clip + 参考图 + ffmpeg 拼接。

---

## 2. 用户画像

**Persona A：独立开发者**（30岁，构建 agent/bot，每天刷 X 找免费模型）
- 场景：早上打开产品看"今日新增免费模型"，发现新 Gemini 模型即刻一键测试

**Persona B：视频内容创作者**（25岁，用 Kling/Sora 生产内容）
- 痛点：额度不够 + prompt 难写 + 想要 30s 广告片或 3min 解说视频；**同一 IP/角色在多镜头间外观不一致**  
- 场景（Clip）：生成 10s 产品镜头 + 专业 Prompt  
- 场景（Character Clip，规划）：上传原创角色设定图 → 生成「角色在雨中行走」10s 短片，多段拼接 30s 广告  
- 场景（Overview）：粘贴文稿/主题 → 3 分钟 Brief 解说视频，可下载分镜与旁白稿

**Persona C：知识工作者**（对标 NotebookLM 用户）
- 痛点：长 PDF/笔记难以快速消费  
- 场景（Overview，规划）：上传摘要或粘贴要点 → Explainer 格式 5 分钟视频概览

---

## 3. 技术栈（v3.2 对齐实际实现）

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
- **Character Clip（规划，v3.2）**：
  - OpenRouter `input_references`：参考图引导主体身份/风格（非首帧锚定）；与 `frame_images` 互斥语义见 OpenRouter 文档
  - 首选模型：Seedance 2.0 / Wan 2.7（需 `GET /api/v1/videos/models` 动态校验 `input_references` 支持）
  - 角色图存储：Supabase Storage 或 localStorage（MVP）；生成前须为 **HTTPS 可访问 URL**
  - 多段同角色：每段携带同一 `input_references` 集 + 路线 B 可选 `frame_images` 段间衔接 + ffmpeg 拼接
- **Video Overview（M1 已实现，M2 规划中）**：
  - LLM/规则分镜 → OpenRouter 图像 → 浏览器 WebCodecs + webm-muxer 合成 WebM（Ken Burns + 字幕）
  - M2：TTS 旁白、MP4/ffmpeg 导出、PDF 输入、云端 job 持久化
  - 可选增强：关键场景插入 Character Clip / Video Clip 动态镜头
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
  - 列：模型名、提供商、**功能简介**（OpenRouter `description`；悬停显示全文）、上下文、能力、**限流提示**、**可用性**（探测延迟/状态）、最后更新
  - 过滤：搜索（名称/提供商/简介；URL `?search=` 同步）+ 能力 + Video + **已关注** + 排序（上下文/更新时间/响应速度）
  - 星标关注模型；CSV 导出
- 视频额度参考条（7 平台，诚实标注）
- Top 5 推荐免费模型卡片

### 4.3 视频专区（/video）✅ + 📋 规划扩展

**Tab A — Video Clip（✅ 已实现）**
- 子模式（规划 v3.2）：**自由生成**（现有）| **角色视频**（Character Clip，见 §5.9）
- 左侧：目标平台 + 7 大 Prompt 模板 + 主题输入 + **视频时长选择**（按模型 max 过滤）+ 模型选择 + 提交
- 右侧：Prompt 预览/编辑 + 额度参考 + Prompt 历史 + **多任务面板**（pending / processing / succeed / failed；localStorage 持久化；刷新可恢复轮询）
- 时长逻辑：模板 `durationSeconds` → UI 选择 → API `duration` 字段；超出模型上限时 clamp 并提示

**Tab B — Video Overview（✅ M1 已实现；M2 规划中，见 §5.7）**
- 输入：粘贴长文 / 主题描述 /（远期）PDF 摘要
- 格式：**Brief**（~3min）/ **Explainer**（~5min+）
- 视觉风格：白板 / 极简 / 复古等（Prompt 级）
- 输出（M1）：成片 **WebM** + 分镜 JSON 下载；字幕轨（无 TTS）；合成约 10–30s（WebCodecs）
- 输出（M2 规划）：MP4 + 旁白音轨 + 后台长任务进度

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

### 5.7 Video Overview — 长视频解说（✅ M1 已实现；M2 规划中）

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

#### 5.7.4 API / 数据

| 端点 | 说明 | 状态 |
|------|------|------|
| `POST /api/video/overview/plan` | 输入 + 格式 → 分镜脚本 | ✅ M1 |
| `POST /api/video/overview/image` | 单场景配图（OpenRouter 图像模型 + fallback） | ✅ M1 |
| 客户端 `composeOverviewVideo` | WebCodecs + webm-muxer 合成 WebM | ✅ M1 |
| `POST /api/video/overview/render` | 启动后台任务 → `{ job_id }` | 📋 M2 |
| `GET /api/video/overview/status?id=` | 进度 + 成片 URL | 📋 M2 |

可选表 `video_overview_jobs`（008，client_id、status、scenes_json、output_url）——M2 与 localStorage 并存。

#### 5.7.5 分期交付

| 阶段 | 范围 | 验收 | 状态 |
|------|------|------|------|
| **P4-M1** | 路线 A：文本 → 分镜 → 配图 → 字幕合成 Brief ~3min WebM | 可下载 WebM + 分镜 JSON | ✅ |
| **P4-M2** | Explainer + TTS + MP4 + 视觉风格 + 长任务 UI | 5min 级成片 + 音轨 | 📋 |
| **P4-M3** | 路线 B：Clip 多段拼接（30s 目标）+ 段间分镜 LLM | 3 段连续叙事（best-effort） | 📋 |
| **P4-M4** | PDF 输入、Highlight Reel、job 持久化（008） | 对标 NotebookLM 核心路径 | 📋 |

#### 5.7.6 风险与诚实边界

- 路线 B **不能承诺**电影级无缝衔接；需 UI 标注「实验性」  
- Overview 生成时间可能 **10–30 分钟**；必须异步 + 可离开页面  
- 所有生成均 BYOK；需在 UI 预估 token/秒级费用  
- 不复制 Google 专有模型栈；定位为 **OpenRouter 生态的 NotebookLM 式解说工具**

### 5.8 模型关注与可用性监控 ✅（v3.1 已实现）

- **模型关注**：`model_watches`（006）+ `/api/watches` + 表格星标；Cron `notifyWatchers` 定向 TG/Discord  
- **可用性监控**：`model_probes`（007）+ `/api/cron/probe`；表格「可用性」列 + 延迟排序；需 `OPENROUTER_PROBE_API_KEY`

### 5.9 Character Clip — 角色参考视频（📋 v3.2 规划）

> **需求来源**：单段 Clip 受模型 max 时长限制（8–12s）；纯文本 Prompt 无法保证同一角色在多镜头间外观一致。用户希望**上传角色设定图**，后续按 Prompt 生成视频时人物尽量保持同一形象。

#### 5.9.1 产品定位

| 维度 | 说明 |
|------|------|
| **命名** | Character Clip / 角色视频（UI 避免承诺「100% 严格一致」） |
| **模式** | **角色参考模式（高一致性，best-effort）** |
| **与 Clip 关系** | Video Clip Tab 下新增子模式，共用任务面板与 poll 管线 |
| **与 Overview 关系** | Overview 偏知识解说；Character Clip 偏同一 IP 的短视频广告/剧情 |
| **与路线 B 关系** | Character Clip 提供**身份层**（`input_references`）；路线 B 提供**时长层**（多段 + 拼接） |

#### 5.9.2 OpenRouter 技术契约

OpenRouter 视频 API 支持两类图像输入（不可混用语义）：

| 参数 | 用途 | Character Clip 用法 |
|------|------|---------------------|
| **`input_references`** | 参考图引导主体身份、风格、内容（非精确帧） | **核心**：每段生成都携带同一套角色参考图 |
| **`frame_images`** | `first_frame` / `last_frame` 精确锚定起止画面 | **可选增强**：路线 B 段间衔接（上段末帧 → 下段首帧） |

> ⚠️ 若同时传 `frame_images` 与 `input_references`，OpenRouter 按 **image-to-video** 处理，参考图语义减弱。Character 模式默认**仅** `input_references`；段间衔接场景单独评估。

**请求扩展示例（规划）**：

```json
{
  "model": "bytedance/seedance-2.0",
  "prompt": "Character walks through rainy Tokyo street, cinematic lighting. Keep same person as references.",
  "duration": 10,
  "input_references": [
    { "type": "image_url", "image_url": { "url": "https://storage.example/character-front.png" } }
  ]
}
```

**模型选型（规划，实现前须调 `/api/v1/videos/models` 校验）**：

| 模型 | max 时长 | 参考图 | 角色一致性预期 | 建议 |
|------|----------|--------|----------------|------|
| Seedance 2.0 | 12s | ✅ | 较好 | **首选** |
| Wan 2.7 | 10s | ✅ | 较好 | 备选 |
| Kling v3 | 10s | 待验证 | 中等 | 实测后决定 |
| Veo 3.1 | 8s | 待验证 | 偏弱 | 不推荐角色锁定 |

#### 5.9.3 用户流程

```
① 创建角色（一次性）
   上传 1–3 张图：正面（必填）、侧面/全身（可选）
   + 角色名、外观描述（发色、服装、风格）
   可选：图像模型生成「标准设定图」再入库

② 单段生成（P5-M1）
   选择角色 → 写动作/场景 Prompt → 选支持参考图的模型 → 生成

③ 多段同角色长片（P5-M2，结合路线 B）
   目标时长 30s → 拆 ⌈30/max⌉ 段
   → LLM 分段脚本（动作变、角色不变）
   → 每段相同 input_references → 串行生成 → ffmpeg 拼接
```

**Prompt 策略（系统模板，用户只写动作/场景）**：

```
[Character reference images provided]
Keep the same person: {character.description}.
Same face, hair, outfit, and art style as reference images.
Scene action: {user_prompt}
Do not change character identity.
```

#### 5.9.4 API / 数据（规划）

| 端点 | 说明 |
|------|------|
| `POST /api/video/characters` | 创建/更新角色（含图片上传） |
| `GET /api/video/characters` | 列出用户角色 |
| `POST /api/video/generate`（扩展） | 增加 `character_id` 或 `input_references[]` |
| `POST /api/video/clip/plan` | 目标时长 + 角色 + 主题 → 多段脚本 |
| `POST /api/video/clip/stitch` | 多段视频拼接（ffmpeg.wasm 或服务端） |

| 存储 | 内容 | MVP | 正式 |
|------|------|-----|------|
| `video_characters` | id, client_id, name, description, image_urls[], created_at | localStorage | Supabase（009） |
| Supabase Storage | 角色参考图 HTTPS URL | 可选 | 推荐 |

#### 5.9.5 分期交付

| 阶段 | 范围 | 验收 |
|------|------|------|
| **P5-M1** | 角色上传 + 单段 `input_references` + Seedance 2.0 | 10s 角色短片可下载 |
| **P5-M2** | 30s 多段同角色 + LLM 分镜 + 拼接 | 3 段 best-effort 连续叙事 |
| **P5-M3** | 角色库云端同步 + 多角度参考 + Overview 主持人模式 | 跨设备角色复用 |
| **P5-M4** | 合规（真人 likeness 提示/拦截）+ 一致性反馈闭环 | ToS + 上传策略 |

#### 5.9.6 风险与诚实边界

- **不能承诺**像素级或 100% 跨段严格一致；UI 文案为「角色参考模式」  
- 参考图须 **HTTPS 可访问**；生成前做 URL 可达性检查  
- 多段生成 **费用与时间成倍**；须生成前展示段数与预估成本  
- **真人照片**存在 likeness / 深度伪造合规风险；禁止未授权真人，MVP 可优先支持插画/原创角色  
- Veo 等 cinematic 模型不适合作为角色锁定首选

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
| `008_video_overview_jobs.sql`（规划） | Overview 长任务 job 表（M2） |
| `009_video_characters.sql`（规划） | Character Clip 角色库 + Storage 策略 |

> 预留未启用：`free_models.embedding`（RAG）、`user_preferences`（收藏已用 `model_watches` 替代）

---

## 7. 用户故事（User Stories）

### 已完成 ✅
1. 查看最新免费模型列表，按任务过滤，看到限流、**可用性**与**功能简介**。  
2. 视频创作者：一键 Prompt + **可选时长** + Clip 生成 + 额度参考。  
3. 开发者：变更推送 + 推荐页测试 + 集成代码复制。  
4. 中/英切换；Telegram/Discord 测试消息。  
5. **关注模型**并在下线/限流变更时收到定向提醒。  
6. 粘贴笔记生成 **Brief 解说视频**（Video Overview M1，WebM + 分镜 JSON）。

### 规划中 📋
7. As a 创作者，我上传**角色设定图**，按 Prompt 生成同一角色的 10s 短片（Character Clip P5-M1）。  
8. As a 创作者，我要 **30s 同角色广告片**，系统自动拆成多段 Clip、每段带相同参考图并拼接（Character + 路线 B）。  
9. As a 用户，Overview **M2**：TTS 旁白 + MP4 导出 + PDF 输入。  
10. As a 开发者，我下载 **分镜 JSON + 旁白稿**，接入自己的剪辑流程。

---

## 8. 非功能需求

| 需求 | 指标 | 状态 |
|------|------|------|
| 性能 | 页面加载 < 2s | ✅ |
| 推送延迟 | < 5 分钟 | ✅ |
| Clip 轮询 | 单段 poll < 30s；总等待 ≤ 10min | ✅ |
| Overview 生成 | M1：WebCodecs 合成 10–30s；M2：异步长任务 | ✅ M1 / 📋 M2 |
| 安全 | Key 仅存 localStorage；Cron/订阅限速；video poll URL 域名校验 | ✅ |
| 多语言 | 中/英 | ✅ |
| 成本 | 雷达/推送/规则推荐免费；Clip/Overview BYOK | ✅ |

---

## 9. 功能路线图（v3.2 状态）

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

### P4 — 视频三线（v3.1–v3.2）
- ✅ **Video Overview M1**：路线 A（文本 → 分镜 → 配图 → WebM Brief）
- 🔨 **Video Overview M2**：TTS + MP4 + Explainer + 长任务 UI + 008 job 表
- 🔨 **Video Clip 增强**：路线 B 多段拼接（30s 目标，实验性）
- 🔨 **Character Clip P5-M1**：角色上传 + `input_references` 单段生成
- 🔨 **Character Clip P5-M2**：多段同角色 + 拼接（与路线 B 合并）
- 🔨 Overview M4：PDF 输入、Highlight Reel

---

## 10. 变更记录

### v3.1 → v3.2（2026-06-11）

| 类别 | 变更 |
|------|------|
| 视频战略 | 视频双线升级为**三线**：Clip + **Character Clip** + Overview |
| Character Clip | 新增 §5.9：角色参考图、`input_references` vs `frame_images`、模型选型、API/分期/合规 |
| Video Overview | M1 标记为 ✅（plan/image/WebCodecs WebM）；M2 仍为 TTS/MP4/job 表 |
| 仪表盘 | 免费模型表新增**功能简介**列（`description` + 悬停全文 Tooltip） |
| 数据库规划 | 新增 `009_video_characters.sql` |
| 路线图 | P4 Overview M1 完成；新增 P5 Character Clip 分期 |
| 用户故事 | 新增角色视频、同角色 30s 拼接；Overview 移入已完成 |

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
