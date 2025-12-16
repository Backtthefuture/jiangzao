import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { batchSendTemplateMessage } from '@/lib/wechat';
import { getRecords } from '@/lib/feishu';
import { transformFeishuRecord } from '@/lib/transform';

// 使用service_role key访问数据库（绕过RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 每日推送API
 * 由飞书自动化定时触发（每天早上8点）
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('📅 每日推送任务开始');
  console.log('========================================\n');

  try {
    // ============================================
    // 1. 验证请求来源（飞书webhook密钥）
    // ============================================
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.FEISHU_WEBHOOK_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('❌ 认证失败: 无效的Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ 认证通过');

    // ============================================
    // 2. 获取昨天的日期范围（00:00 - 23:59）
    // ============================================
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayDateStr = yesterday.toLocaleDateString('zh-CN');
    console.log(`📆 目标日期: ${yesterdayDateStr}`);

    // ============================================
    // 3. 检查今天是否已推送过（防止重复推送）
    // ============================================
    const todayDateStr = yesterday.toISOString().split('T')[0];
    const { data: existingLog } = await supabaseAdmin
      .from('push_logs')
      .select('id, push_status')
      .eq('push_date', todayDateStr)
      .eq('push_status', 'success')
      .single();

    if (existingLog) {
      console.log('⏭️  今天已推送过，跳过');
      return NextResponse.json({
        success: true,
        message: '今天已推送过，跳过重复推送',
      });
    }

    // ============================================
    // 4. 从飞书多维表格获取所有已发布内容
    // ============================================
    console.log('🔄 从飞书获取内容数据...');
    const recordsResponse = await getRecords();
    const allContents = recordsResponse.items
      .map(transformFeishuRecord)
      .filter((c) => c.status === 'published');
    console.log(`  ✅ 获取到 ${allContents.length} 条已发布内容`);

    // ============================================
    // 5. 筛选昨天新增的内容（根据publishedAt字段）
    // ============================================
    const yesterdayContents = allContents.filter((content) => {
      const publishDate = new Date(content.publishedAt);
      return publishDate >= yesterday && publishDate <= yesterdayEnd;
    });

    console.log(`📋 昨日新增内容: ${yesterdayContents.length}条`);

    if (yesterdayContents.length > 0) {
      yesterdayContents.forEach((content, index) => {
        console.log(`  ${index + 1}. ${content.title}`);
      });
    }

    // ============================================
    // 6. 如果没有新内容，直接返回
    // ============================================
    if (yesterdayContents.length === 0) {
      console.log('⏭️  昨日无新增内容，跳过推送');
      return NextResponse.json({
        success: true,
        message: '昨日无新增内容，跳过推送',
      });
    }

    // ============================================
    // 7. 获取所有订阅用户
    // ============================================
    console.log('🔄 查询订阅用户...');
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('wechat_subscribers')
      .select('id, openid')
      .eq('is_subscribed', true);

    if (subError) {
      throw new Error(`查询订阅用户失败: ${subError.message}`);
    }

    console.log(`👥 订阅用户数: ${subscribers?.length || 0}`);

    if (!subscribers || subscribers.length === 0) {
      console.log('⏭️  暂无订阅用户，跳过推送');
      return NextResponse.json({
        success: true,
        message: '暂无订阅用户，跳过推送',
      });
    }

    // ============================================
    // 8. 生成推送内容摘要
    // ============================================
    const contentTitles = yesterdayContents
      .slice(0, 3)
      .map((c) => `• ${c.title}`)
      .join('\n');

    const moreCount =
      yesterdayContents.length > 3
        ? `\n...及${yesterdayContents.length - 3}篇更多内容`
        : '';

    // ============================================
    // 9. 构造模板消息数据
    // ============================================
    const messageData = {
      url: process.env.NEXT_PUBLIC_H5_URL || 'https://jiangzao2025.vercel.app/h5',
      data: {
        first: { value: '🎉 降噪平台有新内容更新啦！' },
        time3: { value: yesterdayDateStr }, // 时间字段
        thing5: { value: contentTitles + moreCount }, // 商品名称字段（用于内容列表）
        remark: { value: '点击查看精彩内容 →' },
      },
    };

    console.log('\n📤 准备发送模板消息:');
    console.log(`  - 跳转URL: ${messageData.url}`);
    console.log(`  - 内容摘要:\n${contentTitles}${moreCount}`);

    // ============================================
    // 10. 批量发送模板消息
    // ============================================
    const sendResults = await batchSendTemplateMessage(subscribers, messageData);

    // ============================================
    // 11. 记录推送日志
    // ============================================
    console.log('💾 记录推送日志...');
    const { error: logError } = await supabaseAdmin.from('push_logs').insert({
      push_date: todayDateStr,
      content_ids: yesterdayContents.map((c) => c.id),
      total_users: sendResults.total,
      success_count: sendResults.success,
      fail_count: sendResults.failed,
      push_status: sendResults.failed === 0 ? 'success' : 'partial',
      error_message:
        sendResults.errors.length > 0 ? JSON.stringify(sendResults.errors) : null,
    });

    if (logError) {
      console.error('⚠️  记录推送日志失败:', logError.message);
    } else {
      console.log('  ✅ 推送日志已保存');
    }

    // ============================================
    // 12. 返回结果
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========================================');
    console.log(`✅ 每日推送任务完成 (耗时: ${duration}秒)`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      data: {
        contentCount: yesterdayContents.length,
        userCount: subscribers.length,
        sendResults,
        duration: `${duration}秒`,
      },
    });
  } catch (error: any) {
    console.error('\n========================================');
    console.error('❌ 每日推送任务失败');
    console.error('========================================');
    console.error(error);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
