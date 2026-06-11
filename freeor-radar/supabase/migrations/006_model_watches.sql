-- ============================================================
-- FreeOR Radar — Migration 006
-- 目的: 模型收藏/关注 + 定向提醒（PRD v3 后续候选 #1）
-- 设计: 沿用匿名 client_id 体系（同 notification_subscriptions），无需登录。
--       Cron 同步检测到被关注模型 下线/恢复/限流变更 时，
--       向该 client 已配置的 Telegram/Discord 渠道发送定向提醒。
-- 安全: RLS 锁定，所有读写经服务端 service_role API（/api/watches）。
-- 执行: Supabase Dashboard → SQL Editor → Run（幂等，可重复执行）
-- ============================================================

create table if not exists model_watches (
  id          serial primary key,
  -- 匿名归属（浏览器本地 UUID，存 localStorage）
  client_id   text not null,
  -- 被关注的模型（行永不物理删除，软删除仅置 is_free=false，FK 安全）
  model_id    text not null references free_models(id) on delete cascade,
  created_at  timestamp with time zone default now(),
  unique (client_id, model_id)
);

-- 索引：按 client 读取列表；Cron 按受影响模型反查关注者
create index if not exists idx_model_watches_client
  on model_watches(client_id);
create index if not exists idx_model_watches_model
  on model_watches(model_id);

-- RLS：对匿名/登录用户全部锁定，仅 service_role 可读写
alter table model_watches enable row level security;
-- 不创建任何 policy = 默认拒绝（service_role 绕过 RLS）

-- 验证
select column_name, data_type
from information_schema.columns
where table_name = 'model_watches'
order by ordinal_position;
