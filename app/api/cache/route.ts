// POST /api/cache - 缓存管理接口
// GET /api/cache - 获取缓存统计

import { NextRequest, NextResponse } from 'next/server';
import { cache, CACHE_KEYS } from '@/lib/cache';
import { getContentsWithImages } from '@/lib/transform';

/**
 * GET /api/cache - 获取缓存统计
 */
export async function GET() {
  const stats = cache.getStats();

  return NextResponse.json({
    ...stats,
    ttls: {
      records: '5分钟',
      imageUrls: '23小时',
    },
    keys: {
      recordsAll: CACHE_KEYS.RECORDS_ALL,
      tags: CACHE_KEYS.TAGS,
      guests: CACHE_KEYS.GUESTS,
    },
  });
}

/**
 * POST /api/cache - 手动管理缓存
 *
 * 支持的操作：
 * - clear: 清空所有缓存
 * - refresh: 刷新记录缓存（重新从飞书获取）
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'clear') {
      cache.clear();
      return NextResponse.json({
        success: true,
        message: 'All cache cleared successfully',
      });
    }

    if (action === 'refresh') {
      // 清空记录相关缓存
      cache.delete(CACHE_KEYS.RECORDS_ALL);
      cache.delete(CACHE_KEYS.TAGS);
      cache.delete(CACHE_KEYS.GUESTS);

      console.log('🔄 Manually refreshing cache...');

      // 重新获取并缓存
      await getContentsWithImages();

      return NextResponse.json({
        success: true,
        message: 'Cache refreshed successfully',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
        message: 'Action must be "clear" or "refresh"',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ Cache management error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
