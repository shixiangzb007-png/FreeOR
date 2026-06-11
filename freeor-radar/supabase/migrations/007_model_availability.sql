-- ============================================================
-- FreeOR Radar — Migration 007
-- 目的: 免费模型可用性监控（PRD v3 后续候选 #3）
-- 设计: Cron 定期对免费模型发最小 chat/completions 探测，
--       记录延迟/429/失败率，更新 free_models 可用性指标。
-- 执行: Supabase Dashboard → SQL Editor → Run（幂等，可重复执行）
-- ============================================================

-- free_models 可用性快照列（由 /api/cron/probe 写入，同步 upsert 不覆盖）
alter table free_models
  add column if not exists availability_status text default 'unknown',
  add column if not exists last_probed_at timestamp with time zone,
  add column if not exists probe_success_rate float;

-- 探测历史（保留最近记录供趋势分析；Cron 仅 INSERT）
create table if not exists model_probes (
  id                serial primary key,
  model_id          text not null references free_models(id) on delete cascade,
  latency_ms        float,
  success           boolean not null default false,
  status_code       int,
  error_type        text,  -- rate_limit | timeout | error | null
  completion_tokens int,
  probed_at         timestamp with time zone default now()
);

create index if not exists idx_model_probes_model_time
  on model_probes(model_id, probed_at desc);

create index if not exists idx_free_models_probe_order
  on free_models(is_free, last_probed_at nulls first);

alter table model_probes enable row level security;
-- 无 policy = 默认拒绝；读写经 service_role API

-- 验证
select column_name, data_type
from information_schema.columns
where table_name = 'free_models'
  and column_name in ('availability_status', 'last_probed_at', 'probe_success_rate')
order by ordinal_position;
