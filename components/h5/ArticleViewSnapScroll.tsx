'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import ArticleCard from './ArticleCard';
import { Content } from '@/lib/types';

interface ArticleViewSnapScrollProps {
  contents: Content[];
}

/**
 * H5主容器组件 - V2.0.0 Snap Scroll方案
 *
 * 功能：
 * - 左右滑动切换文章（Swiper）
 * - 每篇文章垂直滚动阅读（CSS Scroll Snap）
 * - 全屏沉浸式体验
 */
export default function ArticleViewSnapScroll({
  contents,
}: ArticleViewSnapScrollProps) {
  if (contents.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-500 text-lg">暂无内容</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h5-article-container h-screen overflow-hidden">
      <Swiper
        direction="horizontal"
        slidesPerView={1}
        spaceBetween={0}
        className="h-full"
        onSlideChange={(swiper) => {
          // 切换到新文章时，重置滚动位置到顶部
          const currentSlide = swiper.slides[swiper.activeIndex];
          if (currentSlide) {
            const articleContent = currentSlide.querySelector(
              '.article-scroll-container'
            );
            if (articleContent) {
              articleContent.scrollTop = 0;
            }
          }
        }}
      >
        {contents.map((content) => (
          <SwiperSlide key={content.id} className="h-full">
            <ArticleCard content={content} />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* 底部指示器：当前文章位置 */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-xs z-50">
        左右滑动切换文章 · 共{contents.length}篇
      </div>
    </div>
  );
}
