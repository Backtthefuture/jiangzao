import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '降噪 - AI行业访谈精华策展平台',
  description: '专注于AI行业的高质量访谈内容策展平台,通过人工精选 + AI摘要帮助从业者降低信息噪音',
};

/**
 * 根Layout - V2.0.0
 *
 * 说明：
 * - 只包含html/body和全局样式
 * - Header移至 app/(web)/layout.tsx（Web专用）
 * - H5版本使用 app/h5/layout.tsx（无Header）
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
