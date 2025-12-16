// 飞书API客户端封装 (使用axios解决网络连接问题)

import axios, { AxiosRequestConfig } from 'axios';

// Token缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

// 创建axios实例，配置超时和重试
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加响应拦截器用于日志记录
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`✅ Feishu API success: ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ Feishu API error: ${error.config?.url}`, error.message);
    return Promise.reject(error);
  }
);

/**
 * 获取飞书 Access Token (带缓存)
 */
export async function getAccessToken(): Promise<string> {
  // 如果缓存存在且未过期，直接返回
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    console.log('✅ Using cached access token');
    return cachedToken.token;
  }

  console.log('🔄 Fetching new access token...');

  // Validate environment variables
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    const missing = [];
    if (!appId) missing.push('FEISHU_APP_ID');
    if (!appSecret) missing.push('FEISHU_APP_SECRET');
    console.error('❌ Missing Feishu environment variables:', missing.join(', '));
    throw new Error(`Missing Feishu credentials: ${missing.join(', ')}`);
  }

  console.log('[Feishu] Using app_id:', appId?.substring(0, 8) + '...');

  try {
    const response = await axiosInstance.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: appId,
        app_secret: appSecret,
      }
    );

    const data = response.data;

    if (data.code !== 0) {
      console.error('[Feishu] API error response:', JSON.stringify(data));
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    // 缓存token (有效期2小时，提前5分钟刷新)
    cachedToken = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire - 300) * 1000,
    };

    console.log(`✅ Access token obtained, expires in ${data.expire}s`);
    return data.tenant_access_token;
  } catch (error: any) {
    console.error('❌ Failed to get access token:', error.message);
    if (error.response) {
      console.error('[Feishu] Error response data:', error.response.data);
      console.error('[Feishu] Error response status:', error.response.status);
    }
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

/**
 * 获取多维表格记录列表（带重试机制）
 */
export async function getRecords(options?: {
  pageSize?: number;
  pageToken?: string;
  filter?: string;
}): Promise<{ items: any[]; hasMore: boolean; pageToken?: string }> {
  const token = await getAccessToken();
  const { pageSize = 100, pageToken, filter } = options || {};

  const params: any = {
    page_size: pageSize,
  };
  if (pageToken) params.page_token = pageToken;
  if (filter) params.filter = filter;

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_BASE_ID}/tables/${process.env.FEISHU_TABLE_ID}/records`;

  console.log(`🔄 Fetching records from Feishu (pageSize: ${pageSize})...`);

  // 重试逻辑：最多重试3次
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axiosInstance.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;

      if (data.code !== 0) {
        throw new Error(`Feishu API error: ${data.msg}`);
      }

      const items = data.data.items || [];
      console.log(`✅ Fetched ${items.length} records from Feishu`);

      return {
        items,
        hasMore: data.data.has_more || false,
        pageToken: data.data.page_token,
      };
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error.message);

      if (attempt < 3) {
        const delay = attempt * 1000; // 递增延迟：1s, 2s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to get records after 3 attempts');
}

/**
 * 获取单条记录详情
 */
export async function getRecordById(recordId: string): Promise<any> {
  const token = await getAccessToken();

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_BASE_ID}/tables/${process.env.FEISHU_TABLE_ID}/records/${recordId}`;

  console.log(`🔄 Fetching record ${recordId} from Feishu...`);

  try {
    const response = await axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    return data.data.record;
  } catch (error: any) {
    console.error('❌ Failed to get record:', error.message);
    throw error;
  }
}

/**
 * 批量获取封面图临时URL (24小时有效)
 */
export async function getImageTempUrls(
  fileTokens: string[]
): Promise<Record<string, string>> {
  if (fileTokens.length === 0) {
    console.log('⚠️  No file tokens provided');
    return {};
  }

  const token = await getAccessToken();

  console.log(`🔄 Fetching ${fileTokens.length} image temp URLs...`);

  try {
    // 逐个获取图片URL（飞书批量接口似乎有参数问题，改为单个请求）
    const urlMap: Record<string, string> = {};

    for (const fileToken of fileTokens) {
      try {
        const response = await axiosInstance.get(
          'https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url',
          {
            params: {
              file_tokens: fileToken,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = response.data;

        if (data.code === 0 && data.data.tmp_download_urls && data.data.tmp_download_urls.length > 0) {
          urlMap[fileToken] = data.data.tmp_download_urls[0].tmp_download_url;
        } else {
          console.error(`❌ Failed to get URL for token ${fileToken}:`, data.msg);
        }
      } catch (error: any) {
        console.error(`❌ Error fetching URL for token ${fileToken}:`, error.message);
      }
    }

    console.log(`✅ Fetched ${Object.keys(urlMap).length}/${fileTokens.length} image URLs`);
    return urlMap;
  } catch (error: any) {
    console.error('❌ Failed to get image URLs:', error.response?.data || error.message);
    return {};
  }
}

/**
 * 获取封面图临时URL (高级权限场景)
 */
export async function getImageTempUrlWithExtra(
  fileToken: string,
  tableId: string,
  fieldId: string,
  recordId: string
): Promise<string> {
  const token = await getAccessToken();

  // 构造extra参数(如果Base开启了高级权限才需要)
  const extra = {
    bitablePerm: {
      tableId: tableId,
      attachments: {
        [fieldId]: {
          [recordId]: [fileToken],
        },
      },
    },
  };

  console.log('🔄 Fetching image URL with extra permission...');

  try {
    const response = await axiosInstance.get(
      'https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url',
      {
        params: {
          file_tokens: fileToken,
          extra: JSON.stringify(extra),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = response.data;

    if (data.code !== 0) {
      console.error('❌ Feishu API error:', data.msg);
      return '';
    }

    return data.data.tmp_download_urls[0]?.tmp_download_url || '';
  } catch (error: any) {
    console.error('❌ Failed to get image URL with extra:', error.message);
    return '';
  }
}

/**
 * 获取所有字段信息
 */
export async function getFields(): Promise<any[]> {
  const token = await getAccessToken();

  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_BASE_ID}/tables/${process.env.FEISHU_TABLE_ID}/fields`;

  console.log('🔄 Fetching fields from Feishu...');

  try {
    const response = await axiosInstance.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg}`);
    }

    console.log(`✅ Fetched ${data.data.items.length} fields`);
    return data.data.items || [];
  } catch (error: any) {
    console.error('❌ Failed to get fields:', error.message);
    throw error;
  }
}
