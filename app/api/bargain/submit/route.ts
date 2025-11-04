/**
 * POST /api/bargain/submit
 *
 * 提交砍价理由，AI评估并生成优惠券
 *
 * V1.4.0 - AI智能砍价系统
 *
 * 功能:
 * - 验证用户登录
 * - 检查是否已砍价（每用户终身仅一次）
 * - 验证理由长度（30-300字）
 * - 限速检查（60秒/次）
 * - 调用 Ark AI 评估
 * - 生成优惠券
 * - 保存砍价记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateBargainWithArk, generateFallbackDiscount } from '@/lib/ark';
import {
  canUserBargain,
  generateCouponCode,
  calculateCouponExpiry,
  validateReasonLength,
} from '@/lib/bargain';
import {
  getBargainSystemPrompt,
  getBargainUserPrompt,
} from '@/lib/prompts/bargain';
import type { BargainSubmitRequest, BargainSubmitResponse } from '@/lib/types';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

// 限速：每个用户/IP 60秒内只能提交一次
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 60秒

/**
 * 检查限速
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(key);

  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    // 距离上次请求不足60秒
    return false;
  }

  // 更新最后请求时间
  rateLimitMap.set(key, now);

  // 清理过期记录（简单实现）
  setTimeout(() => {
    rateLimitMap.delete(key);
  }, RATE_LIMIT_WINDOW);

  return true;
}

/**
 * 获取客户端 IP
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. 创建 Supabase 客户端
    const supabase = createServerClient();

    // 2. 验证用户登录状态
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[BARGAIN_SUBMIT] User not authenticated');
      return NextResponse.json<BargainSubmitResponse>(
        {
          success: false,
          error: '请先登录',
        },
        { status: 401 }
      );
    }

    console.log('[BARGAIN_SUBMIT] Processing request for user:', user.id);

    // 3. 解析请求体
    let body: BargainSubmitRequest;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json<BargainSubmitResponse>(
        {
          success: false,
          error: '请求格式错误',
        },
        { status: 400 }
      );
    }

    const { reason } = body;

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json<BargainSubmitResponse>(
        {
          success: false,
          error: '请输入砍价理由',
        },
        { status: 400 }
      );
    }

    // 4. 验证理由长度
    const lengthValidation = validateReasonLength(reason);
    if (!lengthValidation.valid) {
      return NextResponse.json<BargainSubmitResponse>(
        {
          success: false,
          error: lengthValidation.error,
        },
        { status: 400 }
      );
    }

    // 5. 检查用户是否已经砍价
    const { canBargain, existingAttempt } = await canUserBargain(
      supabase,
      user.id,
      user.email
    );

    if (!canBargain) {
      console.log('[BARGAIN_SUBMIT] User already bargained:', user.id);
      return NextResponse.json<BargainSubmitResponse>({
        success: true,
        result: {
          score: existingAttempt!.ai_score,
          discount_percent: existingAttempt!.discount_percent,
          final_price: existingAttempt!.final_price,
          message: existingAttempt!.ai_message,
          coupon_code: existingAttempt!.coupon_code,
          expires_at: existingAttempt!.coupon_expires_at,
        },
      });
    }

    // 6. 限速检查（60秒内只能提交一次）
    // 测试邮箱跳过频率限制
    const testEmails = (process.env.BARGAIN_TEST_EMAILS || '')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    const isTestEmail = user.email && testEmails.includes(user.email);

    if (!isTestEmail) {
      const clientIp = getClientIp(request);
      const rateLimitKey = `bargain:${user.id}:${clientIp}`;

      if (!checkRateLimit(rateLimitKey)) {
        console.warn('[BARGAIN_SUBMIT] Rate limit exceeded:', user.id, clientIp);
        return NextResponse.json<BargainSubmitResponse>(
          {
            success: false,
            error: '请求过于频繁，请稍后再试',
          },
          { status: 429 }
        );
      }
    } else {
      console.log('[BARGAIN_SUBMIT] Test email, skipping rate limit check:', user.email);
    }

    // 7. 调用 Ark AI 评估（带兜底策略）
    let evaluationResult;

    try {
      const systemPrompt = getBargainSystemPrompt();

      console.log('[BARGAIN_SUBMIT] Calling Ark AI...');

      evaluationResult = await evaluateBargainWithArk(
        reason,
        systemPrompt,
        getBargainUserPrompt
      );

      console.log('[BARGAIN_SUBMIT] AI evaluation success:', {
        score: evaluationResult.score,
        discount: evaluationResult.discount_percent,
      });
    } catch (aiError) {
      console.error('[BARGAIN_SUBMIT] AI evaluation failed, using fallback:', aiError);

      // 使用兜底策略（20%折扣）
      evaluationResult = generateFallbackDiscount();
    }

    // 8. 生成优惠券
    const couponCode = generateCouponCode();
    const couponExpiresAt = calculateCouponExpiry();

    console.log('[BARGAIN_SUBMIT] Generated coupon:', {
      code: couponCode,
      expiresAt: couponExpiresAt,
    });

    // 9. 保存砍价记录到数据库（使用 service_role 绕过 RLS）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 测试邮箱:先删除旧记录(允许无限砍价)
    if (isTestEmail) {
      console.log('[BARGAIN_SUBMIT] Test email, deleting old records:', user.email);
      await supabaseAdmin
        .from('bargain_attempts')
        .delete()
        .eq('user_id', user.id);
    }

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    const { data: bargainAttempt, error: insertError } = await supabaseAdmin
      .from('bargain_attempts')
      .insert({
        user_id: user.id,
        user_email: user.email,
        reason,
        reason_length: reason.length,
        ai_score: evaluationResult.score,
        ai_message: evaluationResult.message,
        discount_percent: evaluationResult.discount_percent,
        original_price: 9.9,
        final_price: evaluationResult.final_price,
        coupon_code: couponCode,
        coupon_expires_at: couponExpiresAt,
        coupon_used: false,
        client_ip: clientIp,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[BARGAIN_SUBMIT] Failed to save bargain attempt:', insertError);

      // 检查是否是唯一性约束冲突（用户已砍价）
      if (insertError.code === '23505') {
        // PostgreSQL unique constraint violation
        return NextResponse.json<BargainSubmitResponse>(
          {
            success: false,
            error: '你已经砍价过了，每个用户只能砍价一次',
          },
          { status: 409 }
        );
      }

      return NextResponse.json<BargainSubmitResponse>(
        {
          success: false,
          error: '保存失败，请稍后重试',
        },
        { status: 500 }
      );
    }

    console.log('[BARGAIN_SUBMIT] Bargain attempt saved:', bargainAttempt.id);

    // 10. 返回结果
    return NextResponse.json<BargainSubmitResponse>({
      success: true,
      result: {
        score: evaluationResult.score,
        discount_percent: evaluationResult.discount_percent,
        final_price: evaluationResult.final_price,
        message: evaluationResult.message,
        coupon_code: couponCode,
        expires_at: couponExpiresAt,
      },
    });
  } catch (error) {
    console.error('[BARGAIN_SUBMIT] Unexpected error:', error);

    return NextResponse.json<BargainSubmitResponse>(
      {
        success: false,
        error: '服务器错误，请稍后重试',
      },
      { status: 500 }
    );
  }
}
