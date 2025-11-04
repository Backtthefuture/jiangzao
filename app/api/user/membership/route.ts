import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getMembershipStatus } from '@/lib/membership';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * 获取用户会员信息
 *
 * GET /api/user/membership
 *
 * Response:
 * {
 *   "success": true,
 *   "membership": {
 *     "tier": "yearly",
 *     "isActive": true,
 *     "expiresAt": "2026-11-04T10:00:00Z",
 *     "daysRemaining": 365,
 *     "planName": "年会员",
 *     "badge": "年"
 *   }
 * }
 */
export async function GET(request: Request) {
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

    // 2. 获取会员状态
    const membershipStatus = await getMembershipStatus(supabase, user.id);

    // 3. 返回会员信息
    return NextResponse.json({
      success: true,
      membership: membershipStatus,
    });
  } catch (error) {
    console.error('[MEMBERSHIP] 获取会员信息异常', error);
    return NextResponse.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
