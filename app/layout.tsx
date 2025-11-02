import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: '降噪 - AI行业访谈精华策展平台',
  description: '专注于AI行业的高质量访谈内容策展平台,通过人工精选 + AI摘要帮助从业者降低信息噪音',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
