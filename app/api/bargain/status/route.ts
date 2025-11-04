/**
 * GET /api/bargain/status
 *
 * 查询用户砍价状态
 *
 * V1.4.0 - AI智能砍价系统
 *
 * 功能:
 * - 检查用户是否已经砍价
 * - 返回已有砍价记录（如果存在）
 * - 返回是否可以砍价
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUserBargain } from '@/lib/bargain';
import type { BargainStatusResponse } from '@/lib/types';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 创建 Supabase 客户端
    const supabase = createClient();

    // 验证用户登录状态
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[BARGAIN_STATUS] User not authenticated');
      return NextResponse.json<BargainStatusResponse>(
        {
          success: false,
          canBargain: false,
          error: '请先登录',
        },
        { status: 401 }
      );
    }

    console.log('[BARGAIN_STATUS] Checking status for user:', user.id);

    // 检查用户是否可以砍价
    const { canBargain, existingAttempt } = await canUserBargain(
      supabase,
      user.id,
      user.email
    );

    if (canBargain) {
      // 用户可以砍价
      return NextResponse.json<BargainStatusResponse>({
        success: true,
        canBargain: true,
      });
    } else {
      // 用户已经砍价过
      return NextResponse.json<BargainStatusResponse>({
        success: true,
        canBargain: false,
        existingAttempt,
      });
    }
  } catch (error) {
    console.error('[BARGAIN_STATUS] Error:', error);

    return NextResponse.json<BargainStatusResponse>(
      {
        success: false,
        canBargain: false,
        error: '查询失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}
