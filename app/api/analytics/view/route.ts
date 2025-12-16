// POST /api/analytics/view - 记录浏览量

import { NextRequest, NextResponse } from 'next/server';
import { trackView } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    const viewCount = trackView(recordId);

    return NextResponse.json({ success: true, viewCount });
  } catch (error) {
    console.error('Failed to track view:', error);
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    );
  }
}
