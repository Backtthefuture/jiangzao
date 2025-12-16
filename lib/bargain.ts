/**
 * 砍价业务逻辑
 *
 * V1.4.0 - AI智能砍价系统
 *
 * 功能:
 * - 检查砍价资格
 * - 生成优惠券码
 * - 验证优惠券有效性
 * - 计算折扣价格
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// 类型定义
// ============================================================================

export interface BargainAttempt {
  id: string;
  user_id: string;
  user_email: string | null;
  reason: string;
  reason_length: number;
  ai_score: number;
  ai_message: string;
  discount_percent: number;
  original_price: number;
  final_price: number;
  coupon_code: string;
  coupon_expires_at: string;
  coupon_used: boolean;
  coupon_used_at: string | null;
  created_at: string;
  client_ip: string | null;
  user_agent: string | null;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  attempt?: BargainAttempt;
}

// ============================================================================
// 配置
// ============================================================================

const BARGAIN_ENABLED = process.env.BARGAIN_ENABLED === 'true';
const COUPON_EXPIRES_HOURS = parseInt(
  process.env.BARGAIN_COUPON_EXPIRES_HOURS || '24',
  10
);
const MIN_REASON_LENGTH = parseInt(
  process.env.BARGAIN_MIN_REASON_LENGTH || '30',
  10
);
const MAX_REASON_LENGTH = parseInt(
  process.env.BARGAIN_MAX_REASON_LENGTH || '300',
  10
);

// 测试邮箱列表(可无限次砍价)
const TEST_EMAILS = (process.env.BARGAIN_TEST_EMAILS || '')
  .split(',')
  .map(email => email.trim())
  .filter(email => email.length > 0);

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 检查用户是否可以砍价
 *
 * @param supabase - Supabase 客户端
 * @param userId - 用户 ID
 * @param userEmail - 用户邮箱(可选,用于测试账号判断)
 * @returns 是否可以砍价 + 已有记录（如果存在）
 */
export async function canUserBargain(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
): Promise<{ canBargain: boolean; existingAttempt?: BargainAttempt }> {
  try {
    // 检查功能是否启用
    if (!BARGAIN_ENABLED) {
      console.log('[BARGAIN] Bargain feature is disabled');
      return { canBargain: false };
    }

    // 检查是否是测试邮箱(测试邮箱可以无限次砍价)
    if (userEmail && TEST_EMAILS.includes(userEmail)) {
      console.log('[BARGAIN] Test email detected, allowing unlimited bargain:', userEmail);
      return { canBargain: true };
    }

    // 查询用户的砍价记录
    const { data, error } = await supabase
      .from('bargain_attempts')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('[BARGAIN] Query error:', error);
      throw new Error('Failed to check bargain eligibility');
    }

    if (data) {
      // 用户已经砍价过
      console.log('[BARGAIN] User already bargained:', userId);
      return {
        canBargain: false,
        existingAttempt: data as BargainAttempt,
      };
    }

    // 用户可以砍价
    return { canBargain: true };
  } catch (error) {
    console.error('[BARGAIN] Error checking bargain eligibility:', error);
    throw error;
  }
}

/**
 * 生成优惠券码
 *
 * 格式: BARGAIN_{timestamp}_{random6}
 * 例如: BARGAIN_1730726400_X7K9P2
 *
 * @returns 唯一优惠券码
 */
export function generateCouponCode(): string {
  const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (秒)

  // 生成6位随机字符串（大写字母+数字）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆的 O/0, I/1
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `BARGAIN_${timestamp}_${random}`;
}

/**
 * 计算优惠券过期时间
 *
 * @param hoursFromNow - 从现在起几小时后过期（默认24小时）
 * @returns ISO 8601 格式的过期时间
 */
export function calculateCouponExpiry(
  hoursFromNow: number = COUPON_EXPIRES_HOURS
): string {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

/**
 * 验证优惠券
 *
 * 检查:
 * 1. 优惠券是否存在
 * 2. 是否归属当前用户
 * 3. 是否过期
 * 4. 是否已使用
 * 5. 产品类型是否匹配（仅月会员）
 *
 * @param supabase - Supabase 客户端
 * @param couponCode - 优惠券码
 * @param userId - 用户 ID
 * @param productType - 产品类型（应为 'monthly'）
 * @returns 验证结果
 */
export async function validateCoupon(
  supabase: SupabaseClient,
  couponCode: string,
  userId: string,
  productType: string
): Promise<CouponValidationResult> {
  try {
    // 1. 查询优惠券
    const { data: attempt, error } = await supabase
      .from('bargain_attempts')
      .select('*')
      .eq('coupon_code', couponCode)
      .maybeSingle();

    if (error || !attempt) {
      console.error('[BARGAIN] Coupon not found:', couponCode, error);
      return {
        valid: false,
        reason: '优惠券不存在',
      };
    }

    // 2. 检查归属用户
    if (attempt.user_id !== userId) {
      console.warn('[BARGAIN] Coupon belongs to different user:', {
        coupon: couponCode,
        attemptUser: attempt.user_id,
        requestUser: userId,
      });
      return {
        valid: false,
        reason: '优惠券不属于当前用户',
      };
    }

    // 3. 检查是否过期
    const now = new Date();
    const expiresAt = new Date(attempt.coupon_expires_at);

    if (expiresAt < now) {
      console.warn('[BARGAIN] Coupon expired:', {
        coupon: couponCode,
        expiresAt: attempt.coupon_expires_at,
        now: now.toISOString(),
      });
      return {
        valid: false,
        reason: '优惠券已过期',
        attempt: attempt as BargainAttempt,
      };
    }

    // 4. 检查是否已使用
    if (attempt.coupon_used) {
      console.warn('[BARGAIN] Coupon already used:', {
        coupon: couponCode,
        usedAt: attempt.coupon_used_at,
      });
      return {
        valid: false,
        reason: '优惠券已使用',
        attempt: attempt as BargainAttempt,
      };
    }

    // 5. 检查产品类型（砍价优惠券仅适用于月会员）
    if (productType !== 'monthly') {
      console.warn('[BARGAIN] Invalid product type:', {
        coupon: couponCode,
        productType,
      });
      return {
        valid: false,
        reason: '优惠券仅适用于月会员',
        attempt: attempt as BargainAttempt,
      };
    }

    // 验证通过
    console.log('[BARGAIN] Coupon valid:', {
      coupon: couponCode,
      discount: attempt.discount_percent,
      finalPrice: attempt.final_price,
    });

    return {
      valid: true,
      attempt: attempt as BargainAttempt,
    };
  } catch (error) {
    console.error('[BARGAIN] Error validating coupon:', error);
    return {
      valid: false,
      reason: '验证失败，请稍后重试',
    };
  }
}

/**
 * 标记优惠券为已使用
 *
 * @param supabase - Supabase 客户端 (需要 service_role 权限)
 * @param couponCode - 优惠券码
 * @returns 是否成功
 */
export async function markCouponAsUsed(
  supabase: SupabaseClient,
  couponCode: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('bargain_attempts')
      .update({
        coupon_used: true,
        coupon_used_at: now,
      })
      .eq('coupon_code', couponCode);

    if (error) {
      console.error('[BARGAIN] Failed to mark coupon as used:', error);
      return false;
    }

    console.log('[BARGAIN] Coupon marked as used:', couponCode);
    return true;
  } catch (error) {
    console.error('[BARGAIN] Error marking coupon as used:', error);
    return false;
  }
}

/**
 * 计算折扣价格
 *
 * @param originalPrice - 原价
 * @param discountPercent - 折扣百分比 (0-99)
 * @returns 最终价格（保留两位小数）
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  discountPercent: number
): number {
  // 计算折扣金额
  const discountAmount = originalPrice * (discountPercent / 100);

  // 最终价格 = 原价 - 折扣金额
  const finalPrice = originalPrice - discountAmount;

  // 保留两位小数，四舍五入
  const rounded = Math.round(finalPrice * 100) / 100;

  // 确保最低价格为 ¥0.01
  return Math.max(0.01, rounded);
}

/**
 * 计算折扣金额
 *
 * @param originalPrice - 原价
 * @param discountPercent - 折扣百分比 (0-99)
 * @returns 折扣金额（保留两位小数）
 */
export function calculateDiscountAmount(
  originalPrice: number,
  discountPercent: number
): number {
  const discountAmount = originalPrice * (discountPercent / 100);
  return Math.round(discountAmount * 100) / 100;
}

/**
 * 验证砍价理由长度
 *
 * @param reason - 砍价理由
 * @returns 是否有效 + 错误信息
 */
export function validateReasonLength(
  reason: string
): { valid: boolean; error?: string } {
  const length = reason.length;

  if (length < MIN_REASON_LENGTH) {
    return {
      valid: false,
      error: `理由过短，至少需要 ${MIN_REASON_LENGTH} 字`,
    };
  }

  if (length > MAX_REASON_LENGTH) {
    return {
      valid: false,
      error: `理由过长，最多 ${MAX_REASON_LENGTH} 字`,
    };
  }

  return { valid: true };
}

/**
 * 格式化优惠券过期时间（用于展示）
 *
 * @param expiresAt - ISO 8601 格式的过期时间
 * @returns 格式化的日期时间字符串
 */
export function formatCouponExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

/**
 * 检查优惠券是否即将过期（剩余时间 < 1小时）
 *
 * @param expiresAt - ISO 8601 格式的过期时间
 * @returns 是否即将过期
 */
export function isCouponExpiringSoon(expiresAt: string): boolean {
  const now = new Date();
  const expires = new Date(expiresAt);
  const hoursRemaining = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursRemaining < 1 && hoursRemaining > 0;
}

// ============================================================================
// 导出配置常量
// ============================================================================

export const BARGAIN_CONFIG = {
  ENABLED: BARGAIN_ENABLED,
  COUPON_EXPIRES_HOURS,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  ORIGINAL_PRICE: 9.9, // 月会员原价
};

// ============================================================================
// 导出默认对象（可选）
// ============================================================================

export default {
  canUserBargain,
  generateCouponCode,
  calculateCouponExpiry,
  validateCoupon,
  markCouponAsUsed,
  calculateDiscountedPrice,
  calculateDiscountAmount,
  validateReasonLength,
  formatCouponExpiry,
  isCouponExpiringSoon,
  BARGAIN_CONFIG,
};
