import TimelineView from '@/components/web/TimelineView';
import { getContentsWithImages } from '@/lib/transform';

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // 6 hours ISR

export default async function Home() {
  try {
    // 服务端直接获取数据（利用L1缓存）
    const result = await getContentsWithImages();

    // 过滤已发布内容并按发布时间倒序排列
    const published = result.contents
      .filter((c) => c.status === 'published')
      .sort((a, b) => {
        // 处理undefined的情况，将undefined排到最后
        if (!a.publishedAt && !b.publishedAt) return 0;
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      });

    // 获取前10条作为初始数据
    const initialContents = published.slice(0, 10);
    const total = published.length;

    return (
      <TimelineView
        initialContents={initialContents}
        total={total}
      />
    );
  } catch (error) {
    console.error('[Home] Failed to load contents:', error);
    // Return error page (server-side rendered)
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">加载失败</h1>
          <p className="text-gray-600 mb-6">
            无法加载内容，可能是配置问题。
          </p>
          <p className="text-sm text-gray-500 mb-4 break-words">
            {errorMessage}
          </p>
          <div className="text-xs text-gray-400 mt-4">
            请检查环境变量配置（FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_BASE_ID, FEISHU_TABLE_ID）
          </div>
        </div>
      </div>
    );
  }
}
