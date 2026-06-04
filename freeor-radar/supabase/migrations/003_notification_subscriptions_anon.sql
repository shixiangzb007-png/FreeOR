-- ============================================================
-- FreeOR Radar — Migration 003
-- 目的: 让无登录(匿名)用户也能保存通知订阅，并打通设置页 ↔ Cron 推送
-- 背景: 原 notification_subscriptions 依赖 auth.users(user_id)，但本产品无登录流程。
--       这里新增 client_id(浏览器本地生成的 UUID) 作为匿名订阅归属标识。
--       写入统一经由 service_role 的服务端 API(/api/subscriptions)，RLS 保持对匿名锁定。
-- 执行: Supabase Dashboard → SQL Editor → Run（幂等，可重复执行）
-- ============================================================

-- 1. 新增列：匿名归属标识 + 更新时间
alter table notification_subscriptions
  add column if not exists client_id  text;

alter table notification_subscriptions
  add column if not exists updated_at  timestamp with time zone default now();

-- user_id 原本可空(无 not null)，匿名订阅留空即可，无需修改。

comment on column notification_subscriptions.client_id
  is 'Anonymous owner id (browser-generated UUID stored in localStorage). Used when there is no authenticated user.';

-- 2. 索引：Cron 按 is_active 拉取；按 client_id 读取/删除
create index if not exists idx_notif_sub_active
  on notification_subscriptions(is_active)
  where is_active = true;

create index if not exists idx_notif_sub_client_id
  on notification_subscriptions(client_id);

-- 3. 约束：客户端每个渠道仅一条记录（便于服务端 upsert/replace）
create unique index if not exists uq_notif_sub_client_channel
  on notification_subscriptions(client_id, channel)
  where client_id is not null;

-- 注意：RLS 维持原 "notification_subscriptions_own_data" 策略不变，
-- 匿名(anon) 仍无法直接读写本表；所有读写均经服务端 service_role 完成。

-- 4. 验证
select column_name, data_type
from information_schema.columns
where table_name = 'notification_subscriptions'
order by ordinal_position;
