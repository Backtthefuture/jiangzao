import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserReadingStats } from '@/lib/readingHistory';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

const LOGGED_IN_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_AUTH_MAX ?? '10', 10);
const BUSINESS_TIMEZONE = process.env.VIEW_LIMIT_TIMEZONE ?? 'Asia/Shanghai';

/**
 * V1.2.1 - 获取用户阅读统计
 * GET /api/user/reading-stats
 */
export async function GET() {
  try {
    const supabase = createClient();

    // 获取当前用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 未登录用户
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const stats = await getUserReadingStats({
      supabase,
      userId: user.id,
      timezone: BUSINESS_TIMEZONE,
      authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Reading stats exception:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
