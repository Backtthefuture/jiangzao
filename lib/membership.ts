/**
 * 会员管理工具库
 *
 * 功能:
 * - 会员套餐配置
 * - 会员状态查询
 * - 会员激活/续费
 * - 会员权益检查
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 会员套餐配置
// ============================================================================

/**
 * 会员等级类型
 */
export type MembershipTier = 'free' | 'monthly' | 'yearly' | 'lifetime';

/**
 * 会员套餐定义
 */
export interface MembershipPlan {
  type: MembershipTier;
  name: string;
  price: number;
  durationDays: number | null; // null 表示终身
  description: string;
  features: string[];
  recommended?: boolean;
  badge?: string; // 徽章文本
}

/**
 * 会员套餐配置表
 */
export const MEMBERSHIP_PLANS: Record<Exclude<MembershipTier, 'free'>, MembershipPlan> = {
  monthly: {
    type: 'monthly',
    name: '月会员',
    price: 9.9,
    durationDays: 30,
    description: '连续30天无限阅读',
    features: ['无限阅读', '阅读统计', '会员标识'],
    badge: '月',
  },
  yearly: {
    type: 'yearly',
    name: '年会员',
    price: 99,
    durationDays: 365,
    description: '一年无限阅读，相当于每月¥8.25',
    features: ['无限阅读', '阅读统计', '会员标识', '最优惠价'],
    recommended: true,
    badge: '年',
  },
  lifetime: {
    type: 'lifetime',
    name: '终身会员',
    price: 599,
    durationDays: null,
    description: '永久无限阅读，未来新功能优先体验',
    features: ['无限阅读', '阅读统计', '会员标识', '未来新功能', '一次付费永久使用'],
    badge: '终身',
  },
};

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 用户会员信息
 */
export interface UserMembership {
  userId: string;
  tier: MembershipTier;
  expiresAt: string | null; // ISO 8601 日期字符串, null 表示永久
  createdAt: string;
  updatedAt: string;
}

/**
 * 会员状态
 */
export interface MembershipStatus {
  tier: MembershipTier;
  isActive: boolean; // 是否有效
  expiresAt: string | null;
  daysRemaining: number | null; // null 表示永久
  planName: string;
  badge: string;
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 获取用户会员信息
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 会员信息
 */
export async function getUserMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMembership | null> {
  try {
    const { data, error } = await supabase
      .from('user_memberships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[MEMBERSHIP] 查询会员信息失败', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      userId: data.user_id,
      tier: data.tier,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('[MEMBERSHIP] 获取会员信息异常', error);
    return null;
  }
}

/**
 * 获取会员状态
 *
 * 包含是否有效、剩余天数等信息
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 会员状态
 */
export async function getMembershipStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<MembershipStatus> {
  const membership = await getUserMembership(supabase, userId);

  // 默认免费用户
  if (!membership || membership.tier === 'free') {
    return {
      tier: 'free',
      isActive: false,
      expiresAt: null,
      daysRemaining: null,
      planName: '免费用户',
      badge: '',
    };
  }

  // 终身会员
  if (membership.tier === 'lifetime') {
    return {
      tier: 'lifetime',
      isActive: true,
      expiresAt: null,
      daysRemaining: null,
      planName: MEMBERSHIP_PLANS.lifetime.name,
      badge: MEMBERSHIP_PLANS.lifetime.badge || '',
    };
  }

  // 有期限会员
  const plan = MEMBERSHIP_PLANS[membership.tier];
  const expiresAt = membership.expiresAt;

  if (!expiresAt) {
    // 数据异常: 非终身会员但 expires_at 为 null
    console.error('[MEMBERSHIP] 数据异常: 非终身会员但 expires_at 为 null', membership);
    return {
      tier: membership.tier,
      isActive: false,
      expiresAt: null,
      daysRemaining: null,
      planName: plan.name,
      badge: plan.badge || '',
    };
  }

  const now = new Date();
  const expiresDate = new Date(expiresAt);
  const isActive = expiresDate > now;
  const daysRemaining = isActive ? Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return {
    tier: membership.tier,
    isActive,
    expiresAt,
    daysRemaining,
    planName: plan.name,
    badge: plan.badge || '',
  };
}

/**
 * 激活或续费会员
 *
 * 业务规则:
 * - 如果用户无会员记录: 创建新会员
 * - 如果会员已过期: 从当前时间开始计算
 * - 如果会员未过期: 在现有到期时间基础上延长
 * - 终身会员: expires_at 设为 null
 *
 * @param supabase - Supabase 客户端 (需要 service_role 权限)
 * @param userId - 用户 ID
 * @param tier - 会员等级
 * @returns 是否成功
 */
export async function activateOrRenewMembership(
  supabase: SupabaseClient,
  userId: string,
  tier: Exclude<MembershipTier, 'free'>
): Promise<boolean> {
  try {
    const plan = MEMBERSHIP_PLANS[tier];
    const now = new Date();

    // 查询现有会员信息
    const existingMembership = await getUserMembership(supabase, userId);

    let expiresAt: string | null = null;

    // 终身会员
    if (plan.durationDays === null) {
      expiresAt = null;
    } else {
      // 有期限会员
      if (existingMembership && existingMembership.expiresAt && existingMembership.tier !== 'free') {
        // 已有会员且未过期: 延长时间
        const currentExpires = new Date(existingMembership.expiresAt);
        if (currentExpires > now) {
          const newExpires = new Date(currentExpires);
          newExpires.setDate(newExpires.getDate() + plan.durationDays);
          expiresAt = newExpires.toISOString();
        } else {
          // 已过期: 从当前时间开始
          const newExpires = new Date(now);
          newExpires.setDate(newExpires.getDate() + plan.durationDays);
          expiresAt = newExpires.toISOString();
        }
      } else {
        // 新会员或免费用户: 从当前时间开始
        const newExpires = new Date(now);
        newExpires.setDate(newExpires.getDate() + plan.durationDays);
        expiresAt = newExpires.toISOString();
      }
    }

    // Upsert 会员记录
    const { error } = await supabase.from('user_memberships').upsert(
      {
        user_id: userId,
        tier,
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      console.error('[MEMBERSHIP] 激活会员失败', error);
      return false;
    }

    console.log('[MEMBERSHIP] 激活会员成功', {
      userId,
      tier,
      expiresAt,
    });

    return true;
  } catch (error) {
    console.error('[MEMBERSHIP] 激活会员异常', error);
    return false;
  }
}

/**
 * 检查用户是否有有效会员
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 是否有有效会员
 */
export async function hasActiveMembership(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const status = await getMembershipStatus(supabase, userId);
  return status.isActive;
}

/**
 * 获取会员最大阅读次数
 *
 * @param tier - 会员等级
 * @param defaultFree - 免费用户默认次数
 * @param defaultAuth - 登录用户默认次数
 * @returns 最大阅读次数, -1 表示无限
 */
export function getMembershipMaxViews(tier: MembershipTier, defaultFree: number = 3, defaultAuth: number = 10): number {
  if (tier === 'free') {
    return defaultAuth; // 免费但已登录
  }

  // 所有付费会员: 无限阅读
  return -1;
}

/**
 * 取消会员 (恢复为免费用户)
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @returns 是否成功
 */
export async function cancelMembership(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_memberships')
      .update({
        tier: 'free',
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[MEMBERSHIP] 取消会员失败', error);
      return false;
    }

    console.log('[MEMBERSHIP] 取消会员成功', userId);
    return true;
  } catch (error) {
    console.error('[MEMBERSHIP] 取消会员异常', error);
    return false;
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取套餐配置
 *
 * @param tier - 会员等级
 * @returns 套餐配置
 */
export function getPlanConfig(tier: Exclude<MembershipTier, 'free'>): MembershipPlan | null {
  return MEMBERSHIP_PLANS[tier] || null;
}

/**
 * 验证会员等级
 *
 * @param tier - 会员等级字符串
 * @returns 是否合法
 */
export function isValidMembershipTier(tier: string): tier is MembershipTier {
  return ['free', 'monthly', 'yearly', 'lifetime'].includes(tier);
}

/**
 * 验证可购买的会员等级
 *
 * @param tier - 会员等级字符串
 * @returns 是否可购买
 */
export function isPurchasableTier(tier: string): tier is Exclude<MembershipTier, 'free'> {
  return ['monthly', 'yearly', 'lifetime'].includes(tier);
}

/**
 * 计算会员到期日期
 *
 * @param tier - 会员等级
 * @param baseDate - 基准日期 (默认当前时间)
 * @returns 到期日期 (ISO 字符串), null 表示永久
 */
export function calculateExpiresAt(tier: Exclude<MembershipTier, 'free'>, baseDate?: Date): string | null {
  const plan = MEMBERSHIP_PLANS[tier];

  if (plan.durationDays === null) {
    return null; // 终身会员
  }

  const date = baseDate || new Date();
  const expiresDate = new Date(date);
  expiresDate.setDate(expiresDate.getDate() + plan.durationDays);

  return expiresDate.toISOString();
}

/**
 * 格式化会员到期时间
 *
 * @param expiresAt - 到期时间 (ISO 字符串)
 * @param tier - 会员等级
 * @returns 格式化字符串
 */
export function formatExpiresAt(expiresAt: string | null, tier: MembershipTier): string {
  if (tier === 'lifetime' || !expiresAt) {
    return '永久有效';
  }

  const date = new Date(expiresAt);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 计算剩余天数
 *
 * @param expiresAt - 到期时间 (ISO 字符串)
 * @returns 剩余天数, null 表示永久, 0 表示已过期
 */
export function calculateDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) {
    return null; // 永久
  }

  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 0; // 已过期
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 获取会员徽章样式
 *
 * @param tier - 会员等级
 * @returns Tailwind CSS 类名
 */
export function getMembershipBadgeStyle(tier: MembershipTier): string {
  switch (tier) {
    case 'monthly':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'yearly':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'lifetime':
      return 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * 获取所有可购买套餐列表
 *
 * @returns 套餐列表
 */
export function getAllPlans(): MembershipPlan[] {
  return Object.values(MEMBERSHIP_PLANS);
}

/**
 * 比较两个会员等级
 *
 * @param tier1 - 会员等级1
 * @param tier2 - 会员等级2
 * @returns tier1 > tier2 返回正数, tier1 < tier2 返回负数, 相等返回 0
 */
export function compareMembershipTiers(tier1: MembershipTier, tier2: MembershipTier): number {
  const tierOrder: Record<MembershipTier, number> = {
    free: 0,
    monthly: 1,
    yearly: 2,
    lifetime: 3,
  };

  return tierOrder[tier1] - tierOrder[tier2];
}

// ============================================================================
// 导出默认对象 (可选)
// ============================================================================

export default {
  MEMBERSHIP_PLANS,
  getUserMembership,
  getMembershipStatus,
  activateOrRenewMembership,
  hasActiveMembership,
  getMembershipMaxViews,
  cancelMembership,
  getPlanConfig,
  isValidMembershipTier,
  isPurchasableTier,
  calculateExpiresAt,
  formatExpiresAt,
  calculateDaysRemaining,
  getMembershipBadgeStyle,
  getAllPlans,
  compareMembershipTiers,
};
