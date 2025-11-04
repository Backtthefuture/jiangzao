/**
 * 火山方舟 (Volcano Ark) AI API 客户端
 *
 * V1.4.0 - AI砍价系统
 *
 * 功能:
 * - 调用火山方舟大模型 API
 * - 评估用户砍价理由
 * - 生成折扣和点评
 */

// ============================================================================
// 类型定义
// ============================================================================

export interface ArkMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ArkChatOptions {
  temperature?: number;
  max_tokens?: number;
  timeout?: number; // 超时时间（毫秒）
}

export interface ArkChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 砍价评估结果
 */
export interface BargainEvaluationResult {
  score: number; // 0-100
  discount_percent: number; // 0-99
  final_price: number; // 0.01-9.90
  message: string; // AI点评
}

// ============================================================================
// 配置
// ============================================================================

const ARK_API_KEY = process.env.ARK_API_KEY || '';
const ARK_API_BASE = process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || '';

const DEFAULT_TIMEOUT = 30000; // 30秒 (增加超时时间)
const DEFAULT_MAX_RETRIES = 2; // 重试2次（总共3次尝试）

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 调用火山方舟 Chat API
 *
 * @param messages - 消息数组
 * @param options - 可选参数
 * @returns AI响应内容
 */
export async function callArkChat(
  messages: ArkMessage[],
  options: ArkChatOptions = {}
): Promise<string> {
  const {
    temperature = 0.7,
    max_tokens = 1000,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  // 验证配置
  if (!ARK_API_KEY) {
    throw new Error('[ARK] Missing ARK_API_KEY in environment variables');
  }

  if (!ARK_MODEL_ID) {
    throw new Error('[ARK] Missing ARK_MODEL_ID in environment variables');
  }

  // 构建请求体
  const requestBody = {
    model: ARK_MODEL_ID,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature,
    max_tokens,
  };

  console.log('[ARK] Calling chat API:', {
    model: ARK_MODEL_ID,
    messageCount: messages.length,
    temperature,
    max_tokens,
  });

  // 发送请求（带超时控制）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${ARK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ARK] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Ark API error: ${response.status} ${response.statusText}`
      );
    }

    const data: ArkChatResponse = await response.json();

    // 提取响应内容
    if (
      !data.choices ||
      data.choices.length === 0 ||
      !data.choices[0].message
    ) {
      console.error('[ARK] Invalid response structure:', data);
      throw new Error('Invalid Ark API response structure');
    }

    const content = data.choices[0].message.content;

    console.log('[ARK] Chat API success:', {
      usage: data.usage,
      contentLength: content.length,
    });

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[ARK] Request timeout');
      throw new Error('Ark API timeout');
    }

    throw error;
  }
}

/**
 * 调用火山方舟 Chat API（带重试机制）
 *
 * @param messages - 消息数组
 * @param options - 可选参数
 * @param retries - 剩余重试次数
 * @returns AI响应内容
 */
async function callArkChatWithRetry(
  messages: ArkMessage[],
  options: ArkChatOptions = {},
  retries = DEFAULT_MAX_RETRIES
): Promise<string> {
  try {
    return await callArkChat(messages, options);
  } catch (error) {
    if (retries > 0) {
      console.warn(`[ARK] Request failed, retrying... (${retries} retries left)`);
      // 指数退避：等待 1s, 2s, 4s...
      const delay = Math.pow(2, DEFAULT_MAX_RETRIES - retries) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callArkChatWithRetry(messages, options, retries - 1);
    }

    console.error('[ARK] All retries exhausted');
    throw error;
  }
}

/**
 * 评估砍价理由并生成折扣
 *
 * @param userReason - 用户砍价理由
 * @param systemPrompt - 系统提示词
 * @param userPrompt - 用户提示词模板
 * @returns 评估结果
 */
export async function evaluateBargainWithArk(
  userReason: string,
  systemPrompt: string,
  userPromptTemplate: (reason: string) => string
): Promise<BargainEvaluationResult> {
  try {
    // 构建消息
    const messages: ArkMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPromptTemplate(userReason),
      },
    ];

    console.log('[ARK] Evaluating bargain reason:', {
      reasonLength: userReason.length,
    });

    // 调用 AI（带重试）
    const responseText = await callArkChatWithRetry(messages, {
      temperature: 0.7,
      max_tokens: 500,
      timeout: DEFAULT_TIMEOUT,
    });

    // 解析 JSON 响应
    let result: BargainEvaluationResult;

    try {
      // 尝试提取 JSON（可能被包裹在 markdown 代码块中）
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[ARK] Failed to parse JSON response:', {
        response: responseText,
        error: parseError,
      });
      throw new Error('Invalid JSON response from AI');
    }

    // 验证响应格式
    if (
      typeof result.score !== 'number' ||
      typeof result.discount_percent !== 'number' ||
      typeof result.final_price !== 'number' ||
      typeof result.message !== 'string'
    ) {
      console.error('[ARK] Invalid response structure:', result);
      throw new Error('Invalid response structure from AI');
    }

    // 验证数值范围
    if (
      result.score < 0 ||
      result.score > 100 ||
      result.discount_percent < 0 ||
      result.discount_percent > 99 ||
      result.final_price < 0.01 ||
      result.final_price > 9.9
    ) {
      console.error('[ARK] Values out of range:', result);
      throw new Error('AI returned values out of valid range');
    }

    console.log('[ARK] Bargain evaluation success:', {
      score: result.score,
      discount: result.discount_percent,
      price: result.final_price,
    });

    return result;
  } catch (error) {
    console.error('[ARK] Bargain evaluation failed:', error);
    throw error;
  }
}

/**
 * 生成兜底折扣（AI失败时使用）
 *
 * @returns 兜底评估结果（20%折扣）
 */
export function generateFallbackDiscount(): BargainEvaluationResult {
  const discount_percent = 20;
  const original_price = 9.9;
  const final_price = parseFloat(
    (original_price * (1 - discount_percent / 100)).toFixed(2)
  );

  return {
    score: 60,
    discount_percent,
    final_price,
    message:
      '抱歉，AI评估系统暂时繁忙，我们为你准备了一个特别优惠！希望这个折扣能帮到你。',
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 测试 Ark API 连接
 *
 * @returns 是否连接成功
 */
export async function testArkConnection(): Promise<boolean> {
  try {
    const messages: ArkMessage[] = [
      {
        role: 'system',
        content: '你是一个测试助手。',
      },
      {
        role: 'user',
        content: '请回复"连接成功"',
      },
    ];

    const response = await callArkChat(messages, {
      temperature: 0,
      max_tokens: 50,
    });

    console.log('[ARK] Connection test response:', response);
    return true;
  } catch (error) {
    console.error('[ARK] Connection test failed:', error);
    return false;
  }
}

// ============================================================================
// 导出默认对象（可选）
// ============================================================================

export default {
  callArkChat,
  evaluateBargainWithArk,
  generateFallbackDiscount,
  testArkConnection,
};
