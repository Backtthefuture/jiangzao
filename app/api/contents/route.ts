// GET /api/contents - 获取内容列表

import { NextRequest, NextResponse } from 'next/server';
import { getContentsWithImages, getContentsByTag, getContentsByGuest } from '@/lib/transform';
import { getBatchAnalytics } from '@/lib/db';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('\n📥 GET /api/contents - Request received');

  try {
    const searchParams = request.nextUrl.searchParams;
    const tag = searchParams.get('tag');
    const guest = searchParams.get('guest');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`   Params: tag=${tag}, guest=${guest}, limit=${limit}, offset=${offset}`);

    let contents;

    // 根据筛选条件获取内容
    if (tag) {
      console.log(`🏷️  Filtering by tag: ${tag}`);
      contents = await getContentsByTag(tag);
    } else if (guest) {
      console.log(`👤 Filtering by guest: ${guest}`);
      contents = await getContentsByGuest(guest);
    } else {
      console.log('📋 Fetching all contents');
      // 不传pageSize，获取所有记录并利用L1缓存
      const result = await getContentsWithImages();
      contents = result.contents;
    }

    console.log(`   Total contents fetched: ${contents.length}`);

    // 只返回已发布的内容
    const published = contents.filter((c) => c.status === 'published');
    console.log(`   Published contents: ${published.length}`);

    // 按发布时间倒序排列
    published.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );

    // 分页
    const paginated = published.slice(offset, offset + limit);
    console.log(`   Paginated results: ${paginated.length}`);

    // 批量获取统计数据
    const recordIds = paginated.map((c) => c.id);
    const analyticsMap = getBatchAnalytics(recordIds);

    // 添加统计数据
    paginated.forEach((content) => {
      const analytics = analyticsMap.get(content.id);
      if (analytics) {
        content.viewCount = analytics.viewCount;
        content.clickCount = analytics.clickCount;
      }
    });

    const duration = Date.now() - startTime;
    console.log(`✅ GET /api/contents - Success (${duration}ms)\n`);

    return NextResponse.json({
      total: published.length,
      data: paginated,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ GET /api/contents - Failed (${duration}ms)`);
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Failed to get contents',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
