-- ============================================================================
-- 会员管理实用 SQL 脚本
-- 说明: 提供常用的会员管理操作,复制到 Supabase SQL Editor 中执行
-- ============================================================================

-- ============================================================================
-- 1. 查询用户的 UUID (通过邮箱)
-- ============================================================================
-- 替换 'user@example.com' 为实际邮箱
SELECT
  id as user_id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'user@example.com';


-- ============================================================================
-- 2. 设置年会员 (1年有效期)
-- ============================================================================
-- 替换下面的 UUID 为实际的用户 UUID
INSERT INTO public.user_memberships (user_id, tier, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- 替换为用户 UUID
  'yearly',
  NOW() + INTERVAL '1 year'
)
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'yearly',
  expires_at = NOW() + INTERVAL '1 year',
  updated_at = NOW();


-- ============================================================================
-- 3. 设置月会员 (1个月有效期)
-- ============================================================================
INSERT INTO public.user_memberships (user_id, tier, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- 替换为用户 UUID
  'monthly',
  NOW() + INTERVAL '1 month'
)
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'monthly',
  expires_at = NOW() + INTERVAL '1 month',
  updated_at = NOW();


-- ============================================================================
-- 4. 设置终身会员 (永久有效)
-- ============================================================================
INSERT INTO public.user_memberships (user_id, tier, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- 替换为用户 UUID
  'lifetime',
  NULL  -- NULL 表示永久有效
)
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'lifetime',
  expires_at = NULL,
  updated_at = NOW();


-- ============================================================================
-- 5. 取消会员 (恢复为免费用户)
-- ============================================================================
INSERT INTO public.user_memberships (user_id, tier, expires_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- 替换为用户 UUID
  'free',
  NULL
)
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'free',
  expires_at = NULL,
  updated_at = NOW();


-- ============================================================================
-- 6. 延长会员时间 (在当前到期时间基础上延长1年)
-- ============================================================================
UPDATE public.user_memberships
SET
  expires_at = COALESCE(
    CASE
      WHEN expires_at > NOW() THEN expires_at + INTERVAL '1 year'
      ELSE NOW() + INTERVAL '1 year'
    END,
    NOW() + INTERVAL '1 year'
  ),
  updated_at = NOW()
WHERE user_id = '00000000-0000-0000-0000-000000000000';  -- 替换为用户 UUID


-- ============================================================================
-- 7. 查询某个用户的会员信息
-- ============================================================================
SELECT
  um.user_id,
  u.email,
  um.tier as 会员等级,
  um.expires_at as 到期时间,
  CASE
    WHEN um.tier = 'free' THEN '免费用户'
    WHEN um.tier = 'lifetime' THEN '终身会员 (永久有效)'
    WHEN um.expires_at IS NULL THEN '永久有效'
    WHEN um.expires_at > NOW() THEN '有效 (剩余' || EXTRACT(DAY FROM um.expires_at - NOW()) || '天)'
    ELSE '已过期'
  END as 状态,
  um.created_at as 创建时间,
  um.updated_at as 更新时间
FROM public.user_memberships um
LEFT JOIN auth.users u ON u.id = um.user_id
WHERE um.user_id = '00000000-0000-0000-0000-000000000000';  -- 替换为用户 UUID


-- ============================================================================
-- 8. 查询所有有效会员
-- ============================================================================
SELECT
  um.user_id,
  u.email,
  um.tier as 会员等级,
  um.expires_at as 到期时间,
  CASE
    WHEN um.tier = 'lifetime' THEN '终身会员'
    WHEN um.expires_at IS NULL THEN '永久有效'
    ELSE CONCAT('剩余', EXTRACT(DAY FROM um.expires_at - NOW()), '天')
  END as 状态
FROM public.user_memberships um
LEFT JOIN auth.users u ON u.id = um.user_id
WHERE um.tier != 'free'
  AND (um.expires_at IS NULL OR um.expires_at > NOW())
ORDER BY um.tier, um.expires_at DESC;


-- ============================================================================
-- 9. 查询即将过期的会员 (7天内)
-- ============================================================================
SELECT
  um.user_id,
  u.email,
  um.tier as 会员等级,
  um.expires_at as 到期时间,
  EXTRACT(DAY FROM um.expires_at - NOW()) as 剩余天数
FROM public.user_memberships um
LEFT JOIN auth.users u ON u.id = um.user_id
WHERE um.expires_at IS NOT NULL
  AND um.expires_at > NOW()
  AND um.expires_at < NOW() + INTERVAL '7 days'
ORDER BY um.expires_at;


-- ============================================================================
-- 10. 查询已过期的会员
-- ============================================================================
SELECT
  um.user_id,
  u.email,
  um.tier as 会员等级,
  um.expires_at as 到期时间,
  EXTRACT(DAY FROM NOW() - um.expires_at) as 已过期天数
FROM public.user_memberships um
LEFT JOIN auth.users u ON u.id = um.user_id
WHERE um.expires_at IS NOT NULL
  AND um.expires_at < NOW()
ORDER BY um.expires_at DESC;


-- ============================================================================
-- 11. 通过邮箱直接设置年会员 (组合操作)
-- ============================================================================
-- 替换 'user@example.com' 为实际邮箱
WITH user_info AS (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
)
INSERT INTO public.user_memberships (user_id, tier, expires_at)
SELECT
  id,
  'yearly',
  NOW() + INTERVAL '1 year'
FROM user_info
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'yearly',
  expires_at = NOW() + INTERVAL '1 year',
  updated_at = NOW();


-- ============================================================================
-- 12. 批量设置年会员 (通过邮箱列表)
-- ============================================================================
WITH user_list AS (
  SELECT id FROM auth.users
  WHERE email IN (
    'user1@example.com',
    'user2@example.com',
    'user3@example.com'
  )
)
INSERT INTO public.user_memberships (user_id, tier, expires_at)
SELECT
  id,
  'yearly',
  NOW() + INTERVAL '1 year'
FROM user_list
ON CONFLICT (user_id) DO UPDATE
SET
  tier = 'yearly',
  expires_at = NOW() + INTERVAL '1 year',
  updated_at = NOW();
