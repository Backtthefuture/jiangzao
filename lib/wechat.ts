import axios from 'axios';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';

// Access Token缓存（内存缓存，重启后失效）
let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * 获取微信Access Token（带缓存）
 * 微信access_token有效期7200秒，这里提前5分钟刷新
 */
export async function getWeChatAccessToken(): Promise<string> {
  const now = Date.now();

  // 如果缓存有效，直接返回
  if (accessTokenCache && accessTokenCache.expiresAt > now) {
    console.log('✅ 使用缓存的access_token');
    return accessTokenCache.token;
  }

  console.log('🔄 获取新的access_token...');

  // 请求新token
  const response = await axios.get(`${WECHAT_API_BASE}/token`, {
    params: {
      grant_type: 'client_credential',
      appid: process.env.WECHAT_APPID,
      secret: process.env.WECHAT_APPSECRET,
    },
  });

  if (response.data.errcode) {
    throw new Error(`获取access_token失败: ${response.data.errmsg}`);
  }

  const token = response.data.access_token;
  const expiresIn = response.data.expires_in || 7200;

  // 缓存token（提前5分钟过期）
  accessTokenCache = {
    token,
    expiresAt: now + (expiresIn - 300) * 1000,
  };

  console.log(`✅ 获取access_token成功，有效期: ${expiresIn}秒`);
  return token;
}

/**
 * 发送模板消息给单个用户
 */
export async function sendTemplateMessage(params: {
  openid: string;
  templateId: string;
  url: string; // 跳转URL
  data: {
    first?: { value: string; color?: string };
    time3?: { value: string; color?: string };
    thing5?: { value: string; color?: string };
    remark?: { value: string; color?: string };
    // 兼容旧版字段名
    keyword1?: { value: string; color?: string };
    keyword2?: { value: string; color?: string };
    keyword3?: { value: string; color?: string };
  };
}) {
  const accessToken = await getWeChatAccessToken();

  const response = await axios.post(
    `${WECHAT_API_BASE}/message/template/send?access_token=${accessToken}`,
    {
      touser: params.openid,
      template_id: params.templateId,
      url: params.url,
      data: params.data,
    }
  );

  if (response.data.errcode !== 0) {
    throw new Error(
      `发送模板消息失败: ${response.data.errmsg} (errcode: ${response.data.errcode})`
    );
  }

  return response.data;
}

/**
 * 批量发送模板消息
 * @param users 订阅用户列表
 * @param messageData 消息数据
 * @returns 发送结果统计
 */
export async function batchSendTemplateMessage(
  users: Array<{ openid: string }>,
  messageData: {
    url: string;
    data: {
      first?: { value: string };
      time3?: { value: string };
      thing5?: { value: string };
      remark?: { value: string };
      // 兼容旧版字段名
      keyword1?: { value: string };
      keyword2?: { value: string };
      keyword3?: { value: string };
    };
  }
) {
  const results = {
    total: users.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ openid: string; error: string }>,
  };

  const templateId = process.env.WECHAT_TEMPLATE_ID!;

  console.log(`📤 开始批量发送模板消息，目标用户: ${users.length}人`);

  // 批量发送（微信有频率限制，建议每秒最多10条）
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      await sendTemplateMessage({
        openid: user.openid,
        templateId,
        url: messageData.url,
        data: messageData.data,
      });
      results.success++;
      console.log(`  ✅ [${i + 1}/${users.length}] 发送成功: ${user.openid}`);

      // 延迟100ms避免频率限制（每秒最多10条）
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        openid: user.openid,
        error: error.message,
      });
      console.error(`  ❌ [${i + 1}/${users.length}] 发送失败: ${error.message}`);
    }
  }

  console.log(
    `📊 批量发送完成: 总计${results.total}人, 成功${results.success}人, 失败${results.failed}人`
  );

  return results;
}
