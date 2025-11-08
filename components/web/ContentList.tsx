'use client';

import { useState } from 'react';
import ContentCard from '@/components/web/ContentCard';
import { Content } from '@/lib/types';

interface ContentListProps {
  initialContents: Content[];
  total: number;
}

export default function ContentList({ initialContents, total }: ContentListProps) {
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [loading, setLoading] = useState(false);
  const limit = 10;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Content List */}
      <div className="space-y-6">
        {contents.map((content, index) => (
          <ContentCard key={content.id} content={content} index={index} />
        ))}
      </div>

      {/* Load More Button */}
      {contents.length < total && (
        <div className="mt-12 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
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
