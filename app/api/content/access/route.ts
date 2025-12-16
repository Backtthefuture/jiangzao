import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { ANON_COOKIE_NAME } from '@/lib/identity-constants';
import { attachAnonCookie, resolveAnonId } from '@/lib/identity';
import { resolveContentAccess } from '@/lib/access';
import type { ContentAccessResult } from '@/lib/access';
import type { Content } from '@/lib/types';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

const FREE_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_FREE_MAX ?? '3', 10);
const LOGGED_IN_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_AUTH_MAX ?? '10', 10);
const BUSINESS_TIMEZONE = process.env.VIEW_LIMIT_TIMEZONE ?? 'Asia/Shanghai';
const FEATURE_ENABLED = process.env.VIEW_LIMIT_V122_ENABLED !== 'false';

const SEARCH_BOT_WHITELIST = [
  /Googlebot/i,
  /bingbot/i,
  /Baiduspider/i,
  /YandexBot/i,
  /Sogou/i,
  /DuckDuckBot/i,
];

interface AccessRequestBody {
  contentId?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AccessRequestBody;
    const contentId = body.contentId?.trim();

    if (!contentId) {
      return NextResponse.json(
        { error: '内容 ID 不能为空' },
        { status: 400 },
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userAgent = request.headers.get('user-agent') ?? body.userAgent ?? '';

    if (isSearchBot(userAgent)) {
      const result = await resolveContentAccess({
        contentId,
        supabase,
        userId: user?.id ?? null,
        anonId: null,
        timezone: BUSINESS_TIMEZONE,
        freeUserMaxViews: FREE_USER_MAX_VIEWS,
        authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
      });

      const payload = mapResultPayload(result, true);
      return NextResponse.json({ ...payload, bypassReason: 'search-bot' });
    }

    if (!FEATURE_ENABLED) {
      const result = await resolveContentAccess({
        contentId,
        supabase,
        userId: user?.id ?? null,
        anonId: null,
        timezone: BUSINESS_TIMEZONE,
        freeUserMaxViews: FREE_USER_MAX_VIEWS,
        authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
      });

      const payload = mapResultPayload(result, true);
      const response = NextResponse.json({ ...payload, featureDisabled: true });

      if (!result.isAuthenticated && result.shouldSetAnonCookie && result.anonId) {
        await attachAnonCookie(response, result.anonId);
      }

      return response;
    }

    const cookieStore = await cookies();
    const { anonId: cookieAnonId } = await resolveAnonId();

    const result = await resolveContentAccess({
      contentId,
      supabase,
      userId: user?.id ?? null,
      anonId: user ? null : cookieAnonId,
      timezone: BUSINESS_TIMEZONE,
      freeUserMaxViews: FREE_USER_MAX_VIEWS,
      authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
    });

    const payload = mapResultPayload(result);
    const response = NextResponse.json(payload);

    if (!result.isAuthenticated && result.shouldSetAnonCookie && result.anonId) {
      await attachAnonCookie(response, result.anonId);
    } else if (!result.isAuthenticated && cookieAnonId && !cookieStore.get(ANON_COOKIE_NAME)) {
      // 用户已有 anonId 但尚未写入响应 (SSR -> CSR 场景)
      await attachAnonCookie(response, cookieAnonId);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTENT_NOT_FOUND') {
      return NextResponse.json({
        error: '内容不存在',
      }, { status: 404 });
    }

    console.error('Content access error:', error);
    return NextResponse.json(
      {
        error: '服务器错误,请稍后重试',
        hasAccess: false,
      },
      { status: 500 },
    );
  }
}

function isSearchBot(userAgent: string): boolean {
  if (!userAgent) {
    return false;
  }

  return SEARCH_BOT_WHITELIST.some((regex) => regex.test(userAgent));
}

function mapResultPayload(result: ContentAccessResult, bypass = false) {
  const contentPayload: Content = {
    ...result.content,
    content: result.hasAccess || bypass
      ? result.content.content
      : result.truncatedContent,
  };

  return {
    hasAccess: bypass ? true : result.hasAccess,
    isAuthenticated: result.isAuthenticated,
    viewCount: result.viewCount,
    maxViews: result.maxViews,
    remainingViews: result.remainingViews,
    resetDate: result.resetDate,
    timezone: result.timezone,
    daysUntilReset: result.daysUntilReset,
    hasViewedThisContent: result.hasViewedThisContent,
    isTruncated: bypass ? false : !result.hasAccess,
    content: contentPayload,
  };
}
