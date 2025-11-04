import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserReadingStats } from '@/lib/readingHistory';
import { formatDateShort, formatTime } from '@/lib/utils';

const LOGGED_IN_USER_MAX_VIEWS = Number.parseInt(process.env.VIEW_LIMIT_AUTH_MAX ?? '10', 10);
const BUSINESS_TIMEZONE = process.env.VIEW_LIMIT_TIMEZONE ?? 'Asia/Shanghai';

export default async function ReadingHistoryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const stats = await getUserReadingStats({
    supabase,
    userId: user.id,
    timezone: BUSINESS_TIMEZONE,
    authUserMaxViews: LOGGED_IN_USER_MAX_VIEWS,
  });

  const progress = Math.min(100, Math.round((stats.viewCount / stats.maxViews) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">我的阅读历史</h1>
        <p className="text-gray-500">掌握本月阅读进度，回顾已读内容。</p>
      </div>

      <section className="mb-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">本月阅读进度</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.viewCount} / {stats.maxViews} 篇
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>距离重置还有 {stats.daysUntilReset} 天</p>
              <p className="text-xs text-gray-400">重置日期：{stats.resetDate}</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-gray-500">
            完整阅读 {stats.remainingViews >= 0 ? stats.remainingViews : 0} 篇后达到当月上限。
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">最近阅读</h2>

        {stats.recentViews.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-gray-500">
            <p className="text-lg font-medium mb-2">本月还没有阅读记录</p>
            <p className="text-sm mb-6">从精选内容开始，开启本月的第一篇阅读吧！</p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              返回首页
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.recentViews.map((item) => {
              const viewedDate = new Date(item.viewedAt);
              const dateLabel = formatDateShort(viewedDate);
              const timeLabel = formatTime(viewedDate);

              return (
                <Link
                  key={item.contentId}
                  href={`/content/${item.contentId}`}
                  className="block bg-white border border-gray-100 rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-500">
                      {dateLabel} {timeLabel && <span className="ml-2">{timeLabel}</span>}
                    </div>
                    <div className="text-xs text-gray-400">{item.source.toUpperCase()}</div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                    {item.title}
                  </h3>
                  {item.guest && (
                    <p className="text-sm text-gray-500">嘉宾：{item.guest}</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
