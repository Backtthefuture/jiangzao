import type { Metadata } from 'next';
import Header from '@/components/shared/Header';

export const metadata: Metadata = {
  title: '降噪 - AI行业访谈精华策展平台',
  description: '专注于AI行业的高质量访谈内容策展平台,通过人工精选 + AI摘要帮助从业者降低信息噪音',
};

/**
 * Web版本专用Layout
 * V2.0.0: 使用路由组隔离，包含Header导航栏
 */
export default function WebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
