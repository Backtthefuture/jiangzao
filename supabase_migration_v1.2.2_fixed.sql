-- ============================================================================
-- 降噪平台 V1.2.2 数据库迁移脚本 (修复版)
-- 主题: 内容访问限制落地 & 阅读历史
-- 说明: 引入月度阅读额度表(登录/匿名)及旧数据迁移
-- 创建日期: 2025-11-05
-- 修复日期: 2025-11-04
-- ============================================================================

-- 1. 创建登录用户月度阅读表
CREATE TABLE IF NOT EXISTS public.content_monthly_views (
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  month_start DATE NOT NULL,
  first_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, content_id, month_start)
);

-- 2. 创建匿名用户月度阅读表
CREATE TABLE IF NOT EXISTS public.anon_monthly_views (
  anon_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  month_start DATE NOT NULL,
  first_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (anon_id, content_id, month_start)
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_content_month_user
  ON public.content_monthly_views (user_id, month_start);

CREATE INDEX IF NOT EXISTS idx_content_month_content
  ON public.content_monthly_views (content_id, month_start);

CREATE INDEX IF NOT EXISTS idx_anon_month_anon
  ON public.anon_monthly_views (anon_id, month_start);

CREATE INDEX IF NOT EXISTS idx_anon_month_content
  ON public.anon_monthly_views (content_id, month_start);

-- 4. 启用 RLS
ALTER TABLE public.content_monthly_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_monthly_views ENABLE ROW LEVEL SECURITY;

-- 5. 清理旧策略(如存在)
DROP POLICY IF EXISTS "Users select own monthly views" ON public.content_monthly_views;
DROP POLICY IF EXISTS "Users insert own monthly views" ON public.content_monthly_views;
DROP POLICY IF EXISTS "Users update own monthly views" ON public.content_monthly_views;

DROP POLICY IF EXISTS "System access anon monthly views" ON public.anon_monthly_views;

-- 6. RLS 策略 - 登录用户
CREATE POLICY "Users select own monthly views"
  ON public.content_monthly_views
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own monthly views"
  ON public.content_monthly_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own monthly views"
  ON public.content_monthly_views
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. RLS 策略 - 匿名用户
-- 说明: 使用服务端签名的 anon_id, 允许匿名请求按 anon_id 维度读写
CREATE POLICY "System access anon monthly views"
  ON public.anon_monthly_views
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 8. 从旧表迁移数据 (如果 content_views 表存在)
-- 注意: 如果 content_views 表不存在,这条语句会被跳过
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_views') THEN
    INSERT INTO public.content_monthly_views (user_id, content_id, month_start, first_viewed_at, last_viewed_at)
    SELECT
      cv.user_id,
      cv.content_id,
      (date_trunc('month', (cv.viewed_at AT TIME ZONE 'Asia/Shanghai')))::date AS month_start,
      cv.viewed_at,
      cv.viewed_at
    FROM public.content_views AS cv
    ON CONFLICT (user_id, content_id, month_start) DO UPDATE
    SET last_viewed_at = EXCLUDED.last_viewed_at
    WHERE public.content_monthly_views.last_viewed_at < EXCLUDED.last_viewed_at;

    RAISE NOTICE 'Data migrated from content_views';
  ELSE
    RAISE NOTICE 'Table content_views does not exist, skipping migration';
  END IF;
END $$;

-- 9. 注释
COMMENT ON TABLE public.content_monthly_views IS 'V1.2.2: 登录用户月度阅读记录 (用于访问额度)';
COMMENT ON COLUMN public.content_monthly_views.month_start IS '业务月起始日期 (Asia/Shanghai 时区)';
COMMENT ON TABLE public.anon_monthly_views IS 'V1.2.2: 匿名用户月度阅读记录 (anon_id)';

-- ============================================================================
-- 执行完成提示
-- ============================================================================
SELECT 'Migration v1.2.2 completed successfully!' as status;
