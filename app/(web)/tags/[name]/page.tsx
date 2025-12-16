'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ContentCard from '@/components/web/ContentCard';
import { Content } from '@/lib/types';

export default function TagFilterPage() {
  const params = useParams();
  const tagName = decodeURIComponent(params.name as string);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContents = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/contents?tag=${encodeURIComponent(tagName)}`
      );
      const data = await response.json();
      setContents(data.data || []);
    } catch (error) {
      console.error('Failed to load contents:', error);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  useEffect(() => {
    void loadContents();
  }, [loadContents]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 mb-4">
        首页 &gt; 标签 &gt; {tagName}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">#{tagName}</h1>
      <p className="text-gray-500 mb-8">找到 {contents.length} 篇内容</p>

      {/* Content List */}
      <div className="space-y-6">
        {contents.map((content) => (
          <ContentCard key={content.id} content={content} />
        ))}
      </div>

      {contents.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">暂无内容</p>
        </div>
      )}
    </div>
  );
}
