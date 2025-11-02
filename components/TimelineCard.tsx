'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import TagBadge from './TagBadge';
import { Content } from '@/lib/types';
import {
  deriveVideoEmbedMeta,
  deriveVideoThumbnail,
  countMarkdownCharacters,
  calculateReadingTime,
  formatCharCount,
} from '@/lib/utils';

interface TimelineCardProps {
  content: Content;
}

export default function TimelineCard({ content }: TimelineCardProps) {
  const blurDataURL =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmM2Y0ZjYiLz48L3N2Zz4=';
  const videoMeta = deriveVideoEmbedMeta(content.originalLink, content.source);
  const derivedThumbnail = deriveVideoThumbnail(
    content.originalLink,
    content.source,
  );
  const displayCover =
    content.source === 'xiaoyuzhou'
      ? content.coverImage.url || '/video-placeholder.svg'
      : content.coverImage.url || derivedThumbnail || '/video-placeholder.svg';
  const imageClass =
    content.source === 'xiaoyuzhou'
      ? 'object-contain'
      : 'object-cover object-center';
  const hasVideo = Boolean(videoMeta);

  // 计算字符数和阅读时间
  const charCount = useMemo(
    () => countMarkdownCharacters(content.content),
    [content.content],
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

  return (
    <div className="timeline-item relative mb-14">
      {/* 圆点 */}
      <div className="timeline-dot absolute -left-[85px] top-7 w-3 h-3 bg-white border-[3px] border-[#007AFF] rounded-full shadow-[0_0_0_4px_rgba(0,122,255,0.15)] z-10 transition-all duration-300 hover:w-4 hover:h-4 hover:-left-[87px] hover:top-[26px] hover:shadow-[0_0_0_6px_rgba(0,122,255,0.25)] max-md:-left-[6px] max-md:w-2.5 max-md:h-2.5 max-md:hover:w-3.5 max-md:hover:h-3.5 max-md:hover:-left-[7px]" />

      {/* 内容卡片 */}
      <Link href={`/content/${content.id}`}>
        <div className="timeline-card group bg-white rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-[400ms] cubic-bezier(0.4,0,0.2,1) cursor-pointer hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] hover:-translate-y-1 hover:translate-x-2">
          {/* 封面图 */}
          <div
            className="card-image relative w-full overflow-hidden aspect-video bg-[#FAFAFA]"
          >
            {/* 背景层 - 仅小宇宙显示 */}
            {content.source === 'xiaoyuzhou' &&
              content.coverImage.url &&
              !hasVideo && (
                <Image
                  src={content.coverImage.url}
                  alt=""
                  fill
                  className="object-cover blur-3xl scale-110 opacity-30"
                  aria-hidden="true"
                />
              )}

            {/* 前景层 - 主图 */}
            {hasVideo && videoMeta ? (
              <iframe
                src={videoMeta.embedUrl}
                title={`${content.title} - ${videoMeta.provider} player`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : displayCover ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Image
                  src={displayCover}
                  alt={content.title}
                  fill
                  className={`${imageClass} transition-transform duration-300 hover:scale-105`}
                  quality={75}
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                暂无封面
              </div>
            )}

            {/* Badge */}
            <div className="card-badge absolute top-4 right-4 px-3.5 py-1.5 bg-white/95 rounded-2xl text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              {getSourceIcon(content.source)} {getSourceName(content.source)}
            </div>
          </div>

          {/* 计数头部 */}
          <div className="px-7 py-3.5 bg-[#FFF9E6] transition-colors duration-400 group-hover:bg-[#FFE4B5] border-b border-[#f0e6d2]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm font-medium text-gray-700">
                <span className="flex items-center gap-1.5">
                  📋 精选{formatCharCount(charCount)}字
                </span>
                <span className="flex items-center gap-1.5">
                  ⏱️ {readingTime}分钟
                </span>
              </div>
              <div className="text-lg group-hover:rotate-180 transition-transform duration-400">
                ✨
              </div>
            </div>
          </div>

          {/* 内容区 */}
          <div className="card-content p-7 bg-[#F5F5F7] transition-all duration-400 group-hover:bg-[#E5E5E7] max-h-[300px] group-hover:max-h-[800px] overflow-hidden">
            {/* 标题 */}
            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-snug">
              {content.title}
            </h3>

            {/* 嘉宾信息 */}
            <p className="text-base text-gray-600 mb-4">{content.guest}</p>

            {/* 金句区域 */}
            {content.quotes.length > 0 && (
              <div className="mb-5">
                {/* 第一条金句（始终显示） */}
                <div className="text-[17px] text-gray-700 italic leading-relaxed pl-4 border-l-[3px] border-[#007AFF]">
                  💬 {content.quotes[0]}
                </div>

                {/* 其他金句（悬停时显示） */}
                {content.quotes.length > 1 && (
                  <div className="hidden group-hover:block mt-3 space-y-3">
                    {content.quotes.slice(1).map((quote, index) => (
                      <div
                        key={index}
                        className="pt-3 border-t border-dashed border-[#007AFF]/30 text-[17px] text-gray-700 italic leading-relaxed pl-4 border-l-[3px] border-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                        style={{
                          transitionDelay: `${(index + 1) * 100}ms`,
                        }}
                      >
                        💬 {quote}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {content.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-3.5 py-1.5 bg-[#007AFF] text-white rounded-[14px] text-sm font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* 统计 */}
            <div className="flex gap-5 text-[15px] text-gray-400">
              {content.viewCount !== undefined && (
                <span>👁️ {content.viewCount}次阅读</span>
              )}
              {content.clickCount !== undefined && (
                <span>🔗 {content.clickCount}次跳转</span>
              )}
            </div>

            {/* 底部提示 */}
            <div className="mt-5 pt-4 border-t border-dashed border-gray-300 text-center text-sm text-gray-500">
              ········ 点击查看更多 ········
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
