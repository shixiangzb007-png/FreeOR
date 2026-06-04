-- ============================================================
-- FreeOR Radar — Migration 005
-- 目的: 用 pg_cron 每 5 分钟触发 Edge Function sync-cron，实现 PRD "推送延迟 < 5 分钟"
-- 依赖: supabase/functions/sync-cron 已部署（supabase functions deploy sync-cron）
-- 说明:
--   - pg_cron 负责定时；pg_net 负责发起异步 HTTP 调用 Edge Function。
--   - Edge Function 会回调 Next.js /api/cron 完成实际同步与推送。
--   - 机密(项目地址、service_role key)从 Supabase Vault 读取，避免硬编码。
-- 执行: Supabase Dashboard → SQL Editor → 按下方步骤逐段运行。
-- ============================================================

-- ── 1. 启用扩展（Supabase 项目通常已可用）─────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 2. 在 Vault 中登记机密（只需执行一次；请替换为你的真实值）──
-- 项目 Functions 基础地址，例如 https://abcdefgh.supabase.co/functions/v1
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_base_url');
-- 用于调用 Edge Function 的鉴权 token（service_role key 或 anon key）
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'edge_auth_token');
--
-- 如需更新已存在的密钥：
--   select vault.update_secret((select id from vault.secrets where name='functions_base_url'), '<new value>');

-- ── 3. 调度任务：每 5 分钟触发 sync-cron ──────────────────────
-- 先移除同名旧任务（幂等）
select cron.unschedule('freeor-sync-every-5min')
where exists (select 1 from cron.job where jobname = 'freeor-sync-every-5min');

select cron.schedule(
  'freeor-sync-every-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_auth_token')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- ── 4. 验证 ───────────────────────────────────────────────────
-- 查看已调度任务
select jobid, jobname, schedule, active from cron.job where jobname = 'freeor-sync-every-5min';
-- 查看最近执行记录（运行几分钟后再查）
-- select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='freeor-sync-every-5min') order by start_time desc limit 5;

-- 备注:
--   - 保留 vercel.json 中的每小时 Cron 作为兜底，不冲突（同步逻辑幂等：无变更则不推送）。
--   - 若想停止 5 分钟调度: select cron.unschedule('freeor-sync-every-5min');
