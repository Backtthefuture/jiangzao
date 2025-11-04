import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);

      // Provide user-friendly error messages
      if (error.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          { error: '邮箱或密码错误' },
          { status: 401 }
        );
      }

      if (error.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: '请先验证您的邮箱' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: error.message || '登录失败，请稍后重试' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: '登录成功！',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Login exception:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
