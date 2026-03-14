-- ============================================================
-- FreeOR Radar — Migration 002
-- 为 free_models 表新增限流相关字段
-- 执行方式: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 新增原始限流数据列（存储 OpenRouter per_request_limits 原始 JSON）
ALTER TABLE free_models
  ADD COLUMN IF NOT EXISTS per_request_limits jsonb DEFAULT NULL;

-- 新增派生限流级别列（供前端快速显示，无需解析 JSON）
-- 枚举值: 'high' | 'standard' | 'low' | 'unknown'
ALTER TABLE free_models
  ADD COLUMN IF NOT EXISTS rate_limit_level text DEFAULT 'unknown';

-- 注释说明
COMMENT ON COLUMN free_models.per_request_limits
  IS 'Raw per_request_limits JSON from OpenRouter API, e.g. {"prompt_tokens":"20000","completion_tokens":"20000"}';

COMMENT ON COLUMN free_models.rate_limit_level
  IS 'Derived rate limit category: high(>=200K prompt tokens) / standard(50K-200K) / low(<50K) / unknown(no data)';

-- 为新列添加索引（便于按限流级别查询）
CREATE INDEX IF NOT EXISTS idx_free_models_rate_level
  ON free_models(rate_limit_level)
  WHERE is_free = true;

-- 验证
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'free_models'
  AND column_name IN ('per_request_limits', 'rate_limit_level')
ORDER BY column_name;
