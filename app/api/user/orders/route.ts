import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * V1.4.4: 订单历史查询接口
 *
 * GET /api/user/orders
 *
 * 功能: 返回当前用户的订单历史（最近10条）
 *
 * 认证: 需要登录
 *
 * 响应格式:
 * {
 *   success: boolean,
 *   orders?: Array<{
 *     orderId: string,
 *     status: string,
 *     productName: string,
 *     productType: string,
 *     amount: number,
 *     createdAt: string,
 *     paidAt?: string,
 *     tradeNo?: string
 *   }>,
 *   error?: string
 * }
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 获取当前登录用户
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 2. 查询用户订单（最近10条）
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[ORDERS API] 查询订单失败', error);
      return NextResponse.json(
        { success: false, error: '查询订单失败' },
        { status: 500 }
      );
    }

    // 3. 格式化订单数据
    const orders = (data || []).map((o) => ({
      orderId: o.order_id,
      status: o.status,
      productName: o.product_name,
      productType: o.product_type,
      amount: Number(o.amount),
      createdAt: o.created_at,
      paidAt: o.callback_received_at,
      tradeNo: o.trade_no,
    }));

    console.log('[ORDERS API] 查询成功', {
      user_id: user.id,
      count: orders.length,
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('[ORDERS API] 异常', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
