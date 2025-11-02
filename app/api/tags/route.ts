// GET /api/tags - 获取所有标签

import { NextResponse } from 'next/server';
import { aggregateTags } from '@/lib/transform';

export async function GET() {
  try {
    const tags = await aggregateTags();

    return NextResponse.json({
      data: tags.map((tag) => ({
        name: tag.name,
        slug: encodeURIComponent(tag.name),
        contentCount: tag.count,
      })),
    });
  } catch (error) {
    console.error('Failed to get tags:', error);
    return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 });
  }
}
