-- ============================================================================
-- 降噪平台 V1.2.1 数据库迁移脚本
-- 功能: 内容访问限制与用户增长系统
-- 创建日期: 2025-11-03
-- ============================================================================

-- 1. 创建内容浏览记录表
CREATE TABLE IF NOT EXISTS public.content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id VARCHAR(255) NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_content UNIQUE(user_id, content_id)
);

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_content_views_user_id
  ON public.content_views(user_id);

CREATE INDEX IF NOT EXISTS idx_content_views_viewed_at
  ON public.content_views(viewed_at);

CREATE INDEX IF NOT EXISTS idx_content_views_content_id
  ON public.content_views(content_id);

-- 3. 启用行级安全策略 (RLS)
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;

-- 4. 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "Users can view own content views" ON public.content_views;
DROP POLICY IF EXISTS "Users can insert own content views" ON public.content_views;

-- 5. 创建 RLS 策略: 用户只能查看自己的浏览记录
CREATE POLICY "Users can view own content views"
  ON public.content_views
  FOR SELECT
  USING (auth.uid() = user_id);

-- 6. 创建 RLS 策略: 用户只能插入自己的浏览记录
CREATE POLICY "Users can insert own content views"
  ON public.content_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. 添加表注释
COMMENT ON TABLE public.content_views IS 'V1.2.1: 用户内容浏览记录表,用于追踪登录用户的阅读历史';
COMMENT ON COLUMN public.content_views.id IS '主键 UUID';
COMMENT ON COLUMN public.content_views.user_id IS '用户 ID (外键关联 auth.users)';
COMMENT ON COLUMN public.content_views.content_id IS '内容 ID (对应 Feishu 记录 ID)';
COMMENT ON COLUMN public.content_views.viewed_at IS '查看时间 (带时区的时间戳)';

-- ============================================================================
-- 使用说明:
-- 1. 登录 Supabase Dashboard (https://supabase.com/dashboard)
-- 2. 选择项目: tnzmfewajmptyxwcunpu
-- 3. 进入 SQL Editor
-- 4. 粘贴此脚本并执行
-- 5. 确认执行成功后,可在 Table Editor 中查看 content_views 表
-- ============================================================================

-- 验证查询 (可选):
-- SELECT * FROM public.content_views LIMIT 10;
-- SELECT COUNT(*) FROM public.content_views;
