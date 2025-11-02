'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import QuoteBlock from '@/components/QuoteBlock';
import TagBadge from '@/components/TagBadge';
import TableOfContents from '@/components/TableOfContents';
import { Content } from '@/lib/types';
import {
  deriveVideoEmbedMeta,
  formatDate,
  countMarkdownCharacters,
  calculateReadingTime,
} from '@/lib/utils';

export default function ContentDetail() {
  const params = useParams();
  const router = useRouter();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);

      // 记录浏览量
      await fetch('/api/analytics/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: params.id }),
      });

      // 获取内容
      const response = await fetch(`/api/contents/${params.id}`);
      if (!response.ok) {
        throw new Error('Content not found');
      }
      const data = await response.json();
      setContent(data);
    } catch (error) {
      console.error('Failed to load content:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleClickOriginalLink = async () => {
    if (!content) return;

    // 记录点击量
    await fetch('/api/analytics/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId: content.id }),
    });

    // 打开原链接
    window.open(content.originalLink, '_blank');
  };

  // 计算阅读时长 - 必须在早期返回之前调用
  const charCount = useMemo(
    () => content ? countMarkdownCharacters(content.content) : 0,
    [content],
  );
  const readingTime = useMemo(
    () => calculateReadingTime(charCount),
    [charCount],
  );

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'xiaoyuzhou':
        return '📻';
      case 'bilibili':
        return '📺';
      case 'youtube':
        return '🎥';
      default:
        return '🔗';
    }
  };

  const getSourceName = (source: string) => {
    switch (source) {
      case 'xiaoyuzhou':
        return '小宇宙';
      case 'bilibili':
        return 'B站';
      case 'youtube':
        return 'YouTube';
      default:
        return source;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">内容不存在</div>
      </div>
    );
  }

  const videoMeta = deriveVideoEmbedMeta(content.originalLink, content.source);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 双栏布局容器 */}
      <div className="flex gap-8">
        {/* 左侧: 目录导航 (桌面端显示) */}
        <TableOfContents contentRef={contentRef} />

        {/* 右侧: 原内容区域 */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {content.title}
          </h1>

          {/* Meta Info */}
          <div className="flex items-center text-sm text-gray-500 mb-6 space-x-4 flex-wrap">
            <span>👤 {content.guest}</span>
            <span>|</span>
            <span>📅 {formatDate(content.publishedAt)}</span>
            <span>|</span>
            <span>⏱️ {readingTime}分钟阅读</span>
            <span>|</span>
            <span>{getSourceIcon(content.source)} {getSourceName(content.source)}</span>
            {content.viewCount !== undefined && (
              <>
                <span>|</span>
                <span>👁️ {content.viewCount} 次阅读</span>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-8">
            {content.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          {/* Quotes */}
          <QuoteBlock quotes={content.quotes} />

          {/* Divider */}
          <hr className="my-8" />

          {/* Content */}
          <div ref={contentRef} className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight, rehypeSlug]}
            >
              {content.content}
            </ReactMarkdown>
          </div>

          {/* CTA Card */}
          <div className="mt-12 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl p-8 shadow-lg">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                想了解更多?
              </h3>
              <p className="text-white/90 mb-6">
                查看原始访谈内容,获取完整的观点和讨论
              </p>
              <button
                onClick={handleClickOriginalLink}
                className="px-8 py-4 bg-white text-[#667eea] text-lg font-semibold rounded-xl hover:bg-gray-50 hover:scale-105 transition-all duration-300 shadow-md"
              >
                🎧 查看完整访谈
              </button>
              {content.clickCount !== undefined && (
                <div className="mt-6 text-white/80 text-sm">
                  🔗 已有 {content.clickCount} 人跳转查看
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
