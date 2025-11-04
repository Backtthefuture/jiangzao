-- ============================================================================
-- 降噪平台 V1.3.1 数据库迁移脚本
-- 主题: 支付订单系统
-- 说明: 创建订单表,支持 Z-Pay 支付集成
-- 创建日期: 2025-11-04
-- ============================================================================

-- 1. 创建订单状态枚举类型
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'completed', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. 创建订单表
CREATE TABLE IF NOT EXISTS public.orders (
  -- 主键
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 订单信息
  order_id TEXT NOT NULL UNIQUE,                -- 商户订单号 (out_trade_no)
  trade_no TEXT,                                 -- Z-Pay 交易号

  -- 用户信息（必须登录下单）
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,                               -- 用户邮箱 (冗余字段,便于查询)

  -- 商品信息
  product_type TEXT NOT NULL,                    -- 商品类型: monthly/yearly/lifetime
  product_name TEXT NOT NULL,                    -- 商品名称: 月会员/年会员/终身会员
  amount NUMERIC(10, 2) NOT NULL,                -- 订单金额 (单位: 元)

  -- 支付信息
  payment_method TEXT NOT NULL,                  -- 支付方式: alipay/wxpay
  status public.order_status NOT NULL DEFAULT 'pending',

  -- 会员时长信息
  membership_duration_days INTEGER,              -- 会员时长天数 (NULL 表示终身)
  membership_start_date TIMESTAMP WITH TIME ZONE,-- 会员起始日期
  membership_end_date TIMESTAMP WITH TIME ZONE,  -- 会员结束日期 (NULL 表示终身)

  -- 回调信息
  callback_received_at TIMESTAMP WITH TIME ZONE, -- 回调接收时间
  callback_data JSONB,                           -- 回调原始数据 (用于对账)

  -- 备注
  note TEXT,                                     -- 订单备注
  client_ip TEXT,                                -- 客户端IP

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. 创建索引
-- 订单号索引 (用于快速查询和防重)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_id
  ON public.orders (order_id);

-- 用户订单索引 (用于查询用户的订单历史)
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

-- 状态索引 (用于筛选待处理订单)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

-- 时间索引 (用于统计和对账)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

-- Z-Pay 交易号索引 (用于回调查询)
CREATE INDEX IF NOT EXISTS idx_orders_trade_no
  ON public.orders (trade_no)
  WHERE trade_no IS NOT NULL;

-- 避免重复绑定同一交易号（允许 NULL，多回调幂等）
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_trade_no_unique
  ON public.orders (trade_no)
  WHERE trade_no IS NOT NULL;

-- 4. 启用行级安全 (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. 清理旧策略
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;

-- 6. RLS 策略 - 用户只能查看自己的订单
CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- 7. RLS 策略 - 服务角色可以管理所有订单 (用于 API 路由)
CREATE POLICY "Service role can manage orders"
  ON public.orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 8. RLS 策略 - 用户可以创建自己的订单（可选，如果 API 不使用 service role）
CREATE POLICY "Users can create own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 9. 创建触发器函数 - 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. 为订单表添加更新时间触发器
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orders_updated_at();

-- 11. 注释
COMMENT ON TABLE public.orders IS 'V1.3.1: 支付订单表';
COMMENT ON COLUMN public.orders.order_id IS '商户订单号 (对应 Z-Pay out_trade_no)';
COMMENT ON COLUMN public.orders.trade_no IS 'Z-Pay 交易号';
COMMENT ON COLUMN public.orders.user_id IS '用户 ID (必须登录下单)';
COMMENT ON COLUMN public.orders.status IS '订单状态: pending(待支付), paid(已支付), completed(已完成), failed(失败), refunded(已退款)';
COMMENT ON COLUMN public.orders.product_type IS '商品类型: monthly(月会员), yearly(年会员), lifetime(终身会员)';
COMMENT ON COLUMN public.orders.amount IS '订单金额 (单位: 元, NUMERIC 避免浮点误差)';
COMMENT ON COLUMN public.orders.callback_data IS '回调原始数据 (JSONB 格式,用于对账和问题排查)';
COMMENT ON COLUMN public.orders.membership_duration_days IS '会员时长 (天数, NULL 表示终身会员)';

-- 12. 验证表结构
DO $$
BEGIN
  -- 检查表是否创建成功
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'orders'
  ) THEN
    RAISE NOTICE '✓ Table public.orders created successfully';
  ELSE
    RAISE EXCEPTION '✗ Failed to create table public.orders';
  END IF;

  -- 检查枚举类型是否创建成功
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'order_status'
  ) THEN
    RAISE NOTICE '✓ Type public.order_status created successfully';
  ELSE
    RAISE EXCEPTION '✗ Failed to create type public.order_status';
  END IF;
END $$;

-- ============================================================================
-- 执行完成提示
-- ============================================================================
SELECT 'Migration V1.3.1 (Orders Table) completed successfully!' as status;

-- ============================================================================
-- 使用示例
-- ============================================================================

-- 创建订单示例:
-- INSERT INTO public.orders (
--   order_id,
--   user_id,
--   user_email,
--   product_type,
--   product_name,
--   amount,
--   payment_method,
--   membership_duration_days
-- ) VALUES (
--   'JZ_20251104_1234567890_A1B2C3',
--   '用户的UUID',
--   'user@example.com',
--   'yearly',
--   '年会员',
--   198.00,
--   'alipay',
--   365
-- );

-- 查询用户订单:
-- SELECT * FROM public.orders
-- WHERE user_id = '用户的UUID'
-- ORDER BY created_at DESC;

-- 查询待支付订单:
-- SELECT * FROM public.orders
-- WHERE status = 'pending'
-- AND created_at > NOW() - INTERVAL '24 hours';

-- 更新订单状态:
-- UPDATE public.orders
-- SET status = 'paid',
--     trade_no = 'Z-Pay交易号',
--     callback_received_at = NOW(),
--     callback_data = '{"key": "value"}'::JSONB
-- WHERE order_id = 'JZ_20251104_1234567890_A1B2C3'
-- AND status = 'pending';
