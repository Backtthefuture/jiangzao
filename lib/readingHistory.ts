import { SupabaseClient } from '@supabase/supabase-js';
import { getContentWithImage } from '@/lib/transform';
import {
  calculateDaysUntilReset,
  getBusinessMonthStartISO,
  getNextMonthResetDate,
} from '@/lib/utils';

export interface RecentViewItem {
  contentId: string;
  viewedAt: string;
  title: string;
  guest: string;
  source: string;
}

export interface ReadingStatsResult {
  viewCount: number;
  maxViews: number;
  remainingViews: number;
  resetDate: string;
  daysUntilReset: number;
  timezone: string;
  recentViews: RecentViewItem[];
}

interface ReadingStatsOptions {
  supabase: SupabaseClient;
  userId: string;
  timezone: string;
  authUserMaxViews: number;
  limit?: number;
}

export async function getUserReadingStats({
  supabase,
  userId,
  timezone,
  authUserMaxViews,
  limit = 20,
}: ReadingStatsOptions): Promise<ReadingStatsResult> {
  const monthStart = getBusinessMonthStartISO(new Date(), timezone);
  const resetDate = getNextMonthResetDate(new Date(), timezone);

  const { count: monthlyCount = 0, error: countError } = await supabase
    .from('content_monthly_views')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('month_start', monthStart);

  if (countError) {
    throw countError;
  }

  const { data: monthlyRows, error: rowsError } = await supabase
    .from('content_monthly_views')
    .select('content_id, last_viewed_at')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .order('last_viewed_at', { ascending: false })
    .limit(limit);

  if (rowsError) {
    throw rowsError;
  }

  const recentViews = await enrichRecentViews(monthlyRows ?? []);

  const viewCount = monthlyCount ?? 0;
  const remainingViews = Math.max(0, authUserMaxViews - viewCount);

  return {
    viewCount,
    maxViews: authUserMaxViews,
    remainingViews,
    resetDate,
    daysUntilReset: calculateDaysUntilReset(resetDate, timezone),
    timezone,
    recentViews,
  };
}

async function enrichRecentViews(
  records: Array<{ content_id: string; last_viewed_at: string }>,
): Promise<RecentViewItem[]> {
  if (records.length === 0) {
    return [];
  }

  const results = await Promise.all(
    records.map(async (record) => {
      const content = await getContentWithImage(record.content_id);
      return {
        contentId: record.content_id,
        viewedAt: record.last_viewed_at,
        title: content?.title ?? '内容已下架',
        guest: content?.guest ?? '',
        source: content?.source ?? '',
      };
    }),
  );

  return results;
}
