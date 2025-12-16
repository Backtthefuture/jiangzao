// POST /api/revalidate - 手动触发数据刷新

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { path, secret } = await request.json();

    // 简单的安全验证（可选）
    const expectedSecret = process.env.REVALIDATE_SECRET || 'your-secret-key';
    if (secret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    // 重新验证指定路径，如果未指定则验证所有主要页面
    if (path) {
      revalidatePath(path);
    } else {
      revalidatePath('/');
      revalidatePath('/tags');
      revalidatePath('/guests');
    }

    return NextResponse.json({
      success: true,
      message: 'Revalidation triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Revalidation failed' },
      { status: 500 }
    );
  }
}
