'use client';

import { useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import QuoteBlock from '@/components/QuoteBlock';
import TagBadge from '@/components/TagBadge';
import TableOfContents from '@/components/TableOfContents';
import ViewLimitBanner, { ViewStats } from '@/components/content/ViewLimitBanner';
import PaywallOverlay from '@/components/content/PaywallOverlay';
import ContentAnalyticsTracker from '@/components/content/ContentAnalyticsTracker';
import OriginalLinkButton from '@/components/content/OriginalLinkButton';
import { Content } from '@/lib/types';
import {
  calculateReadingTime,
  countMarkdownCharacters,
  deriveVideoEmbedMeta,
  formatDate,
} from '@/lib/utils';

interface Props {
  content: Content;
  viewStats: ViewStats | null;
  hasAccess: boolean;
  isTruncated: boolean;
  timezone: string;
}

export default function ContentDetailClient({
  content,
  viewStats,
  hasAccess,
  isTruncated,
  timezone,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  const charCount = useMemo(() => countMarkdownCharacters(content.content), [content.content]);
  const readingTime = useMemo(() => calculateReadingTime(charCount), [charCount]);
  const videoMeta = useMemo(() => deriveVideoEmbedMeta(content.originalLink, content.source), [
    content.originalLink,
    content.source,
  ]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <ContentAnalyticsTracker recordId={content.id} />
      <div className="flex gap-8">
        <TableOfContents contentRef={contentRef} />

        <div className="flex-1 min-w-0">
          {viewStats && (
            <ViewLimitBanner viewStats={{ ...viewStats, timezone }} />
          )}

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {content.title}
          </h1>

          <div className="flex items-center text-sm text-gray-500 mb-6 space-x-4 flex-wrap">
            <span>👤 {content.guest}</span>
            <span>|</span>
            <span>📅 {formatDate(content.publishedAt)}</span>
            <span>|</span>
            <span>⏱️ {readingTime}分钟阅读</span>
            <span>|</span>
            <span>
              {getSourceIcon(content.source)} {getSourceName(content.source)}
            </span>
            {content.viewCount !== undefined && (
              <>
                <span>|</span>
                <span>👁️ {content.viewCount} 次阅读</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {content.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>

          <QuoteBlock quotes={content.quotes} />

          <hr className="my-8" />

          {videoMeta && (
            <div className="mb-8">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg">
                <iframe
                  src={videoMeta.embedUrl}
                  title="访谈视频"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          <div className="relative">
            <div ref={contentRef} className="prose prose-lg max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeSlug]}
              >
                {content.content}
              </ReactMarkdown>
            </div>
            {!hasAccess && viewStats && (
              <PaywallOverlay
                isAuthenticated={viewStats.isAuthenticated}
                viewCount={viewStats.viewCount}
                maxViews={viewStats.maxViews}
                resetDate={viewStats.resetDate}
                daysUntilReset={viewStats.daysUntilReset}
              />
            )}
          </div>

          <div className="mt-12 bg-[#007AFF] rounded-2xl p-8 shadow-lg">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                想了解更多?
              </h3>
              <p className="text-white/90 mb-6">
                查看原始访谈内容,获取完整的观点和讨论
              </p>
              <OriginalLinkButton
                recordId={content.id}
                originalLink={content.originalLink}
                className="px-8 py-4 bg-white text-[#007AFF] text-lg font-semibold rounded-xl hover:bg-gray-50 hover:scale-105 transition-all duration-300 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              />
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
