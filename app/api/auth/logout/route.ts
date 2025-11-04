import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return NextResponse.json(
        { error: error.message || '退出登录失败' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: '已成功退出登录',
    });
  } catch (error) {
    console.error('Logout exception:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
