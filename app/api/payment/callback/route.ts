import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  verifyZPaySign,
  validateCallbackParams,
  parseCallbackMoney,
  getZPayConfig,
  TRADE_STATUS,
} from '@/lib/zpay';
import { activateOrRenewMembership } from '@/lib/membership';
import { markCouponAsUsed } from '@/lib/bargain'; // V1.4.0: 砍价优惠券
import type { ZPayCallbackParams } from '@/lib/zpay';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * V1.4.4: 获取 service_role 客户端
 *
 * 用于回调接口写入受RLS保护的表
 * - orders: 只有 service_role 可写
 * - user_memberships: 只有 service_role 可写
 */
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    throw new Error('Supabase service_role配置缺失');
  }

  return createAdminClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Z-Pay 支付回调接口
 *
 * GET 或 POST /api/payment/callback
 *
 * Z-Pay 官方文档说明: 请求方法为 GET
 * 但为了兼容性，同时支持 POST (application/x-www-form-urlencoded)
 *
 * 回调参数:
 * - pid: 商户ID
 * - trade_no: Z-Pay 交易号
 * - out_trade_no: 商户订单号
 * - type: 支付方式
 * - name: 商品名称
 * - money: 订单金额
 * - trade_status: 交易状态
 * - sign: 签名
 *
 * 返回: 纯文本 "success" 或 "fail"
 */

/**
 * 核心回调处理逻辑
 * 统一处理 GET 和 POST 请求
 */
async function handleCallback(params: Record<string, any>) {
  const now = new Date();
  let callbackData = { ...params };

  try {
    console.log('[CALLBACK] 收到回调', {
      timestamp: now.toISOString(),
      out_trade_no: params.out_trade_no,
      trade_no: params.trade_no,
      money: params.money,
      trade_status: params.trade_status,
      method: 'UNIFIED',
    });

    // 1. 验证回调参数完整性
    if (!validateCallbackParams(params as Partial<ZPayCallbackParams>)) {
      console.error('[CALLBACK] 参数不完整', params);
      return new Response('fail', { status: 400 });
    }

    const {
      pid,
      trade_no,
      out_trade_no,
      money,
      trade_status,
      sign,
    } = params as ZPayCallbackParams;

    // 2. 验证签名
    const { pid: configPid, key } = getZPayConfig();

    if (!verifyZPaySign(params, key)) {
      console.error('[CALLBACK] 签名验证失败', {
        received: sign,
        params,
      });
      return new Response('fail', { status: 403 });
    }

    // 3. 验证商户 ID
    if (pid !== configPid) {
      console.error('[CALLBACK] 商户ID不匹配', { received: pid, expected: configPid });
      return new Response('fail', { status: 403 });
    }

    // 4. 验证交易状态
    if (trade_status !== TRADE_STATUS.SUCCESS) {
      console.log('[CALLBACK] 交易状态非成功', trade_status);
      return new Response('success'); // 返回 success 避免重复回调
    }

    // 5. 查询订单 (V1.4.4: 使用 service_role)
    const admin = getAdmin();

    const { data: order, error: queryError } = await admin
      .from('orders')
      .select('*')
      .eq('order_id', out_trade_no)
      .maybeSingle();

    if (queryError || !order) {
      console.error('[CALLBACK] 订单不存在', out_trade_no, queryError);
      return new Response('fail', { status: 404 });
    }

    // 6. 幂等性检查：仅处理 pending → paid
    if (order.status !== 'pending') {
      console.log('[CALLBACK] 订单已处理', {
        order_id: out_trade_no,
        status: order.status,
      });
      return new Response('success'); // 返回 success 避免重复回调
    }

    // 7. 验证金额
    const callbackAmount = parseCallbackMoney(money);
    const orderAmount = parseFloat(order.amount);

    if (Math.abs(callbackAmount - orderAmount) > 0.01) {
      console.error('[CALLBACK] 金额不匹配', {
        callback: callbackAmount,
        order: orderAmount,
      });
      return new Response('fail', { status: 400 });
    }

    // 8. 更新订单状态为 paid (V1.4.4: 使用 service_role)
    const { error: updateError } = await admin
      .from('orders')
      .update({
        status: 'paid',
        trade_no,
        callback_received_at: now.toISOString(),
        callback_data: callbackData,
      })
      .eq('order_id', out_trade_no)
      .eq('status', 'pending'); // 再次确认状态

    if (updateError) {
      console.error('[CALLBACK] 更新订单状态失败', updateError);
      return new Response('fail', { status: 500 });
    }

    // 9. 激活/续费会员 (V1.4.4: 使用 service_role)
    const membershipSuccess = await activateOrRenewMembership(
      admin,
      order.user_id,
      order.product_type
    );

    if (!membershipSuccess) {
      console.error('[CALLBACK] 激活会员失败', {
        order_id: out_trade_no,
        user_id: order.user_id,
        product_type: order.product_type,
      });
      // 不返回 fail，避免重复回调，后续手动处理
      return new Response('success');
    }

    // 10. V1.4.0 - 标记优惠券为已使用（如果订单使用了优惠券）(V1.4.4: 使用 service_role)
    if (order.coupon_code) {
      console.log('[CALLBACK] 标记优惠券为已使用:', order.coupon_code);

      const couponMarked = await markCouponAsUsed(admin, order.coupon_code);

      if (!couponMarked) {
        console.error('[CALLBACK] 标记优惠券失败', {
          order_id: out_trade_no,
          coupon_code: order.coupon_code,
        });
        // 不返回 fail，避免重复回调，后续手动处理
      } else {
        console.log('[CALLBACK] 优惠券已标记为已使用:', order.coupon_code);
      }
    }

    // 11. 更新订单状态为 completed (V1.4.4: 使用 service_role)
    await admin
      .from('orders')
      .update({
        status: 'completed',
        membership_start_date: now.toISOString(),
      })
      .eq('order_id', out_trade_no);

    console.log('[CALLBACK] 处理成功', {
      order_id: out_trade_no,
      trade_no,
      user_id: order.user_id,
      product_type: order.product_type,
    });

    // 12. 返回 success
    return new Response('success');
  } catch (error) {
    console.error('[CALLBACK] 异常', {
      error,
      callbackData,
    });
    return new Response('fail', { status: 500 });
  }
}

/**
 * GET 请求处理
 * Z-Pay 官方文档说明: 支付结果通知使用 GET 请求
 */
export async function GET(request: Request) {
  try {
    // 解析 URL 查询参数
    const { searchParams } = new URL(request.url);
    const params: Record<string, any> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    console.log('[CALLBACK] GET 请求', params);

    // 调用统一处理函数
    return await handleCallback(params);
  } catch (error) {
    console.error('[CALLBACK] GET 请求异常', error);
    return new Response('fail', { status: 500 });
  }
}

/**
 * POST 请求处理
 * 兼容 application/x-www-form-urlencoded 格式
 */
export async function POST(request: Request) {
  try {
    // 解析表单数据
    const formData = await request.formData();
    const params: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value;
    }

    console.log('[CALLBACK] POST 请求', params);

    // 调用统一处理函数
    return await handleCallback(params);
  } catch (error) {
    console.error('[CALLBACK] POST 请求异常', error);
    return new Response('fail', { status: 500 });
  }
}
