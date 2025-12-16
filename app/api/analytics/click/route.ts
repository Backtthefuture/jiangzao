// POST /api/analytics/click - 记录点击量

import { NextRequest, NextResponse } from 'next/server';
import { trackClick } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    const clickCount = trackClick(recordId);

    return NextResponse.json({ success: true, clickCount });
  } catch (error) {
    console.error('Failed to track click:', error);
    return NextResponse.json(
      { error: 'Failed to track click' },
      { status: 500 }
    );
  }
}
