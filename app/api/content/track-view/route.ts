import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

const LOGGED_IN_USER_MAX_VIEWS = 10;

/**
 * V1.2.1 - 记录内容查看
 * POST /api/content/track-view
 */
export async function POST(request: Request) {
  try {
    const { contentId } = await request.json();

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

    // 如果用户未登录,前端使用 localStorage 追踪,不需要服务端处理
    if (!user) {
      return NextResponse.json({
        success: true,
        isAuthenticated: false,
        message: '未登录用户,使用本地存储追踪',
      });
    }

    // 登录用户:插入查看记录到数据库
    // 使用 ON CONFLICT DO NOTHING 避免重复插入
    const { error: insertError } = await supabase
      .from('content_views')
      .insert({
        user_id: user.id,
        content_id: contentId,
      })
      .select()
      .single();

    // 如果是重复插入(用户已查看过该内容),忽略错误
    if (insertError && !insertError.message.includes('duplicate')) {
      console.error('Error inserting content view:', insertError);
    }

    // 查询用户本月的查看次数
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('content_views')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('viewed_at', startOfMonth.toISOString());

    if (countError) {
      console.error('Error counting content views:', countError);
      return NextResponse.json(
        { error: '查询查看记录失败' },
        { status: 500 }
      );
    }

    const viewCount = count || 0;
    const remainingViews = Math.max(0, LOGGED_IN_USER_MAX_VIEWS - viewCount);

    return NextResponse.json({
      success: true,
      isAuthenticated: true,
      viewCount,
      maxViews: LOGGED_IN_USER_MAX_VIEWS,
      remainingViews,
    });
  } catch (error) {
    console.error('Track view exception:', error);
    return NextResponse.json(
      { error: '服务器错误,请稍后重试' },
      { status: 500 }
    );
  }
}
