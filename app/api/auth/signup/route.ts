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

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
      },
    });

    if (error) {
      console.error('Signup error:', error);
      return NextResponse.json(
        { error: error.message || '注册失败，请稍后重试' },
        { status: 400 }
      );
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return NextResponse.json({
        message: '注册成功！请检查您的邮箱并点击验证链接完成注册。',
        user: data.user,
        requiresEmailVerification: true,
      });
    }

    return NextResponse.json({
      message: '注册成功！',
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Signup exception:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
