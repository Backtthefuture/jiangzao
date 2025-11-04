-- ============================================================================
-- V1.4.0 - AI智能砍价系统数据库迁移
-- 创建日期: 2025-11-04
-- 功能:
--   1. 创建 bargain_attempts 表 (砍价记录)
--   2. 修改 orders 表 (添加优惠券字段)
--   3. 配置 RLS 策略和索引
-- ============================================================================

-- ============================================================================
-- 1. 创建 bargain_attempts 表
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bargain_attempts (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户信息
  user_id UUID NOT NULL,
  user_email TEXT,

  -- 砍价内容
  reason TEXT NOT NULL,
  reason_length INTEGER,

  -- AI评估结果
  ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100),
  ai_message TEXT,
  discount_percent DECIMAL(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 99),
  original_price DECIMAL(10,2) DEFAULT 9.90,
  final_price DECIMAL(10,2) CHECK (final_price >= 0.01 AND final_price <= 9.90),

  -- 优惠券信息
  coupon_code TEXT UNIQUE NOT NULL,
  coupon_expires_at TIMESTAMPTZ NOT NULL,
  coupon_used BOOLEAN DEFAULT FALSE,
  coupon_used_at TIMESTAMPTZ,

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_ip TEXT,
  user_agent TEXT,

  -- 唯一约束：每用户终身仅一次砍价机会
  CONSTRAINT one_attempt_per_user UNIQUE(user_id)
);

-- ============================================================================
-- 2. 创建索引
-- ============================================================================

-- 用户ID索引 (用于快速查询用户的砍价记录)
CREATE INDEX IF NOT EXISTS idx_bargain_user ON public.bargain_attempts(user_id);

-- 优惠券过期时间索引 (用于清理过期优惠券)
CREATE INDEX IF NOT EXISTS idx_bargain_coupon_exp ON public.bargain_attempts(coupon_expires_at);

-- 优惠券码索引 (用于快速验证优惠券)
CREATE INDEX IF NOT EXISTS idx_bargain_coupon_code ON public.bargain_attempts(coupon_code);

-- 创建时间索引 (用于统计分析)
CREATE INDEX IF NOT EXISTS idx_bargain_created_at ON public.bargain_attempts(created_at);

-- ============================================================================
-- 3. 启用行级安全 (RLS)
-- ============================================================================

ALTER TABLE public.bargain_attempts ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "bargain_select_own" ON public.bargain_attempts;
DROP POLICY IF EXISTS "bargain_insert_own" ON public.bargain_attempts;
DROP POLICY IF EXISTS "bargain_update_own" ON public.bargain_attempts;
DROP POLICY IF EXISTS "bargain_service_all" ON public.bargain_attempts;

-- 用户只能查看自己的砍价记录
CREATE POLICY "bargain_select_own" ON public.bargain_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- 用户只能插入自己的砍价记录
CREATE POLICY "bargain_insert_own" ON public.bargain_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的砍价记录
CREATE POLICY "bargain_update_own" ON public.bargain_attempts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 服务角色拥有全部权限（用于服务端操作）
CREATE POLICY "bargain_service_all" ON public.bargain_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. 修改 orders 表（添加优惠券相关字段）
-- ============================================================================

-- 添加优惠券码字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'coupon_code'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN coupon_code TEXT;
  END IF;
END $$;

-- 添加折扣金额字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN discount_amount DECIMAL(10,2);
  END IF;
END $$;

-- 添加原始金额字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'original_amount'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN original_amount DECIMAL(10,2);
  END IF;
END $$;

-- ============================================================================
-- 5. 为 orders 表创建唯一索引（防止同一优惠券被多次使用）
-- ============================================================================

-- 优惠券码唯一索引（允许 NULL，但非 NULL 值必须唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_coupon_code_unique
  ON public.orders(coupon_code)
  WHERE coupon_code IS NOT NULL;

-- ============================================================================
-- 6. 添加注释
-- ============================================================================

COMMENT ON TABLE public.bargain_attempts IS 'V1.4.0 AI砍价系统：用户砍价记录表';
COMMENT ON COLUMN public.bargain_attempts.user_id IS '用户ID（每用户终身仅一次砍价机会）';
COMMENT ON COLUMN public.bargain_attempts.reason IS '砍价理由（30-300字）';
COMMENT ON COLUMN public.bargain_attempts.ai_score IS 'AI评分（0-100）';
COMMENT ON COLUMN public.bargain_attempts.discount_percent IS '折扣百分比（0-99%）';
COMMENT ON COLUMN public.bargain_attempts.final_price IS '最终价格（¥0.01-9.90）';
COMMENT ON COLUMN public.bargain_attempts.coupon_code IS '优惠券码（格式：BARGAIN_timestamp_random）';
COMMENT ON COLUMN public.bargain_attempts.coupon_expires_at IS '优惠券过期时间（24小时有效期）';
COMMENT ON COLUMN public.bargain_attempts.coupon_used IS '优惠券是否已使用';

COMMENT ON COLUMN public.orders.coupon_code IS 'V1.4.0 优惠券码（关联 bargain_attempts.coupon_code）';
COMMENT ON COLUMN public.orders.discount_amount IS 'V1.4.0 折扣金额';
COMMENT ON COLUMN public.orders.original_amount IS 'V1.4.0 原始金额（优惠前）';

-- ============================================================================
-- 迁移完成
-- ============================================================================

-- 打印迁移结果（仅在 psql 中有效，Supabase SQL Editor 中会被忽略）
DO $$
BEGIN
  RAISE NOTICE 'V1.4.0 数据库迁移完成';
  RAISE NOTICE '✓ bargain_attempts 表已创建';
  RAISE NOTICE '✓ 索引已创建';
  RAISE NOTICE '✓ RLS 策略已配置';
  RAISE NOTICE '✓ orders 表已修改（添加优惠券字段）';
  RAISE NOTICE '✓ 优惠券唯一索引已创建';
END $$;
