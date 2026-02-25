-- ============================================================
-- FreeOR Radar — 完整数据库重建脚本
-- 版本: v1.1 (含 OpenRouter Sync Skill 字段)
-- 用途: 在空白 Supabase 项目中，一键创建所有表 + 索引 + RLS + 函数
-- 执行方式: 粘贴至 Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 0. 清理旧表（如需全新重建，请取消下方注释）─────────────────
-- drop table if exists notification_subscriptions cascade;
-- drop table if exists user_preferences cascade;
-- drop table if exists video_credits cascade;
-- drop table if exists change_logs cascade;
-- drop table if exists free_models cascade;

-- ── 1. 启用扩展 ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- TABLE 1: free_models — 免费模型注册表（核心）
-- ============================================================
create table if not exists free_models (
  -- 主键：OpenRouter model ID，例如 "meta-llama/llama-3.1-8b-instruct:free"
  id                    text primary key,
  name                  text not null,
  -- 从 id 斜杠前提取，例如 "meta-llama"
  provider              text,
  -- OpenRouter 原始模型描述 [Skill v1]
  description           text,
  -- 上下文窗口 (tokens)
  context               int,
  -- architecture.modality，例如 "text->text", "text+image->text" [Skill v1]
  modality              text,
  -- 派生能力标签，例如 '{"vision","tool","coding"}'
  capabilities          text[] default '{}',
  -- 原始定价 JSON，免费模型 prompt/completion 均为 "0"
  pricing               jsonb default '{"prompt":"0","completion":"0"}',
  throughput_tokens_per_s float,
  latency_ms            float,
  -- 最后同步时间
  last_updated          timestamp with time zone default now(),
  -- 软删除标记：false = 已从免费列表移除，不删行
  is_free               boolean default true,
  -- 视频/多模态支持标记 [Skill v1 核心字段]
  is_video_supported    boolean default false,
  -- pgvector 向量，用于 RAG 智能推荐
  embedding             vector(1536)
);

comment on column free_models.is_video_supported
  is 'True when description or modality contains: video, multimodal, image-to-video, vision, visual, image';
comment on column free_models.is_free
  is 'Soft-delete: set to false when model leaves free tier. Row is never deleted.';

-- ============================================================
-- TABLE 2: change_logs — 变更日志
-- ============================================================
create table if not exists change_logs (
  id          serial primary key,
  model_id    text references free_models(id) on delete set null,
  change_type text not null check (change_type in ('new', 'limit_change', 'removed', 'restored')),
  description text,
  -- 变更前数据快照 (JSON)
  old_data    jsonb,
  -- 变更后数据快照 (JSON)
  new_data    jsonb,
  created_at  timestamp with time zone default now()
);

-- ============================================================
-- TABLE 3: video_credits — 视频平台每日额度追踪
-- ============================================================
create table if not exists video_credits (
  tool          text primary key,     -- 平台名: kling, genmo, pika, runway, veo
  daily_credits int  not null default 0,
  used_today    int  not null default 0,
  updated_at    timestamp with time zone default now(),
  reset_at      timestamp with time zone
);

-- 初始数据
insert into video_credits (tool, daily_credits, used_today) values
  ('kling',   66,     0),
  ('genmo',   999999, 0),   -- 实际无限制，用大数表示
  ('pika',    80,     0),
  ('runway',  0,      0),
  ('veo',     0,      0)
on conflict (tool) do nothing;

-- ============================================================
-- TABLE 4: user_preferences — 用户个性化偏好
-- ============================================================
create table if not exists user_preferences (
  user_id                 uuid references auth.users(id) on delete cascade primary key,
  favorite_models         text[] default '{}',
  preferred_capabilities  text[] default '{}',
  notification_enabled    boolean default true,
  created_at              timestamp with time zone default now()
);

-- ============================================================
-- TABLE 5: notification_subscriptions — 通知订阅
-- ============================================================
create table if not exists notification_subscriptions (
  id          serial primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  -- 推送渠道
  channel     text not null check (channel in ('telegram', 'discord', 'email')),
  -- 目标地址: Telegram chat_id / Discord webhook URL / email
  target      text not null,
  -- 订阅的事件类型
  event_types text[] default '{"new","removed"}',
  is_active   boolean default true,
  created_at  timestamp with time zone default now()
);

-- ============================================================
-- 索引
-- ============================================================

-- 主查询索引：免费 + 最新
create index if not exists idx_free_models_is_free_updated
  on free_models(is_free, last_updated desc);

-- 视频筛选专用索引 [Skill v1]
create index if not exists idx_free_models_is_video
  on free_models(is_video_supported)
  where is_free = true;

-- 按提供商查询
create index if not exists idx_free_models_provider
  on free_models(provider);

-- 变更日志时序查询
create index if not exists idx_change_logs_created_at
  on change_logs(created_at desc);

-- 变更日志关联查询
create index if not exists idx_change_logs_model_id
  on change_logs(model_id);

-- pgvector 近似最近邻索引（需要至少插入一条数据后才能生效）
create index if not exists idx_free_models_embedding
  on free_models using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- free_models: 任何人可读，写入仅限 service_role
alter table free_models enable row level security;
drop policy if exists "free_models_public_read" on free_models;
create policy "free_models_public_read"
  on free_models for select using (true);

-- change_logs: 任何人可读
alter table change_logs enable row level security;
drop policy if exists "change_logs_public_read" on change_logs;
create policy "change_logs_public_read"
  on change_logs for select using (true);

-- video_credits: 任何人可读
alter table video_credits enable row level security;
drop policy if exists "video_credits_public_read" on video_credits;
create policy "video_credits_public_read"
  on video_credits for select using (true);

-- user_preferences: 仅自己可读写
alter table user_preferences enable row level security;
drop policy if exists "user_preferences_own_data" on user_preferences;
create policy "user_preferences_own_data"
  on user_preferences
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notification_subscriptions: 仅自己可读写
alter table notification_subscriptions enable row level security;
drop policy if exists "notification_subscriptions_own_data" on notification_subscriptions;
create policy "notification_subscriptions_own_data"
  on notification_subscriptions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 辅助函数
-- ============================================================

-- 重置每日视频额度（由每日 Cron 调用）
create or replace function reset_daily_video_credits()
returns void
language plpgsql security definer
as $$
begin
  update video_credits
  set
    used_today = 0,
    updated_at = now(),
    reset_at   = now();
end;
$$;

-- 仪表盘统计摘要
create or replace function get_model_stats()
returns json
language plpgsql
as $$
declare
  result json;
begin
  select json_build_object(
    'total_free_models',  count(*),
    'video_supported',    count(*) filter (where is_video_supported = true),
    'providers',          count(distinct provider),
    'new_today', (
      select count(*)
      from change_logs
      where change_type = 'new'
        and created_at > now() - interval '24 hours'
    ),
    'removed_today', (
      select count(*)
      from change_logs
      where change_type = 'removed'
        and created_at > now() - interval '24 hours'
    )
  )
  into result
  from free_models
  where is_free = true;

  return result;
end;
$$;

-- ============================================================
-- 验证（运行后检查输出）
-- ============================================================
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where tablename in (
  'free_models',
  'change_logs',
  'video_credits',
  'user_preferences',
  'notification_subscriptions'
)
order by tablename;
