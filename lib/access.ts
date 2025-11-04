import { randomUUID } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { getContentWithImage } from '@/lib/transform';
import {
  calculateDaysUntilReset,
  getBusinessMonthStartISO,
  getNextMonthResetDate,
  truncateMarkdown,
} from '@/lib/utils';
import { getMembershipStatus, hasActiveMembership } from '@/lib/membership';
import type { Content, MembershipStatus } from '@/lib/types';

interface ResolveAccessOptions {
  contentId: string;
  supabase: SupabaseClient;
  userId: string | null;
  anonId: string | null;
  timezone: string;
  freeUserMaxViews: number;
  authUserMaxViews: number;
  now?: Date;
}

export interface ContentAccessResult {
  content: Content;
  hasAccess: boolean;
  isAuthenticated: boolean;
  isMember: boolean; // V1.3.0: 是否为会员
  membershipStatus: MembershipStatus | null; // V1.3.0: 会员状态
  hasViewedThisContent: boolean;
  viewCount: number;
  maxViews: number; // -1 表示无限 (会员)
  remainingViews: number; // -1 表示无限 (会员)
  resetDate: string;
  daysUntilReset: number;
  timezone: string;
  truncatedContent: string;
  shouldSetAnonCookie: boolean;
  anonId: string | null;
}

export async function resolveContentAccess(options: ResolveAccessOptions): Promise<ContentAccessResult> {
  const {
    contentId,
    supabase,
    userId,
    anonId,
    timezone,
    freeUserMaxViews,
    authUserMaxViews,
    now = new Date(),
  } = options;

  const content = await getContentWithImage(contentId);
  if (!content) {
    throw new Error('CONTENT_NOT_FOUND');
  }

  const monthStart = getBusinessMonthStartISO(now, timezone);
  const resetDate = getNextMonthResetDate(now, timezone);
  const daysUntilReset = calculateDaysUntilReset(resetDate, timezone);
  const nowIso = now.toISOString();

  const isAuthenticated = Boolean(userId);

  // V1.3.0: 检查会员状态
  let membershipStatus: MembershipStatus | null = null;
  let isMember = false;

  if (isAuthenticated && userId) {
    membershipStatus = await getMembershipStatus(supabase, userId);
    isMember = membershipStatus.isActive;
  }

  // 会员用户: 无限阅读 (maxViews = -1)
  // 非会员: 根据登录状态决定
  const maxViews = isMember ? -1 : (isAuthenticated ? authUserMaxViews : freeUserMaxViews);
  let viewCount = 0;
  let remainingViews = maxViews;
  let hasAccess = false;
  let hasViewedThisContent = false;
  let effectiveAnonId = anonId;
  let shouldSetAnonCookie = false;

  if (isAuthenticated && userId) {
    // V1.3.0: 会员用户直接授予访问权限,无需检查月度限制
    if (isMember) {
      hasAccess = true;
      remainingViews = -1; // 无限

      // 仍然记录会员的阅读历史 (用于统计)
      const { data: existingRow } = await supabase
        .from('content_monthly_views')
        .select('user_id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('month_start', monthStart)
        .maybeSingle();

      hasViewedThisContent = Boolean(existingRow);

      if (hasViewedThisContent) {
        // 更新最后阅读时间
        await supabase
          .from('content_monthly_views')
          .update({ last_viewed_at: nowIso })
          .eq('user_id', userId)
          .eq('content_id', contentId)
          .eq('month_start', monthStart);
      } else {
        // 插入阅读记录
        await supabase
          .from('content_monthly_views')
          .insert({
            user_id: userId,
            content_id: contentId,
            month_start: monthStart,
            first_viewed_at: nowIso,
            last_viewed_at: nowIso,
          });
      }

      // 获取会员的月度阅读数 (仅用于统计展示)
      const { count: monthlyCount = 0 } = await supabase
        .from('content_monthly_views')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('month_start', monthStart);

      viewCount = monthlyCount ?? 0;
    } else {
      // 非会员登录用户: 检查月度限制
      const { count: monthlyCount = 0 } = await supabase
        .from('content_monthly_views')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('month_start', monthStart);

      viewCount = monthlyCount ?? 0;
      remainingViews = Math.max(0, maxViews - viewCount);

      const { data: existingRow } = await supabase
        .from('content_monthly_views')
        .select('user_id')
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .eq('month_start', monthStart)
        .maybeSingle();

      hasViewedThisContent = Boolean(existingRow);

      if (hasViewedThisContent) {
        hasAccess = true;
        await supabase
          .from('content_monthly_views')
          .update({ last_viewed_at: nowIso })
          .eq('user_id', userId)
          .eq('content_id', contentId)
          .eq('month_start', monthStart);
      } else if (viewCount < maxViews) {
        const { error } = await supabase
          .from('content_monthly_views')
          .insert({
            user_id: userId,
            content_id: contentId,
            month_start: monthStart,
            first_viewed_at: nowIso,
            last_viewed_at: nowIso,
          });

        if (!error) {
          hasAccess = true;
          viewCount += 1;
          remainingViews = Math.max(0, maxViews - viewCount);
        }
      }
    }
  } else {
    let anonKey = anonId;
    if (!anonKey) {
      anonKey = randomUUID();
      shouldSetAnonCookie = true;
    }
    effectiveAnonId = anonKey;

    const { count: monthlyCount = 0 } = await supabase
      .from('anon_monthly_views')
      .select('*', { count: 'exact', head: true })
      .eq('anon_id', anonKey)
      .eq('month_start', monthStart);

    viewCount = monthlyCount ?? 0;
    remainingViews = Math.max(0, maxViews - viewCount);

    const { data: existingRow } = await supabase
      .from('anon_monthly_views')
      .select('anon_id')
      .eq('anon_id', anonKey)
      .eq('content_id', contentId)
      .eq('month_start', monthStart)
      .maybeSingle();

    hasViewedThisContent = Boolean(existingRow);

    if (hasViewedThisContent) {
      hasAccess = true;
      await supabase
        .from('anon_monthly_views')
        .update({ last_viewed_at: nowIso })
        .eq('anon_id', anonKey)
        .eq('content_id', contentId)
        .eq('month_start', monthStart);
    } else if (viewCount < maxViews) {
      const { error } = await supabase
        .from('anon_monthly_views')
        .insert({
          anon_id: anonKey,
          content_id: contentId,
          month_start: monthStart,
          first_viewed_at: nowIso,
          last_viewed_at: nowIso,
        });

      if (!error) {
        hasAccess = true;
        viewCount += 1;
        remainingViews = Math.max(0, maxViews - viewCount);
      }
    }
  }

  const truncatedContent = truncateMarkdown(content.content, 500);

  return {
    content,
    hasAccess,
    isAuthenticated,
    isMember, // V1.3.0
    membershipStatus, // V1.3.0
    hasViewedThisContent,
    viewCount,
    maxViews,
    remainingViews,
    resetDate,
    daysUntilReset,
    timezone,
    truncatedContent,
    shouldSetAnonCookie,
    anonId: effectiveAnonId,
  };
}
