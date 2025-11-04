/**
 * Z-Pay 支付工具库
 * 官方文档: https://z-pay.cn/doc.html
 *
 * 功能:
 * - 生成支付签名
 * - 验证回调签名
 * - 创建支付订单
 * - 查询订单状态
 */

import crypto from 'crypto';

// ============================================================================
// 常量配置
// ============================================================================

/**
 * Z-Pay API 端点
 */
export const ZPAY_ENDPOINTS = {
  SUBMIT: 'https://zpayz.cn/submit.php', // 页面跳转支付
  MAPI: 'https://zpayz.cn/mapi.php', // API 支付
  QUERY: 'https://zpayz.cn/api.php?act=order', // 查询订单
  BALANCE: 'https://zpayz.cn/api.php?act=balance', // 查询余额
} as const;

/**
 * 支付方式
 *
 * V1.4.1 重要说明：
 * - ALIPAY 已停用（商户未开通支付宝渠道）
 * - 新订单仅支持 WXPAY (微信支付)
 * - 保留 ALIPAY 常量定义仅用于历史数据兼容
 */
export const PAYMENT_METHODS = {
  ALIPAY: 'alipay', // 已停用 - 商户未开通支付宝渠道，新订单禁止使用
  WXPAY: 'wxpay',
} as const;

/**
 * 交易状态
 */
export const TRADE_STATUS = {
  SUCCESS: 'TRADE_SUCCESS',
  PENDING: 'TRADE_PENDING',
  FAILED: 'TRADE_FAILED',
} as const;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 支付方式类型
 */
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * 创建支付订单参数
 */
export interface CreatePaymentParams {
  pid: string; // 商户ID
  outTradeNo: string; // 商户订单号
  money: number; // 订单金额 (元)
  type: PaymentMethod; // 支付方式
  name: string; // 商品名称
  notifyUrl: string; // 回调地址
  returnUrl?: string; // 前端跳转地址 (可选)
  siteName?: string; // 网站名称 (可选)
}

/**
 * Z-Pay 回调参数
 */
export interface ZPayCallbackParams {
  pid: string; // 商户ID
  trade_no: string; // Z-Pay 交易号
  out_trade_no: string; // 商户订单号
  type: PaymentMethod; // 支付方式
  name: string; // 商品名称
  money: string; // 订单金额 (字符串)
  trade_status: string; // 交易状态
  sign: string; // 签名
  sign_type?: string; // 签名类型
}

/**
 * 订单查询参数
 */
export interface QueryOrderParams {
  pid: string;
  outTradeNo: string;
  key: string;
}

/**
 * 订单查询结果
 */
export interface QueryOrderResult {
  success: boolean;
  tradeNo?: string;
  outTradeNo?: string;
  money?: string;
  status?: string;
  error?: string;
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 生成 MD5 签名
 *
 * 签名规则:
 * 1. 参数按 key 字母顺序排序
 * 2. 排除 sign 和 sign_type 参数
 * 3. 拼接成 key1=value1&key2=value2
 * 4. 追加商户密钥
 * 5. MD5 加密并转为小写
 *
 * @param params - 待签名参数
 * @param key - 商户密钥
 * @returns MD5 签名 (小写)
 */
export function generateZPaySign(params: Record<string, any>, key: string): string {
  // 1. 过滤并排序参数
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '')
    .sort();

  // 2. 拼接参数字符串
  const paramStr = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');

  // 3. 追加商户密钥
  const signStr = paramStr + key;

  // 4. MD5 加密
  const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex');

  return sign.toLowerCase();
}

/**
 * 验证 Z-Pay 签名
 *
 * @param params - 回调参数
 * @param key - 商户密钥
 * @returns 签名是否有效
 */
export function verifyZPaySign(params: Record<string, any>, key: string): boolean {
  const receivedSign = params.sign;
  if (!receivedSign) {
    return false;
  }

  const calculatedSign = generateZPaySign(params, key);
  return receivedSign.toLowerCase() === calculatedSign.toLowerCase();
}

/**
 * 构造支付 URL
 *
 * 用于页面跳转支付 (SUBMIT 模式)
 *
 * @param params - 支付参数
 * @param key - 商户密钥
 * @returns 完整的支付 URL
 */
export function buildPaymentUrl(params: CreatePaymentParams, key: string): string {
  // 构造请求参数
  const requestParams = {
    pid: params.pid,
    type: params.type,
    out_trade_no: params.outTradeNo,
    notify_url: params.notifyUrl,
    return_url: params.returnUrl || params.notifyUrl,
    name: params.name,
    money: params.money.toFixed(2),
    sitename: params.siteName || '降噪平台',
  };

  // 生成签名
  const sign = generateZPaySign(requestParams, key);

  // 构造 URL 参数
  const urlParams = new URLSearchParams({
    ...requestParams,
    sign,
    sign_type: 'MD5',
  });

  return `${ZPAY_ENDPOINTS.SUBMIT}?${urlParams.toString()}`;
}

/**
 * 查询订单状态
 *
 * @param params - 查询参数
 * @returns 订单信息
 */
export async function queryOrder(params: QueryOrderParams): Promise<QueryOrderResult> {
  try {
    const requestParams = {
      act: 'order',
      pid: params.pid,
      out_trade_no: params.outTradeNo,
    };

    const sign = generateZPaySign(requestParams, params.key);

    const urlParams = new URLSearchParams({
      ...requestParams,
      sign,
      sign_type: 'MD5',
    });

    const response = await fetch(`${ZPAY_ENDPOINTS.QUERY}&${urlParams.toString()}`);
    const data = await response.json();

    if (data.code === 1) {
      return {
        success: true,
        tradeNo: data.trade_no,
        outTradeNo: data.out_trade_no,
        money: data.money,
        status: data.status,
      };
    } else {
      return {
        success: false,
        error: data.msg || '查询失败',
      };
    }
  } catch (error) {
    console.error('[ZPAY] 查询订单失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 验证回调参数完整性
 *
 * @param params - 回调参数
 * @returns 是否合法
 */
export function validateCallbackParams(params: Partial<ZPayCallbackParams>): params is ZPayCallbackParams {
  const requiredFields: (keyof ZPayCallbackParams)[] = [
    'pid',
    'trade_no',
    'out_trade_no',
    'type',
    'name',
    'money',
    'trade_status',
    'sign',
  ];

  for (const field of requiredFields) {
    if (!params[field]) {
      console.error('[ZPAY] 回调参数缺失', field);
      return false;
    }
  }

  return true;
}

/**
 * 解析回调金额
 *
 * 处理可能的字符串/数字格式
 *
 * @param money - 金额字符串
 * @returns 数字金额
 */
export function parseCallbackMoney(money: string | number): number {
  if (typeof money === 'number') {
    return money;
  }
  return parseFloat(money);
}

// ============================================================================
// 环境变量获取
// ============================================================================

/**
 * 获取 Z-Pay 配置
 *
 * 从环境变量读取,仅在服务端使用
 */
export function getZPayConfig() {
  const pid = process.env.ZPAY_PID;
  const key = process.env.ZPAY_KEY;

  if (!pid || !key) {
    throw new Error('Z-Pay 配置缺失: ZPAY_PID 和 ZPAY_KEY 必须在 .env.local 中配置');
  }

  return { pid, key };
}

/**
 * 获取回调地址
 *
 * 从环境变量读取站点 URL,拼接回调路径
 */
export function getNotifyUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL 未配置');
  }

  return `${siteUrl}/api/payment/callback`;
}

/**
 * 获取前端跳转地址
 *
 * 支付成功后用户返回的页面
 */
export function getReturnUrl(orderId: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL 未配置');
  }

  return `${siteUrl}/payment/result?order_id=${orderId}`;
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成商户订单号
 *
 * 格式: JZ_YYYYMMDD_TIMESTAMP_RANDOM
 * 示例: JZ_20251104_1730720000000_A1B2C3
 *
 * @returns 唯一订单号
 */
export function generateOrderId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timestamp = now.getTime();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `JZ_${dateStr}_${timestamp}_${random}`;
}

/**
 * 格式化金额
 *
 * 确保金额为两位小数
 *
 * @param amount - 金额
 * @returns 格式化后的金额字符串
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * 日志记录 (开发环境)
 */
export function logZPayAction(action: string, data: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ZPAY] ${action}`, {
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
}

// ============================================================================
// 导出默认对象 (可选)
// ============================================================================

export default {
  generateZPaySign,
  verifyZPaySign,
  buildPaymentUrl,
  queryOrder,
  validateCallbackParams,
  parseCallbackMoney,
  getZPayConfig,
  getNotifyUrl,
  getReturnUrl,
  generateOrderId,
  formatAmount,
  logZPayAction,
  ZPAY_ENDPOINTS,
  PAYMENT_METHODS,
  TRADE_STATUS,
};
