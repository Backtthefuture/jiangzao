'use client';

import { useState } from 'react';
import TimelineGroup from '@/components/web/TimelineGroup';
import { Content } from '@/lib/types';
import { groupContentsByDate } from '@/lib/utils';

interface TimelineViewProps {
  initialContents: Content[];
  total: number;
}

export default function TimelineView({
  initialContents,
  total,
}: TimelineViewProps) {
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [loading, setLoading] = useState(false);
  const limit = 10;

  // 按日期分组
  const groups = groupContentsByDate(contents);

  const loadMore = async () => {
    try {
      setLoading(true);
      const offset = contents.length;
      const response = await fetch(`/api/contents?limit=${limit}&offset=${offset}`);
      const data = await response.json();

      setContents([...contents, ...(data.data || [])]);
    } catch (error) {
      console.error('Failed to load more contents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Timeline Groups */}
      {groups.map((group) => (
        <TimelineGroup key={group.dateLabel} group={group} />
      ))}

      {/* Load More Button */}
      {contents.length < total && (
        <div className="mt-12 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}

      {/* End Mark */}
      {contents.length >= total && contents.length > 0 && (
        <div className="timeline-end text-center py-10 text-gray-400 text-base">
          <div className="text-gray-300 mb-4">━━━━━━━━</div>
          🔚 已加载全部内容
        </div>
      )}

      {/* Stats Badge - V1.4.6: 仅在首页底部显示 */}
      {contents.length >= total && contents.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          {/* Hits.sh 统计徽章 */}
          <a
            href="https://hits.sh/aihuangshu.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block hover:opacity-80 transition-opacity"
            aria-label="网站访问统计"
          >
            <img
              alt="Hits"
              src="https://hits.sh/aihuangshu.com.svg"
              loading="lazy"
            />
          </a>

          {/* 版权信息 */}
          <div className="mt-4 text-xs text-gray-400">
            © 2025 降噪平台 · 降低信息噪音
          </div>
        </div>
      )}

      {/* Empty State */}
      {contents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">暂无内容</p>
        </div>
      )}
    </div>
  );
}
