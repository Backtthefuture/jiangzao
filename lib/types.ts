// 数据类型定义

export interface Content {
  id: string; // 飞书record_id
  title: string; // 标题
  guest: string; // 嘉宾姓名
  source: 'xiaoyuzhou' | 'bilibili' | 'youtube'; // 来源平台
  coverImage: {
    url: string; // 飞书临时下载URL
    file_token: string; // 飞书文件token
  };
  tags: string[]; // 标签数组
  quotes: string[]; // 金句数组 (3-5条)
  content: string; // Markdown正文
  originalLink: string; // 原内容链接
  status: 'draft' | 'published'; // 状态
  publishedAt: Date; // 发布时间
  // 以下字段从SQLite获取
  viewCount?: number; // 浏览量
  clickCount?: number; // 点击量
}

export interface VideoEmbedMeta {
  provider: 'youtube' | 'bilibili';
  embedUrl: string;
}

export interface Analytics {
  record_id: string;
  view_count: number;
  click_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface TagInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export interface GuestInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export interface DateGroup {
  dateLabel: string; // "今天 (10月31日)"
  contents: Content[];
}

// ============================================================================
// 支付系统类型定义 (V1.3.0)
// ============================================================================

/**
 * 会员等级
 */
export type MembershipTier = 'free' | 'monthly' | 'yearly' | 'lifetime';

/**
 * 支付方式
 *
 * V1.4.1 重要说明：
 * - 'alipay' 已停用（商户未开通支付宝渠道）
 * - 新订单仅支持 'wxpay' (微信支付)
 * - 保留 'alipay' 类型定义仅用于历史数据兼容（数据库查询、回调处理）
 */
export type PaymentMethod = 'alipay' | 'wxpay';

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'refunded';

/**
 * 订单记录
 */
export interface Order {
  id: string; // UUID
  orderId: string; // 商户订单号 (JZ_YYYYMMDD_...)
  tradeNo?: string; // Z-Pay 交易号
  userId: string; // 用户 ID
  userEmail: string; // 用户邮箱
  productType: Exclude<MembershipTier, 'free'>; // 商品类型
  productName: string; // 商品名称
  amount: number; // 订单金额
  paymentMethod: PaymentMethod; // 支付方式
  status: OrderStatus; // 订单状态
  membershipDurationDays?: number; // 会员时长 (天)
  membershipStartDate?: Date; // 会员起始日期
  membershipEndDate?: Date; // 会员结束日期
  callbackReceivedAt?: Date; // 回调接收时间
  callbackData?: Record<string, any>; // 回调原始数据
  note?: string; // 备注
  clientIp?: string; // 客户端 IP
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

/**
 * 用户会员信息
 */
export interface UserMembership {
  userId: string;
  tier: MembershipTier;
  expiresAt: string | null; // ISO 8601 日期, null 表示永久
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 会员套餐配置
 */
export interface MembershipPlan {
  type: Exclude<MembershipTier, 'free'>;
  name: string;
  price: number;
  durationDays: number | null; // null 表示终身
  description: string;
  features: string[];
  recommended?: boolean;
  badge?: string;
}

/**
 * 会员状态
 */
export interface MembershipStatus {
  tier: MembershipTier;
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null; // null 表示永久
  planName: string;
  badge: string;
}

// ============================================================================
// 砍价系统类型定义 (V1.4.0)
// ============================================================================

/**
 * 砍价记录
 */
export interface BargainAttempt {
  id: string; // UUID
  user_id: string; // 用户 ID
  user_email: string | null; // 用户邮箱
  reason: string; // 砍价理由
  reason_length: number; // 理由字数
  ai_score: number; // AI评分 (0-100)
  ai_message: string; // AI点评
  discount_percent: number; // 折扣百分比 (0-99)
  original_price: number; // 原价
  final_price: number; // 最终价格
  coupon_code: string; // 优惠券码
  coupon_expires_at: string; // 优惠券过期时间 (ISO 8601)
  coupon_used: boolean; // 是否已使用
  coupon_used_at: string | null; // 使用时间 (ISO 8601)
  created_at: string; // 创建时间 (ISO 8601)
  client_ip: string | null; // 客户端 IP
  user_agent: string | null; // User Agent
}

/**
 * 砍价提交请求
 */
export interface BargainSubmitRequest {
  reason: string; // 砍价理由 (30-300字)
}

/**
 * 砍价提交响应
 */
export interface BargainSubmitResponse {
  success: boolean;
  result?: {
    score: number; // AI评分
    discount_percent: number; // 折扣百分比
    final_price: number; // 最终价格
    message: string; // AI点评
    coupon_code: string; // 优惠券码
    expires_at: string; // 过期时间
  };
  error?: string;
}

/**
 * 砍价状态查询响应
 */
export interface BargainStatusResponse {
  success: boolean;
  canBargain: boolean; // 是否可以砍价
  existingAttempt?: BargainAttempt; // 已有砍价记录
  error?: string;
}

/**
 * 优惠券验证结果
 */
export interface CouponValidationResult {
  valid: boolean;
  reason?: string; // 无效原因
  attempt?: BargainAttempt; // 优惠券关联的砍价记录
}

/**
 * AI 评估结果
 */
export interface AIEvaluationResult {
  score: number; // 0-100
  discount_percent: number; // 0-99
  final_price: number; // 0.01-9.90
  message: string; // AI点评 (60-120字)
}
