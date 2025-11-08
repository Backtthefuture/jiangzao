'use client';

import Link from 'next/link';
import Image from 'next/image';
import TagBadge from '@/components/shared/TagBadge';
import { Content } from '@/lib/types';
import {
  deriveVideoEmbedMeta,
  deriveVideoThumbnail,
  formatDate,
} from '@/lib/utils';

interface ContentCardProps {
  content: Content;
  index?: number;
}

export default function ContentCard({ content, index = 0 }: ContentCardProps) {
  // 简单的灰色blur placeholder (1x1 gray pixel)
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

  return (
    <Link href={`/content/${content.id}`}>
      <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Cover Image */}
          <div className="sm:w-1/3 relative aspect-video overflow-hidden bg-gray-900">
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
                  className={imageClass}
                  quality={75}
                  loading={index >= 3 ? 'lazy' : undefined}
                  priority={index === 0}
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                暂无封面
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
              {content.title}
            </h2>

            {/* Guest & Published Date */}
            <div className="text-sm text-gray-500 mb-3 flex items-center gap-2 flex-wrap">
              <span>嘉宾: {content.guest}</span>
              <span>•</span>
              <span>📅 {formatDate(content.publishedAt)}</span>
            </div>

            {/* First Quote */}
            {content.quotes.length > 0 && (
              <p className="text-gray-700 italic mb-4 line-clamp-2">
                💬 {content.quotes[0]}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {content.tags.slice(0, 3).map((tag) => (
                <TagBadge key={tag} tag={tag} clickable={false} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
