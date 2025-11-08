import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import ContentDetailClient from '@/components/content/ContentDetailClient';
import { createClient } from '@/lib/supabase/server';
import { resolveContentAccess } from '@/lib/access';
import { ANON_COOKIE_MAX_AGE_SECONDS, ANON_COOKIE_NAME } from '@/lib/identity-constants';
import type { ViewStats } from '@/components/content/ViewLimitBanner';
import type { Content } from '@/lib/types';

const FREE_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_FREE_MAX ?? '3', 10);
const LOGGED_IN_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_AUTH_MAX ?? '10', 10);
const BUSINESS_TIMEZONE = process.env.VIEW_LIMIT_TIMEZONE ?? 'Asia/Shanghai';
const FEATURE_ENABLED = process.env.VIEW_LIMIT_V122_ENABLED !== 'false';

interface PageProps {
  params: { id: string };
}

export default async function ContentDetailPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const anonCookie = cookieStore.get(ANON_COOKIE_NAME)?.value ?? null;

  let result;

  try {
    result = await resolveContentAccess({
      contentId: params.id,
      supabase,
      userId: user?.id ?? null,
      anonId: user ? null : anonCookie,
      timezone: BUSINESS_TIMEZONE,
      freeUserMaxViews: FREE_USER_MAX_VIEWS,
      authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTENT_NOT_FOUND') {
      notFound();
    }
    throw error;
  }

  // 在功能关闭时直接放行
  const hasAccess = FEATURE_ENABLED ? result.hasAccess : true;
  const isTruncated = FEATURE_ENABLED ? !result.hasAccess : false;

  const contentPayload: Content = {
    ...result.content,
    content: hasAccess ? result.content.content : result.truncatedContent,
  };

  const viewStats: ViewStats | null = FEATURE_ENABLED
    ? {
        isAuthenticated: result.isAuthenticated,
        viewCount: result.viewCount,
        maxViews: result.maxViews,
        remainingViews: result.remainingViews,
        resetDate: result.resetDate,
        daysUntilReset: result.daysUntilReset,
      }
    : null;

  // Note: Cookie setting has been removed from here as it's not allowed in Server Components.
  // Anonymous user ID cookies should be set in middleware or API routes instead.
  // The current implementation in middleware.ts already handles this correctly.

  return (
    <ContentDetailClient
      content={contentPayload}
      viewStats={viewStats}
      hasAccess={hasAccess}
      isTruncated={isTruncated}
      timezone={BUSINESS_TIMEZONE}
    />
  );
}
