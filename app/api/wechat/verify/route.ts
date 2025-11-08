import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
 * 接收微信推送的消息和事件（可选）
 *
 * 用户关注、取消关注、发送消息等事件都会POST到这个接口
 * 可以用于自动管理订阅用户
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log('📨 收到微信推送:', body);

    // TODO: 解析XML，处理关注/取消关注事件
    // 可以在这里自动添加/删除订阅用户

    // 返回"success"告知微信已收到
    return new NextResponse('success');
  } catch (error: any) {
    console.error('处理微信推送失败:', error);
    return new NextResponse('error', { status: 500 });
  }
}
