-- ============================================================================
-- 降噪平台 V1.3.0 数据库迁移脚本
-- 主题: 会员系统
-- 说明: 添加用户会员信息表,支持会员等级和到期时间
-- 创建日期: 2025-11-04
-- ============================================================================

-- 1. 创建会员类型枚举
DO $$ BEGIN
  CREATE TYPE public.membership_tier AS ENUM ('free', 'monthly', 'yearly', 'lifetime');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. 创建用户会员信息表
CREATE TABLE IF NOT EXISTS public.user_memberships (
  user_id UUID PRIMARY KEY,
  tier public.membership_tier NOT NULL DEFAULT 'free',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_memberships_tier
  ON public.user_memberships (tier);

CREATE INDEX IF NOT EXISTS idx_user_memberships_expires
  ON public.user_memberships (expires_at);

-- 4. 启用 RLS
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;

-- 5. 清理旧策略(如存在)
DROP POLICY IF EXISTS "Users can view own membership" ON public.user_memberships;
DROP POLICY IF EXISTS "Service role can manage memberships" ON public.user_memberships;

-- 6. RLS 策略 - 用户只能查看自己的会员信息
CREATE POLICY "Users can view own membership"
  ON public.user_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 7. RLS 策略 - 服务角色可以管理所有会员信息
CREATE POLICY "Service role can manage memberships"
  ON public.user_memberships
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 8. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 为会员表添加更新时间触发器
DROP TRIGGER IF EXISTS update_user_memberships_updated_at ON public.user_memberships;
CREATE TRIGGER update_user_memberships_updated_at
  BEFORE UPDATE ON public.user_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. 注释
COMMENT ON TABLE public.user_memberships IS 'V1.3.0: 用户会员信息表';
COMMENT ON COLUMN public.user_memberships.user_id IS '用户 ID (对应 auth.users)';
COMMENT ON COLUMN public.user_memberships.tier IS '会员等级: free(免费), monthly(月会员), yearly(年会员), lifetime(终身会员)';
COMMENT ON COLUMN public.user_memberships.expires_at IS '会员到期时间 (NULL 表示永久有效或免费用户)';
COMMENT ON COLUMN public.user_memberships.created_at IS '创建时间';
COMMENT ON COLUMN public.user_memberships.updated_at IS '更新时间';

-- ============================================================================
-- 使用说明
-- ============================================================================

-- 设置年会员示例 (从现在开始1年):
-- INSERT INTO public.user_memberships (user_id, tier, expires_at)
-- VALUES (
--   '用户的UUID',
--   'yearly',
--   NOW() + INTERVAL '1 year'
-- )
-- ON CONFLICT (user_id) DO UPDATE
-- SET tier = 'yearly',
--     expires_at = NOW() + INTERVAL '1 year';

-- 设置月会员示例:
-- INSERT INTO public.user_memberships (user_id, tier, expires_at)
-- VALUES (
--   '用户的UUID',
--   'monthly',
--   NOW() + INTERVAL '1 month'
-- )
-- ON CONFLICT (user_id) DO UPDATE
-- SET tier = 'monthly',
--     expires_at = NOW() + INTERVAL '1 month';

-- 设置终身会员示例:
-- INSERT INTO public.user_memberships (user_id, tier, expires_at)
-- VALUES (
--   '用户的UUID',
--   'lifetime',
--   NULL
-- )
-- ON CONFLICT (user_id) DO UPDATE
-- SET tier = 'lifetime',
--     expires_at = NULL;

-- 查询某个用户的会员信息:
-- SELECT * FROM public.user_memberships WHERE user_id = '用户的UUID';

-- 查询所有有效会员 (未过期):
-- SELECT * FROM public.user_memberships
-- WHERE tier != 'free'
--   AND (expires_at IS NULL OR expires_at > NOW());

-- ============================================================================
-- 执行完成提示
-- ============================================================================
SELECT 'Migration v1.3.0 (Membership System) completed successfully!' as status;
