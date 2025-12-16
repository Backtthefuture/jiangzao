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
  // supabase: SupabaseClient; // Unused
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
    timezone,
    now = new Date(),
  } = options;

  const content = await getContentWithImage(contentId);
  if (!content) {
    throw new Error('CONTENT_NOT_FOUND');
  }

  const resetDate = getNextMonthResetDate(now, timezone);
  const daysUntilReset = calculateDaysUntilReset(resetDate, timezone);

  const truncatedContent = truncateMarkdown(content.content, 500);

  // BYPASS for public access plan
  return {
    content,
    hasAccess: true, // Always allow access
    isAuthenticated: false,
    isMember: false,
    membershipStatus: null,
    hasViewedThisContent: true, // Pretend viewed so we don't count
    viewCount: 0,
    maxViews: -1, // Unlimited
    remainingViews: -1, // Unlimited
    resetDate,
    daysUntilReset,
    timezone,
    truncatedContent,
    shouldSetAnonCookie: false,
    anonId: null,
  };
}
