'use server';

import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import type { NextResponse } from 'next/server';
import { ANON_COOKIE_NAME, ANON_COOKIE_MAX_AGE_SECONDS, type AnonIdentityResult } from './identity-constants';

/**
 * 解析或生成匿名用户 ID。
 * 返回匿名 ID 及是否为新创建。
 */
export async function resolveAnonId(): Promise<AnonIdentityResult> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_COOKIE_NAME)?.value;

  if (existing) {
    return {
      anonId: existing,
      isNew: false,
    };
  }

  return {
    anonId: randomUUID(),
    isNew: true,
  };
}

/**
 * 将匿名 ID 写入响应 Cookie。
 */
export async function attachAnonCookie(response: NextResponse, anonId: string): Promise<void> {
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: ANON_COOKIE_NAME,
    value: anonId,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
  });
}
