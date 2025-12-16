// GET /api/guests - 获取所有嘉宾

import { NextResponse } from 'next/server';
import { aggregateGuests } from '@/lib/transform';

export async function GET() {
  try {
    const guests = await aggregateGuests();

    return NextResponse.json({
      data: guests.map((guest) => ({
        name: guest.name,
        slug: encodeURIComponent(guest.name),
        contentCount: guest.count,
      })),
    });
  } catch (error) {
    console.error('Failed to get guests:', error);
    return NextResponse.json(
      { error: 'Failed to get guests' },
      { status: 500 }
    );
  }
}
