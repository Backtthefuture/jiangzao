import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { parseString } from 'xml2js';
import { createClient } from '@supabase/supabase-js';

// 使用service_role key访问数据库（绕过RLS）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 微信服务器配置验证接口
 *
 * 微信公众平台在配置服务器地址时，会发送GET请求验证URL的有效性
 * 验证方式：
 * 1. 将token、timestamp、nonce三个参数进行字典序排序
 * 2. 拼接字符串并进行sha1加密
 * 3. 与signature对比，相同则返回echostr
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const signature = searchParams.get('signature') || '';
  const timestamp = searchParams.get('timestamp') || '';
  const nonce = searchParams.get('nonce') || '';
  const echostr = searchParams.get('echostr') || '';

  const token = process.env.WECHAT_TOKEN || '';

  console.log('🔐 微信服务器验证请求:');
  console.log(`  - signature: ${signature}`);
  console.log(`  - timestamp: ${timestamp}`);
  console.log(`  - nonce: ${nonce}`);
  console.log(`  - echostr: ${echostr}`);

  // 1. 将token、timestamp、nonce三个参数进行字典序排序
  const arr = [token, timestamp, nonce].sort();

  // 2. 拼接字符串并进行sha1加密
  const str = arr.join('');
  const sha1Hash = crypto.createHash('sha1').update(str).digest('hex');

  console.log(`  - 计算的sha1: ${sha1Hash}`);

  // 3. 与signature对比
  if (sha1Hash === signature) {
    console.log('  ✅ 验证成功');
    return new NextResponse(echostr);
  } else {
    console.error('  ❌ 验证失败');
    return new NextResponse('验证失败', { status: 403 });
  }
}

/**
 * 接收微信推送的消息和事件
 *
 * 用户关注、取消关注、发送消息等事件都会POST到这个接口
 * 自动管理订阅用户
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log('📨 收到微信推送:', body);

    // 解析XML消息
    return new Promise<NextResponse>((resolve) => {
      parseString(body, async (err, result) => {
        if (err) {
          console.error('❌ XML解析失败:', err);
          resolve(new NextResponse('success')); // 仍返回success避免微信重试
          return;
        }

        try {
          const message = result.xml;
          const msgType = message.MsgType?.[0];
          const event = message.Event?.[0];
          const fromUser = message.FromUserName?.[0]; // 用户OpenID
          const toUser = message.ToUserName?.[0]; // 公众号ID

          console.log(`📩 消息类型: ${msgType}, 事件: ${event}, 用户: ${fromUser}`);

          // 处理关注事件
          if (msgType === 'event' && event === 'subscribe') {
            console.log(`👤 用户关注: ${fromUser}`);

            // 添加订阅用户到数据库
            const { error } = await supabaseAdmin
              .from('wechat_subscribers')
              .upsert(
                {
                  openid: fromUser,
                  is_subscribed: true,
                  subscribe_time: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'openid',
                }
              );

            if (error) {
              console.error('❌ 添加订阅用户失败:', error);
            } else {
              console.log(`✅ 用户 ${fromUser} 已添加到订阅列表`);
            }

            // 返回欢迎消息（可选）
            const replyXml = `
              <xml>
                <ToUserName><![CDATA[${fromUser}]]></ToUserName>
                <FromUserName><![CDATA[${toUser}]]></FromUserName>
                <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
                <MsgType><![CDATA[text]]></MsgType>
                <Content><![CDATA[欢迎关注降噪平台！🎉\n\n每天早上8点，我们会为您推送昨日新增的精彩内容。\n\n点击菜单栏或发送消息查看更多功能。]]></Content>
              </xml>
            `;
            resolve(new NextResponse(replyXml, {
              headers: { 'Content-Type': 'application/xml' },
            }));
            return;
          }

          // 处理取消关注事件
          if (msgType === 'event' && event === 'unsubscribe') {
            console.log(`👋 用户取消关注: ${fromUser}`);

            // 更新订阅状态为false（不删除记录，保留历史数据）
            const { error } = await supabaseAdmin
              .from('wechat_subscribers')
              .update({
                is_subscribed: false,
                updated_at: new Date().toISOString(),
              })
              .eq('openid', fromUser);

            if (error) {
              console.error('❌ 更新订阅状态失败:', error);
            } else {
              console.log(`✅ 用户 ${fromUser} 已取消订阅`);
            }

            // 取消关注事件不需要回复
            resolve(new NextResponse('success'));
            return;
          }

          // 其他消息/事件暂不处理
          console.log('ℹ️  暂不处理此类消息');
          resolve(new NextResponse('success'));
        } catch (error: any) {
          console.error('❌ 处理微信事件失败:', error);
          resolve(new NextResponse('success'));
        }
      });
    });
  } catch (error: any) {
    console.error('❌ 处理微信推送失败:', error);
    return new NextResponse('success'); // 仍返回success避免微信重试
  }
}
