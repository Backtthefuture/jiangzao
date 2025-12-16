// GET /api/contents/:id - 获取内容详情

import { NextRequest, NextResponse } from 'next/server';
import { getContentWithImage } from '@/lib/transform';
import { getAnalytics } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const content = await getContentWithImage(params.id);

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // 获取统计数据
    const analytics = getAnalytics(params.id);
    if (analytics) {
      content.viewCount = analytics.viewCount;
      content.clickCount = analytics.clickCount;
    }

    return NextResponse.json(content);
  } catch (error) {
    console.error('Failed to get content:', error);
    return NextResponse.json(
      { error: 'Failed to get content' },
      { status: 500 }
    );
  }
}
