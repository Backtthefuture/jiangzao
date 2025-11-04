import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  generateOrderId,
  buildPaymentUrl,
  getZPayConfig,
  getNotifyUrl,
  getReturnUrl,
  logZPayAction,
} from '@/lib/zpay';
import { MEMBERSHIP_PLANS, isPurchasableTier } from '@/lib/membership';
import { validateCoupon, calculateDiscountedPrice, calculateDiscountAmount } from '@/lib/bargain';
import type { MembershipTier } from '@/lib/types';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * 创建支付订单
 *
 * POST /api/payment/create-order
 *
 * Request Body:
 * {
 *   "productType": "monthly" | "yearly" | "lifetime",
 *   "paymentMethod": "alipay" | "wxpay",
 *   "couponCode"?: string // V1.4.0 砍价优惠券（仅月会员可用）
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "orderId": "JZ_20251104_...",
 *   "paymentUrl": "https://zpayz.cn/submit.php?...",
 *   "amount": 198,
 *   "productName": "年会员"
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. 验证用户登录状态
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    // 2. 解析请求参数
    const body = await request.json();
    const { productType, paymentMethod, couponCode } = body;

    // 3. 验证参数
    if (!productType || !isPurchasableTier(productType)) {
      return NextResponse.json(
        { success: false, error: '无效的套餐类型' },
        { status: 400 }
      );
    }

    // V1.4.1: 仅支持微信支付
    if (paymentMethod !== 'wxpay') {
      console.warn('[CREATE_ORDER] 不支持的支付方式:', paymentMethod);
      return NextResponse.json(
        {
          success: false,
          error: '当前仅支持微信支付，如需其他支付方式请联系客服',
        },
        { status: 400 }
      );
    }

    // 4. 获取套餐配置
    const plan = MEMBERSHIP_PLANS[productType as Exclude<MembershipTier, 'free'>];
    if (!plan) {
      return NextResponse.json(
        { success: false, error: '套餐配置不存在' },
        { status: 400 }
      );
    }

    // 4.1. V1.4.0 - 验证优惠券（如果提供）
    let finalAmount = plan.price;
    let originalAmount: number | undefined;
    let discountAmount: number | undefined;
    let validatedCouponCode: string | undefined;

    if (couponCode) {
      console.log('[CREATE_ORDER] 验证优惠券:', couponCode);

      const couponValidation = await validateCoupon(
        supabase,
        couponCode,
        user.id,
        productType
      );

      if (!couponValidation.valid) {
        console.warn('[CREATE_ORDER] 优惠券验证失败:', couponValidation.reason);
        return NextResponse.json(
          { success: false, error: couponValidation.reason || '优惠券无效' },
          { status: 400 }
        );
      }

      // 优惠券验证通过，计算折扣价格
      const attempt = couponValidation.attempt!;
      originalAmount = plan.price;
      discountAmount = calculateDiscountAmount(plan.price, attempt.discount_percent);
      finalAmount = attempt.final_price; // 使用 AI 评估时计算的最终价格
      validatedCouponCode = couponCode;

      console.log('[CREATE_ORDER] 优惠券已应用:', {
        originalAmount,
        discountAmount,
        finalAmount,
        discountPercent: attempt.discount_percent,
      });
    }

    // 5. 生成订单号
    const orderId = generateOrderId();

    // 6. 获取客户端 IP (可选)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    // 7. 获取用户邮箱
    const userEmail = user.email || undefined;

    // 8. 写入订单表 (使用 service role)
    const { error: insertError } = await supabase.from('orders').insert({
      order_id: orderId,
      user_id: user.id,
      user_email: userEmail,
      product_type: productType,
      product_name: plan.name,
      amount: finalAmount, // V1.4.0: 使用折扣后的最终价格
      original_amount: originalAmount, // V1.4.0: 原始价格（仅使用优惠券时有值）
      discount_amount: discountAmount, // V1.4.0: 折扣金额（仅使用优惠券时有值）
      coupon_code: validatedCouponCode, // V1.4.0: 优惠券码（仅使用优惠券时有值）
      payment_method: paymentMethod,
      status: 'pending',
      membership_duration_days: plan.durationDays,
      client_ip: clientIp,
    });

    if (insertError) {
      console.error('[CREATE_ORDER] 插入订单失败', insertError);
      return NextResponse.json(
        { success: false, error: '创建订单失败，请稍后重试' },
        { status: 500 }
      );
    }

    // 9. 构造支付 URL
    try {
      const { pid, key } = getZPayConfig();
      const notifyUrl = getNotifyUrl();
      const returnUrl = getReturnUrl(orderId);

      const paymentUrl = buildPaymentUrl(
        {
          pid,
          outTradeNo: orderId,
          money: finalAmount, // V1.4.0: 使用折扣后的最终价格
          type: paymentMethod,
          name: plan.name,
          notifyUrl,
          returnUrl,
          siteName: '降噪平台',
        },
        key
      );

      logZPayAction('CREATE_ORDER', {
        orderId,
        productType,
        amount: finalAmount, // V1.4.0: 使用折扣后的最终价格
        originalAmount,
        discountAmount,
        couponCode: validatedCouponCode,
        paymentMethod,
      });

      // 10. 返回支付参数
      return NextResponse.json({
        success: true,
        orderId,
        paymentUrl,
        amount: finalAmount, // V1.4.0: 使用折扣后的最终价格
        originalAmount, // V1.4.0: 原始价格（仅使用优惠券时有值）
        discountAmount, // V1.4.0: 折扣金额（仅使用优惠券时有值）
        productName: plan.name,
      });
    } catch (configError) {
      // 删除已创建的订单
      await supabase.from('orders').delete().eq('order_id', orderId);

      console.error('[CREATE_ORDER] Z-Pay 配置错误', configError);
      return NextResponse.json(
        { success: false, error: '支付配置错误，请联系管理员' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[CREATE_ORDER] 异常', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
