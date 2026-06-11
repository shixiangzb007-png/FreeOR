# FreeOR Radar — 部署指南（DEPLOY.md）

本指南覆盖 FreeOR Radar 从零到上线的完整步骤：环境变量、数据库迁移、Vercel 部署、推送通知、以及"推送延迟 < 5 分钟"的 Supabase Edge Function 调度。

> **项目结构**：实际的 Next.js 应用位于 `freeor-radar/` 子目录。下文除特别说明外，命令均在 `freeor-radar/` 下执行。

---

## 1. 前置要求

| 依赖 | 用途 | 获取 |
|------|------|------|
| Node.js ≥ 20 | 运行 Next.js 16 / React 19 | https://nodejs.org |
| Supabase 项目 | Postgres + Realtime（模型/额度/订阅） | https://supabase.com |
| Vercel 账号 | 托管 Next.js + Cron 兜底 | https://vercel.com |
| OpenRouter API Key（用户侧，可选） | 智能推荐 LLM、视频生成（BYOK） | https://openrouter.ai/keys |
| Supabase CLI（可选） | 部署 Edge Function | `npm i -g supabase` |

---

## 2. 环境变量

在 `freeor-radar/.env.local`（本地）与 **Vercel 项目设置 → Environment Variables**（线上）中配置。

### 2.1 必填（服务端）

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL，如 `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key（前端只读） |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key（Cron / 订阅 API 写库，**切勿暴露到前端**） |
| `CRON_SECRET` | 保护 `/api/cron` 等定时端点。生成：`openssl rand -hex 32` |

### 2.2 可选

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | 你的站点域名，用于 OpenRouter `HTTP-Referer` 与推文链接 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token（服务端持有；用户只在设置页填 chat_id） |
| `TELEGRAM_CHAT_ID` | 官方默认推送频道（可选兜底，与用户订阅并行） |
| `DISCORD_WEBHOOK_URL` | 官方默认 Discord 频道（可选兜底） |
| `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | X(Twitter) 全站公开广播（OAuth 1.0a 四元组才能发推） |
| `X_BEARER_TOKEN` | 仅只读，**不能发推**（仅作占位提示） |

> X 推送是**全站官方账号广播**，非按用户订阅；用户侧无需配置 X。

---

## 3. 数据库初始化

在 **Supabase Dashboard → SQL Editor** 中**按顺序**执行 `freeor-radar/supabase/migrations/` 下的脚本：

| 顺序 | 文件 | 作用 |
|------|------|------|
| 1 | `001_initial_schema.sql` | 建表（free_models / change_logs / video_credits / 等）+ 索引 + RLS + 函数 |
| 2 | `002_add_rate_limits.sql` | 给 free_models 增加限流字段 |
| 3 | `003_notification_subscriptions_anon.sql` | 匿名通知订阅（client_id）+ 索引 |
| 4 | `004_seed_video_credits.sql` | 补齐/校准 7 个视频平台额度（含 higgsfield/openart） |
| 5 | `005_schedule_sync_cron.sql` | （可选，<5min 推送）pg_cron 调度，见第 6 节 |

> 这些脚本是**幂等**的，可重复执行。

执行完后，先**填充一次模型数据**（见 5.2 或 6.1）。

---

## 4. 本地开发

```bash
cd freeor-radar
npm install
# 配置 .env.local（见第 2 节）
npm run dev          # http://localhost:3000
```

### 4.1 手动触发一次同步（填充 free_models / change_logs）

确保 `.env.local` 含 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`，然后：

```bash
node scripts/sync-now.mjs
```

或在服务运行时调用受保护的同步端点：

```bash
curl -X POST http://localhost:3000/api/cron \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## 5. 部署到 Vercel

1. 在 Vercel 导入该 GitHub 仓库。
2. **Root Directory 设为 `freeor-radar`**（应用在子目录）。
3. 在 Environment Variables 中填入第 2 节的变量。
4. 部署。`freeor-radar/vercel.json` 已声明两条 Cron：
   - `/api/cron`（每小时）：同步模型 + 推送
   - `/api/cron/video-credits`（每天 UTC 01:00）：重置视频额度

> Vercel Cron 由平台按计划自动带上鉴权访问；`CRON_SECRET` 必须已配置，否则端点返回 503。
> 若使用第 6 节的 5 分钟方案，每小时 Cron 可保留作兜底（同步逻辑幂等，无变更不推送）。

---

## 6. 推送延迟 < 5 分钟（Supabase Edge Function，可选）

Vercel Hobby 计划的 Cron 频率有限，无法做到分钟级。用 Supabase Edge Function + pg_cron 每 5 分钟触发已有的 `/api/cron`。

### 6.1 部署 Edge Function

```bash
# 在仓库根或 freeor-radar 下（确保已 supabase login 并 link 到项目）
supabase functions deploy sync-cron

# 配置该函数的 Secrets
supabase secrets set SITE_URL=https://<你的-vercel-域名>
supabase secrets set CRON_SECRET=<与 Next.js 一致的 CRON_SECRET>
```

函数代码：`freeor-radar/supabase/functions/sync-cron/index.ts`（仅转调 `/api/cron`）。

### 6.2 调度（pg_cron）

在 SQL Editor 执行 `005_schedule_sync_cron.sql` 前，先在 Vault 登记两条机密（只需一次）：

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_base_url');
select vault.create_secret('<SERVICE_ROLE_KEY>', 'edge_auth_token');
```

然后运行 `005_schedule_sync_cron.sql`（启用 pg_cron/pg_net 并创建每 5 分钟任务）。验证：

```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'freeor-sync-every-5min';
```

停止调度：`select cron.unschedule('freeor-sync-every-5min');`

---

## 7. 推送通知配置

### 7.1 Telegram（按用户订阅）

1. 用 [@BotFather](https://t.me/BotFather) 创建 Bot，拿到 token，配置到 `TELEGRAM_BOT_TOKEN`（服务端）。
2. 让用户与该 Bot 建立对话（或把 Bot 拉进群）。
3. 用户在**设置页**填入自己的 Chat ID（与 [@userinfobot](https://t.me/userinfobot) 对话获取），保存后会写入 `notification_subscriptions`，每次同步检测到变更时自动推送。

### 7.2 Discord（按用户订阅）

用户在频道 设置 → 集成 → Webhooks 创建 Webhook URL，填入设置页保存即可。

### 7.3 X (Twitter)（官方广播）

配置第 2.2 节的 OAuth 1.0a 四元组到服务端环境变量，新增/下线模型时由官方账号自动发推。

> 设置页保存的 Telegram/Discord 经 `/api/subscriptions`（service_role）写库；`notification_subscriptions` 表对匿名锁定 RLS，不会暴露推送目标。

---

## 8. 视频生成说明（重要）

视频专区通过 OpenRouter 原生异步接口 `POST /api/v1/videos`（提交→轮询→取视频）实现。

- **OpenRouter 的视频模型均按用量计费**，没有免费视频模型。
- 因此视频生成需要用户提供**自己账户有余额的 OpenRouter Key（BYOK）**，在设置页填写。
- 余额不足/Key 无效时，界面会给出明确的 402/401 提示。

---

## 9. 视频平台额度抓取（可选，运维侧）

`scripts/scrape-credits.mjs` 可用 Playwright 登录各平台抓取真实剩余额度并写入 `video_credits`。

```bash
npm install playwright dotenv
npx playwright install chromium
# 在 .env.local 配置各平台账号：KLING_EMAIL/KLING_PASSWORD 等
node scripts/scrape-credits.mjs --update
```

> 仅供本地/服务器定时运行，**不要**部署到 Vercel。各平台 UI 变动时需维护选择器。
> 不运行此脚本时，额度展示使用 `004` 的静态 seed + 每日重置 Cron。

---

## 10. 上线自检清单

- [ ] `001`~`004` 迁移已执行，`free_models` 已有数据（跑过一次同步）
- [ ] Vercel Root Directory = `freeor-radar`，必填环境变量齐全
- [ ] `POST /api/cron`（带 `CRON_SECRET`）返回 `success: true`
- [ ] 设置页填 Telegram/Discord 保存后显示"已同步到云端"
- [ ] （可选）Edge Function 已部署、`005` 已调度、`cron.job` 可见任务
- [ ] （视频）用有余额的 OpenRouter Key 能成功生成一段视频
