import TimelineView from '@/components/TimelineView';
import { getContentsWithImages } from '@/lib/transform';

export default async function Home() {
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
}
