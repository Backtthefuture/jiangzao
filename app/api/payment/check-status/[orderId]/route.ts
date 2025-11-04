import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * 查询订单状态
 *
 * GET /api/payment/check-status/[orderId]
 *
 * Response:
 * {
 *   "success": true,
 *   "order": {
 *     "orderId": "JZ_20251104_...",
 *     "status": "paid" | "pending" | "completed" | "failed",
 *     "productName": "年会员",
 *     "amount": 198,
 *     "createdAt": "2025-11-04T10:00:00Z",
 *     "paidAt": "2025-11-04T10:05:00Z"
 *   }
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '订单号不能为空' },
        { status: 400 }
      );
    }

    // 1. 验证用户登录状态
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    // 2. 查询订单
    const { data: order, error: queryError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (queryError) {
      console.error('[CHECK_STATUS] 查询订单失败', queryError);
      return NextResponse.json(
        { success: false, error: '查询失败，请稍后重试' },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 3. 验证订单归属
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '无权查看此订单' },
        { status: 403 }
      );
    }

    // 4. 返回订单信息
    return NextResponse.json({
      success: true,
      order: {
        orderId: order.order_id,
        status: order.status,
        productName: order.product_name,
        productType: order.product_type,
        amount: parseFloat(order.amount),
        paymentMethod: order.payment_method,
        createdAt: order.created_at,
        paidAt: order.callback_received_at,
        tradeNo: order.trade_no,
      },
    });
  } catch (error) {
    console.error('[CHECK_STATUS] 异常', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
