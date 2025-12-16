import ArticleViewSnapScroll from '@/components/h5/ArticleViewSnapScroll';
import { getContentsWithImages } from '@/lib/transform';

export const dynamic = 'force-dynamic';
export const revalidate = 21600; // 6 hours ISR

/**
 * H5移动端首页 - V2.0.0
 *
 * 特点：
 * - 服务端渲染（SSR）+ ISR缓存
 * - 复用Web版数据层（getContentsWithImages）
 * - 传递所有已发布内容给H5组件
 */
export default async function H5Home() {
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

    return <ArticleViewSnapScroll contents={published} />;
  } catch (error) {
    console.error('[H5 Home] Failed to load contents:', error);

    // 返回错误页面
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
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
            请检查环境变量配置
          </div>
        </div>
      </div>
    );
  }
}
