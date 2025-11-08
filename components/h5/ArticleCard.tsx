'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QuoteBlock from '@/components/shared/QuoteBlock';
import TagBadge from '@/components/shared/TagBadge';
import { Content } from '@/lib/types';
import { formatDate, calculateReadingTime, countMarkdownCharacters } from '@/lib/utils';

interface ArticleCardProps {
  content: Content;
}

/**
 * H5文章卡片组件 - V2.0.0
 *
 * 功能：
 * - 全屏显示单篇文章
 * - 初始折叠300字，点击展开全文
 * - 垂直滚动阅读
 * - 移动端优化布局
 */
export default function ArticleCard({ content }: ArticleCardProps) {
  const [expanded, setExpanded] = useState(false);

  // 计算阅读时间
  const charCount = useMemo(
    () => countMarkdownCharacters(content.content),
    [content.content]
  );
  const readingTime = useMemo(() => calculateReadingTime(charCount), [charCount]);

  // 获取来源图标和名称
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

  // 折叠内容（前300字）
  const previewContent = useMemo(() => {
    if (expanded) return content.content;
    const preview = content.content.slice(0, 300);
    return preview + (content.content.length > 300 ? '...' : '');
  }, [content.content, expanded]);

  return (
    <div className="article-scroll-container h-full overflow-y-auto bg-white">
      {/* 简化顶栏 */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="font-medium">降噪 H5</span>
          <span className="text-xs">🔍</span>
        </div>
      </div>

      {/* 文章内容 */}
      <div className="px-4 py-6">
        {/* 封面图 */}
        {content.coverImage?.url && (
          <div className="relative w-full aspect-video mb-4 rounded-lg overflow-hidden">
            <Image
              src={content.coverImage.url}
              alt={content.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        )}

        {/* 标签 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {content.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        {/* 元信息 */}
        <div className="flex items-center text-xs text-gray-500 mb-4 flex-wrap gap-2">
          <span>👤 {content.guest}</span>
          <span>|</span>
          <span>{getSourceIcon(content.source)} {getSourceName(content.source)}</span>
          <span>|</span>
          <span>📅 {formatDate(content.publishedAt)}</span>
          <span>|</span>
          <span>⏱️ {readingTime}分钟</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {content.title}
        </h1>

        <hr className="my-4 border-gray-200" />

        {/* 金句 */}
        {content.quotes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">💬 精选金句</h3>
            <QuoteBlock quotes={content.quotes.slice(0, 2)} />
          </div>
        )}

        <hr className="my-4 border-gray-200" />

        {/* 正文 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📝 摘要正文</h3>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {previewContent}
            </ReactMarkdown>
          </div>

          {/* 展开按钮 */}
          {!expanded && content.content.length > 300 && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              展开全文 ↓
            </button>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="mt-8 mb-6">
          <hr className="border-gray-200 mb-6" />
          <a
            href={content.originalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 bg-blue-500 text-white text-center rounded-lg font-medium hover:bg-blue-600 transition-colors active:scale-95"
          >
            👉 跳转原内容
          </a>
          <p className="text-center text-xs text-gray-400 mt-3">
            已阅读完毕 · 查看原始访谈
          </p>
        </div>
      </div>
    </div>
  );
}
