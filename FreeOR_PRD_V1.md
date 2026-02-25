# FreeOR Radar - 产品需求文档 (PRD v2)

**产品名称**：FreeOR Radar（免费 OpenRouter 雷达）  
**Slogan**：一键发现 OpenRouter 最新免费资源 + 视频生成智能助手  
**版本路线**：MVP（2026.03 上线）→ v1（多平台视频额度）→ v2（全 AI 网关）  
**目标**：让开发者与视频创作者零成本使用顶级 AI，成本从 $20/天降至接近 0  
**文档更新日期**：2026-02-25  
**开发者**：1 人 7 天完成 MVP

---

## 1. 产品概述与核心需求

FreeOR Radar 是 OpenRouter 免费资源的实时雷达 + 智能路由器，专注解决用户痛点：
- 免费模型随时新增/下线/限流，手动刷官网效率低
- 视频生成额度分散（Kling、Genmo、Pika、Higgsfield、OpenArt 等），无统一仪表盘
- Prompt 优化难度高

**MVP 核心价值**：实时推送 + 任务智能推荐 + 视频 Prompt 一键生成 + 一键免费路由

---

## 2. 用户画像

**Persona A：独立开发者**（30岁，构建 agent/bot，每天刷 X 找免费模型）
- 场景：早上打开产品看"今日新增免费模型"，发现新 Gemini 模型即刻一键测试

**Persona B：视频内容创作者**（25岁，用 Kling/Sora 生产内容）
- 痛点：额度不够 + prompt 难写  
- 场景：视频任务时直接生成专业 prompt，并查看今日各平台剩余额度

---

## 3. 技术栈

- **Framework**：Next.js 16.1.6（App Router + Turbopack + React 19）
- **UI 组件库**：shadcn/ui + Tailwind CSS + Radix UI + Lucide Icons
- **数据库**：Supabase（Postgres + Auth + Edge Functions + pgvector）
- **实时通知**：Telegram Bot API + Discord Webhook + X (Twitter) API
- **推送机制**：Supabase Edge Function（替代 Vercel Cron，延迟 < 5min）
- **部署**：Vercel（免费 Hobby 计划）
- **状态管理**：Zustand / React Server State
- **其他**：OpenRouter API（无 Key 可获取模型列表）、ImageRouter（视频 API 路由）

---

## 4. UI/UX 原型描述

**整体风格**：深色模式优先（dark bg #0a0a0a），科技感，绿色强调（#22c55e = 免费）。响应式，手机优先。支持中/英双语切换。

### 4.1 全局布局（Layout）
- **Sidebar（左侧固定，宽 280px）**：
  - Logo + 名称
  - 导航：仪表盘 / 视频专区 / 智能推荐 / 变更日志 / 集成中心 / 操作说明 / 设置
  - 底部：GitHub Star + 实时状态 + 语言切换（中/EN）
- **Topbar**：搜索框（全局搜模型）、"今日新增"徽章、通知按钮

### 4.2 首页 - 仪表盘（/）
- Hero 卡片：今日免费模型数量（大数字动画）+ "新增 N 个"按钮
- 免费模型表格（shadcn DataTable）：
  - 列：模型名（带 :free 标签）、提供商、上下文长度、能力标签（vision/tool/coding）、**限流提示**、最后更新
  - 过滤：搜索 + 多选标签 + 排序（上下文/速度）
  - 支持 CSV 导出
- 实时卡片区：Top 5 推荐免费模型（卡片网格）

### 4.3 视频生成专区（/video）
- 左侧表单：
  - 输入框："生成 30 秒产品演示视频"
  - 下拉：目标平台（Kling / Veo / Runway / Genmo / Higgsfield / OpenArt）
  - 一键生成 Prompt（7 大模板）
- 右侧预览区：
  - 生成的 Prompt（可编辑、可复制）
  - **今日额度追踪器（页面内联）**：Kling 66/66、Genmo ∞、Pika 80/80、Higgsfield N/N、OpenArt N/N——彩色进度条
- 底部：历史生成记录（可一键重新生成）

### 4.4 智能推荐页（/recommend）
- 大输入框 + "分析"按钮
- 输出卡片：
  1. 最佳免费模型（带一键复制 wrapper 代码）
  2. 理由 + 风险提示
  3. 备用 Top 3
  4. 测试按钮（直接调用 OpenRouter）

### 4.5 其他页面
- 变更日志（时间线）
- 集成中心（代码块 Tab：Python / JS / cURL / Aider / Clawdbot / OpenClaw）
- 操作说明（手风琴式功能说明）
- 设置（通知开关：Telegram / Discord / X，API Key 管理，语言切换）

---

## 5. 核心功能规格（MVP）

### 5.1 仪表盘首页
- 实时免费模型表格，含**限流提示**列（从 OpenRouter API `per_request_limits` 字段提取）
- 每小时自动同步，今日新增/下线实时显示

### 5.2 变更追踪
- 历史变更日志（new / limit_change / removed / restored）
- 推送渠道：Telegram / Discord / **X (Twitter)**
- **推送延迟目标：< 5 分钟**（通过 Supabase Edge Function 实现）

### 5.3 智能推荐引擎
- 输入任务描述 → 输出"最佳免费模型 + 理由 + wrapper 代码（Python/JS/cURL）"
- 可选：配置 OpenRouter API Key 后直接在页面内测试调用

### 5.4 视频生成专区
- **额度追踪器（页面内联）**：Kling / Pika / Genmo / Higgsfield / OpenArt
- 一键 Prompt 生成器（7 种模板适配 Kling/Veo/Runway）
- 路由测试：用免费 LLM 优化后通过 ImageRouter 调用视频 API

### 5.5 集成中心
- 一键复制：Python / JS / cURL / Aider 代码
- Clawdbot / OpenClaw 配置（待实现）

### 5.6 国际化
- 支持中/英双语切换
- 默认中文，用户可在设置或顶栏切换

---

## 6. 数据库 Schema（Supabase）

```sql
-- 免费模型注册表（核心）
create table free_models (
  id text primary key,           -- OpenRouter model ID
  name text,
  provider text,
  description text,
  context int,
  modality text,
  capabilities text[],
  pricing jsonb,
  is_free boolean default true,
  is_video_supported boolean default false,
  last_updated timestamp with time zone default now()
);

-- 变更日志
create table change_logs (
  id serial primary key,
  model_id text,
  change_type text,              -- "new" / "limit_change" / "removed" / "restored"
  description text,
  created_at timestamp default now()
);

-- 视频平台额度（含 Higgsfield / OpenArt）
create table video_credits (
  tool text primary key,
  daily_credits int,
  used_today int,
  updated_at timestamp
);
```

---

## 7. 用户故事（User Stories）

1. As a 用户，我能看到最新免费模型列表，按任务过滤，并看到**限流提示**。
2. As a 视频创作者，我输入"产品开箱视频"就能得到 Kling 专业 prompt + **页面内显示今日剩余 credits**。
3. As a 开发者，我收到"新 Gemini-2.0-flash:free 上线"推送（Telegram/Discord/X）并一键测试。
4. As a 用户，我可以切换中/英界面语言。

---

## 8. 非功能需求

| 需求 | 指标 |
|------|------|
| 性能 | 页面加载 < 2s，推送延迟 < 5min |
| 安全 | 不存储用户 prompt（除非付费隐私模式） |
| 多语言 | 中/英双语优先 |
| 可访问性 | 完全免费，手机友好 |

---

## 9. 功能优先级路线图

### P0 — MVP 硬要求（✅ 已完成 / 🔨 进行中）
- ✅ 仪表盘：实时模型表格（名称、提供商、上下文、能力）
- 🔨 仪表盘模型表格增加「限流提示」列
- 🔨 视频页内联今日额度显示（打通 CreditBanner）

### P1 — 上线前推荐
- Higgsfield / OpenArt 额度追踪
- 推送延迟优化（Supabase Edge Function）

### P2 — v1 迭代
- X (Twitter) 推送通知
- 中/英双语切换

### P3 — v2 迭代
- 社区评测功能
- Clawdbot / OpenClaw 集成
- ImageRouter 视频路由测试