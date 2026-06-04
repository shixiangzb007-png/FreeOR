-- ============================================================
-- FreeOR Radar — Migration 004
-- 目的: 补齐视频平台额度初始数据，避免 CreditBanner 对 Higgsfield/OpenArt 显示占位 0
-- 背景: 001 初始脚本只 seed 了 kling/genmo/pika/runway(0)/veo(0)，
--       缺少 higgsfield/openart，且 runway/veo 的 daily_credits 为 0。
--       本迁移按 lib/video-credits/platform-config.ts 的口径补齐/修正。
-- 执行: Supabase Dashboard → SQL Editor → Run（幂等，可重复执行）
-- ============================================================

insert into video_credits (tool, daily_credits, used_today) values
  ('kling',      66,     0),
  ('genmo',      999999, 0),   -- 无限制，用大数表示
  ('pika',       80,     0),
  ('runway',     125,    0),    -- 新用户赠送 125 credits
  ('veo',        10,     0),
  ('higgsfield', 10,     0),
  ('openart',    50,     0)
on conflict (tool) do update
  set daily_credits = excluded.daily_credits,
      updated_at    = now();
-- 注意：do update 仅修正 daily_credits，不重置 used_today（保留运行时用量）。

-- 验证
select tool, daily_credits, used_today, updated_at
from video_credits
order by tool;
