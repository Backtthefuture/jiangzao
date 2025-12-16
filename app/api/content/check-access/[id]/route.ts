import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

const FREE_USER_MAX_VIEWS = 3;
const LOGGED_IN_USER_MAX_VIEWS = 10;

/**
 * V1.2.1 - 检查内容访问权限
 * GET /api/content/check-access/[id]
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const contentId = params.id;

    if (!contentId) {
      return NextResponse.json(
        { error: '内容 ID 不能为空' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 未登录用户
    if (!user) {
      return NextResponse.json({
        isAuthenticated: false,
        maxViews: FREE_USER_MAX_VIEWS,
        // 前端会使用 localStorage 来判断 hasAccess 和 viewCount
        // 这里返回基础信息供前端使用
        hasAccess: null, // 需要前端根据 localStorage 判断
        viewCount: null, // 需要前端根据 localStorage 判断
        resetDate: null,
      });
    }

    // 登录用户:查询本月查看记录
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 查询本月查看总次数
    const { count: totalCount, error: countError } = await supabase
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('viewed_at', startOfMonth.toISOString());

    if (countError) {
      console.error('Error counting content views:', countError);
      // 出错时默认允许访问 (fail-open 策略)
      return NextResponse.json({
        isAuthenticated: true,
        hasAccess: true,
        viewCount: 0,
        maxViews: LOGGED_IN_USER_MAX_VIEWS,
        resetDate: getNextMonthFirstDay(),
        error: '查询失败,默认允许访问',
      });
    }

    const viewCount = totalCount || 0;

    // 检查是否已查看过当前内容
    const { data: existingView, error: checkError } = await supabase
      .from('content_views')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing view:', checkError);
    }

    const hasViewedThisContent = !!existingView;

    // 判断是否有访问权限:
    // 1. 如果已经查看过该内容,允许访问
    // 2. 如果未查看过,检查是否还有剩余额度
    let hasAccess = false;
    if (hasViewedThisContent) {
      hasAccess = true; // 已查看过的内容可以重复访问
    } else {
      hasAccess = viewCount < LOGGED_IN_USER_MAX_VIEWS; // 检查是否还有额度
    }

    return NextResponse.json({
      isAuthenticated: true,
      hasAccess,
      viewCount,
      maxViews: LOGGED_IN_USER_MAX_VIEWS,
      remainingViews: Math.max(0, LOGGED_IN_USER_MAX_VIEWS - viewCount),
      resetDate: getNextMonthFirstDay(),
      hasViewedThisContent,
    });
  } catch (error) {
    console.error('Check access exception:', error);
    // 出错时默认允许访问 (fail-open 策略)
    return NextResponse.json({
      isAuthenticated: false,
      hasAccess: true,
      error: '服务器错误,默认允许访问',
    });
  }
}

/**
 * 获取下个月 1 日的日期字符串
 */
function getNextMonthFirstDay(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0]; // 返回 YYYY-MM-DD 格式
}
