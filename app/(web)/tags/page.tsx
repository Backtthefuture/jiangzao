'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TagInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setTags(data.data || []);
    } catch (error) {
      console.error('Failed to load tags:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">全部标签</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tags.map((tag) => (
          <Link
            key={tag.name}
            href={`/tags/${tag.slug}`}
            className="p-6 bg-white border rounded-lg hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              #{tag.name}
            </h2>
            <p className="text-sm text-gray-500">{tag.contentCount} 篇内容</p>
          </Link>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">暂无标签</p>
        </div>
      )}
    </div>
  );
}
