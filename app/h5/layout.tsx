import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '降噪 H5 - AI行业访谈精华',
  description: '专注于AI行业的高质量访谈内容，移动端沉浸式阅读体验',
};

/**
 * H5移动端专用Layout - V2.0.0
 *
 * 特点：
 * - 无Header导航栏（100%屏幕利用率）
 * - 全屏沉浸式布局
 * - 针对触摸屏优化
 */
export default function H5Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
