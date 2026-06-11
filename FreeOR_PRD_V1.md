# FreeOR Radar - 产品需求文档 (PRD v3)

**产品名称**：FreeOR Radar（免费 OpenRouter 雷达）  
**Slogan**：一键发现 OpenRouter 最新免费资源 + 视频生成智能助手  
**版本路线**：MVP（已完成）→ v1（多平台视频额度，已完成）→ v2（全 AI 网关）  
**目标**：让开发者与视频创作者以接近零成本使用顶级 AI  
**文档更新日期**：2026-06-11（v3，对齐代码实现现状）  
**开发者**：1 人

> 📌 **v3 说明**：本版 PRD 以实际代码为准修订（应用位于 `freeor-radar/` 子目录）。
> 数据库结构以 `freeor-radar/supabase/migrations/` 为唯一事实来源；部署流程见根目录 `DEPLOY.md`。

---

## 1. 产品概述与核心需求

FreeOR Radar 是 OpenRouter 免费资源的实时雷达 + 智能路由器，专注解决用户痛点：
- 免费模型随时新增/下线/限流，手动刷官网效率低
- 视频生成额度分散（Kling、Pika、Genmo、Higgsfield、OpenArt 等），无统一参考
- Prompt 优化难度高

**MVP 核心价值**：实时推送 + 任务智能推荐 + 视频 Prompt 一键生成 + 一键免费路由

> ⚠️ **定位修正（v3）**：
> - "视频额度追踪器"展示的是**各平台公开免费额度上限（参考值）**，并非用户账户的实时余额（UI 已明确标注）。
> - OpenRouter 的**视频生成模型均按量计费**，无免费视频模型；视频生成功能需用户自带有余额的 OpenRouter Key（BYOK）。

---

## 2. 用户画像

**Persona A：独立开发者**（30岁，构建 agent/bot，每天刷 X 找免费模型）
- 场景：早上打开产品看"今日新增免费模型"，发现新 Gemini 模型即刻一键测试

**Persona B：视频内容创作者**（25岁，用 Kling/Sora 生产内容）
- 痛点：额度不够 + prompt 难写  
- 场景：视频任务时直接生成专业 prompt，并查看各平台免费额度参考

---

## 3. 技术栈（v3 对齐实际实现）

- **Framework**：Next.js 16.1.6（App Router + Turbopack + React 19）
- **UI**：Tailwind CSS 4 自研组件 + Lucide Icons（未使用 shadcn/ui / Radix）
- **状态管理**：React Server Components + 客户端 useState/Context（未使用 Zustand）
- **数据库**：Supabase（Postgres + Realtime + RLS + Vault；pgvector 列已预留但暂未启用 RAG）
- **国际化**：自研 `LangProvider` + 翻译表（`lib/i18n/lang-context.tsx`），中/英双语
- **实时通知**：Telegram Bot API + Discord Webhook + X (Twitter) API v2
- **同步与推送调度**：
  - Vercel Cron：每小时 `/api/cron`（兜底）+ 每日 UTC 01:00 重置视频额度
  - Supabase Edge Function `sync-cron` + pg_cron 每 5 分钟触发 → **推送延迟 < 5min 已达成**
- **视频生成**：OpenRouter 原生异步接口 `POST /api/v1/videos`（提交→轮询→取视频；BYOK）
  - ~~ImageRouter~~（已废弃，由 OpenRouter 原生方案替代）
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
  - 列：模型名（带 :free 标签 + 视频标记）、提供商、上下文长度、能力标签（vision/tool/coding）、**限流提示**（含 per_request_limits Tooltip）、最后更新
  - 过滤：搜索（与 URL `?search=` 双向同步）+ 能力多选 + Video 过滤 + 排序（上下文/更新时间）
  - 支持 CSV 导出
- 视频额度参考条（7 平台彩色进度条，含诚实标注）
- Top 5 推荐免费模型卡片

### 4.3 视频生成专区（/video）✅
- 左侧表单：目标平台（Kling / Veo / Runway / Genmo / Pika / Higgsfield / OpenArt）+ 7 大 Prompt 模板 + 主题输入 + 一键生成 Prompt
- 视频模型选择（OpenRouter 真实 slug：Seedance 2.0 / Kling v3.0 / Wan 2.7 / Veo 3.1 等，均为按量计费）+ 提交生成（异步轮询，约 100s 上限）
- 右侧：Prompt 预览（可编辑/复制）+ 今日额度参考（内联）+ Prompt 历史 + 视频任务面板（播放/下载/重试/删除，localStorage 持久化）

### 4.4 智能推荐页（/recommend）✅
- 大输入框 + 分析按钮（规则引擎默认；配置 Key 后启用 LLM 模式）
- 输出卡片：最佳免费模型 + 理由 + 风险提示 + 备用 Top 3 + wrapper 代码（Python/JS/cURL 一键复制）
- **测试调用**：页面内直接调用 OpenRouter 验证推荐模型（展示回复/耗时/tokens）

### 4.5 其他页面 ✅
- 变更日志（时间线，4 种类型：new / limit_change / removed / restored）
- 集成中心（代码块 Tab：Python / JavaScript / cURL / Aider / Clawdbot / OpenClaw）
- 操作说明（分步指南）
- 设置（通知开关与渠道、Telegram/Discord 测试消息按钮、云端订阅同步与回读、OpenRouter API Key 管理）

---

## 5. 核心功能规格（现状）

### 5.1 仪表盘首页 ✅
- 实时免费模型表格，含**限流提示**列（`per_request_limits` → `rate_limit_level` 三档 + Tooltip）
- 每 5 分钟（Edge Function）/ 每小时（Vercel 兜底）自动同步，今日新增/下线实时显示

### 5.2 变更追踪与推送 ✅
- 变更日志四类全链路：new / limit_change / removed / **restored**（软删除模型回归时正确识别）
- 推送渠道：
  - **按用户订阅**：Telegram / Discord（设置页保存 → `notification_subscriptions`（client_id 匿名制）→ Cron 按各自 event_types 分发；支持"发送测试消息"即时验证）
  - **官方广播**：X (Twitter)（服务端 OAuth 1.0a 四元组，全站统一发布）+ env 默认 TG/Discord 频道兜底
- **推送延迟 < 5 分钟**：已通过 Supabase Edge Function + pg_cron 达成
- 防滥用：订阅写入 10 次/分/IP、测试消息 3 次/分/IP 速率限制 + 格式校验

### 5.3 智能推荐引擎 ✅
- 双模式：关键词规则引擎（默认，零成本）/ LLM 分析（用户 Key，失败自动回退规则）
- 输出"最佳免费模型 + 理由 + 风险提示 + wrapper 代码（Python/JS/cURL）"
- 页面内一键测试调用 OpenRouter

### 5.4 视频生成专区 ✅（定位已修正）
- **额度参考（页面内联）**：Kling / Pika / Genmo / Runway / Veo / Higgsfield / OpenArt——展示公开免费额度上限，UI 明确标注非账户实时余额；每日 UTC 01:00 重置
- 一键 Prompt 生成器（7 种模板，平台自适应过滤）
- 视频生成：OpenRouter 原生 `/api/v1/videos` 异步管线（需 BYOK，按量计费）
- 可选运维：`scripts/scrape-credits.mjs`（Playwright 抓取真实用量，本地/服务器运行）

### 5.5 集成中心 ✅
- 一键复制：Python / JavaScript / cURL / Aider / **Clawdbot / OpenClaw** 全部完成

### 5.6 国际化 ✅
- 中/英双语切换（默认中文），覆盖全部页面与组件（含模型表格、额度 Banner、Topbar）

---

## 6. 数据库 Schema（Supabase）

> **唯一事实来源**：`freeor-radar/supabase/migrations/`（001~005，幂等可重复执行）。下表为概要。

| Migration | 内容 |
|-----------|------|
| `001_initial_schema.sql` | `free_models`（含 is_video_supported / throughput / embedding 预留列）、`change_logs`（含 old_data/new_data 快照）、`video_credits`、`user_preferences`、`notification_subscriptions` + 索引 + RLS + `reset_daily_video_credits()` / `get_model_stats()` |
| `002_add_rate_limits.sql` | `free_models` 增加 `per_request_limits` / `rate_limit_level`（限流提示列数据源） |
| `003_notification_subscriptions_anon.sql` | 订阅表增加 `client_id`（匿名浏览器 UUID 归属）+ 唯一约束/索引；写入仅经 service_role API |
| `004_seed_video_credits.sql` | 7 平台额度 seed/校准（含 higgsfield/openart；不重置 used_today） |
| `005_schedule_sync_cron.sql` | pg_cron 每 5 分钟触发 Edge Function `sync-cron`（机密走 Vault） |

> 已知预留未启用：`free_models.embedding`（pgvector RAG）、`throughput_tokens_per_s` / `latency_ms`（速度排序数据源，待可用性监控功能补充）、`user_preferences`（待收藏功能启用）。

---

## 7. 用户故事（User Stories）

1. ✅ As a 用户，我能看到最新免费模型列表，按任务过滤，并看到**限流提示**。
2. ✅ As a 视频创作者，我输入"产品开箱视频"就能得到 Kling 专业 prompt + 页面内查看各平台免费额度参考。
3. ✅ As a 开发者，我收到"新模型上线"推送（Telegram/Discord/X），并可在推荐页一键测试。
4. ✅ As a 用户，我可以切换中/英界面语言。
5. ✅ As a 用户，我在设置页填好 Telegram/Discord 后可立即"发送测试消息"验证通道。

---

## 8. 非功能需求

| 需求 | 指标 | 状态 |
|------|------|------|
| 性能 | 页面加载 < 2s | ✅（RSC + revalidate 300s） |
| 推送延迟 | < 5 分钟 | ✅（Edge Function + pg_cron） |
| 安全 | 不在服务端存储用户 prompt；用户 Key 仅存浏览器 localStorage；Cron/订阅 API 鉴权与限速 | ✅ |
| 多语言 | 中/英双语 | ✅ |
| 成本 | 模型列表/推送/规则推荐完全免费；LLM 推荐与视频生成需用户自带 Key（视频按量计费） | ✅（定位已修正） |

---

## 9. 功能路线图（v3 状态）

### P0 — MVP 硬要求 ✅ 全部完成
- ✅ 仪表盘：实时模型表格（名称、提供商、上下文、能力）
- ✅ 仪表盘模型表格「限流提示」列
- ✅ 视频页内联今日额度显示（CreditBanner 已打通）

### P1 — 上线前推荐 ✅ 全部完成
- ✅ Higgsfield / OpenArt 额度（seed + 每日重置；真实用量为可选运维脚本）
- ✅ 推送延迟优化（Supabase Edge Function + pg_cron，<5min）

### P2 — v1 迭代 ✅ 全部完成
- ✅ X (Twitter) 推送通知（官方广播）
- ✅ 中/英双语切换

### P3 — v2 迭代（已决策）
- ❌ 社区评测功能 — **跳过，不做**（2026-06 决策）
- ✅ Clawdbot / OpenClaw 集成 — 已完成
- ❌ ImageRouter 视频路由 — **废弃**，已由 OpenRouter 原生 `/api/v1/videos` 替代

### v3 后续候选（按价值排序，未排期）
1. 模型收藏/关注 + 定向下线提醒（基于现有 client_id 体系，无需登录）
2. 模型详情页（变更历史、限流变化、同家族对比）
3. 免费模型可用性监控（定期探测延迟/429 率 → 填充 throughput/latency 列，启用"速度"排序）
4. 推送消息可操作化（deep link + 一键复制 model id）
5. Web Push 浏览器通知（第四渠道）
6. 工程质量：测试覆盖、Cron 失败管理员告警、正式 README

---

## 10. v2 → v3 变更记录（2026-06-11）

| 类别 | 变更 |
|------|------|
| 技术栈 | 移除未使用的 shadcn/Radix/Zustand；ImageRouter 标记废弃，视频改用 OpenRouter 原生 `/api/v1/videos`（BYOK） |
| 定位修正 | 视频额度 = 平台公开免费额度参考（非账户实时余额，UI 已标注）；视频生成按量计费需自带 Key |
| 功能补全 | 推荐页一键测试；设置↔推送订阅打通（client_id 匿名制）+ 测试消息按钮 + 云端回读；Clawdbot/OpenClaw；模型表/Banner/Topbar 全量 i18n；搜索 URL 双向同步；Topbar 今日新增实时计数 |
| 链路修复 | `restored` 变更类型正确产出（软删除回归识别）；`limit_change` 推送渲染打通（TG/Discord）；推荐页 Key 读取键名修复；视频生成端点修正 |
| 基础设施 | Edge Function + pg_cron 5 分钟调度；订阅/测试 API 速率限制；migrations 003~005 |
| 决策 | 社区评测跳过；ImageRouter 废弃 |
