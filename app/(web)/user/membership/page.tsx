'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MembershipStatus, Order } from '@/lib/types';

/**
 * 会员中心页
 *
 * 展示当前会员状态、订单历史和续费/升级选项
 */
export default function MembershipPage() {
  const router = useRouter();
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembershipData();
  }, []);

  const fetchMembershipData = async () => {
    try {
      setLoading(true);

      // 1. 获取会员状态
      const membershipResponse = await fetch('/api/user/membership');
      const membershipData = await membershipResponse.json();

      if (!membershipData.success) {
        if (membershipResponse.status === 401) {
          router.push('/auth/login?redirect=/user/membership');
          return;
        }
        throw new Error(membershipData.error || '获取会员信息失败');
      }

      setMembership(membershipData.membership);

      // 2. 获取订单历史 (TODO: 需要创建订单历史API)
      // const ordersResponse = await fetch('/api/user/orders');
      // const ordersData = await ordersResponse.json();
      // if (ordersData.success) {
      //   setOrders(ordersData.orders);
      // }
    } catch (err) {
      console.error('[MEMBERSHIP] 获取会员信息失败', err);
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 错误
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">加载失败</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchMembershipData}
              className="w-full py-3 px-6 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!membership) {
    return null;
  }

  // 根据会员等级获取徽章样式
  const getBadgeStyle = () => {
    switch (membership.tier) {
      case 'monthly':
        return 'bg-blue-500 text-white';
      case 'yearly':
        return 'bg-purple-600 text-white';
      case 'lifetime':
        return 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">会员中心</h1>

        {/* Membership Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                当前会员状态
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getBadgeStyle()}`}
                >
                  {membership.badge}
                </span>
                <span className="text-lg font-medium text-gray-900">
                  {membership.planName}
                </span>
              </div>
            </div>
            {membership.isActive && membership.tier !== 'lifetime' && (
              <Link
                href="/pricing"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                续费/升级
              </Link>
            )}
            {!membership.isActive && (
              <Link
                href="/pricing"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                开通会员
              </Link>
            )}
          </div>

          {/* Membership Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t">
            <div>
              <p className="text-sm text-gray-600 mb-1">状态</p>
              <p className="text-lg font-medium text-gray-900">
                {membership.isActive ? (
                  <span className="text-green-600">已激活</span>
                ) : (
                  <span className="text-gray-500">未开通</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">到期时间</p>
              <p className="text-lg font-medium text-gray-900">
                {membership.tier === 'lifetime'
                  ? '永久有效'
                  : membership.expiresAt
                  ? new Date(membership.expiresAt).toLocaleDateString('zh-CN')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">剩余天数</p>
              <p className="text-lg font-medium text-gray-900">
                {membership.tier === 'lifetime'
                  ? '∞'
                  : membership.daysRemaining !== null
                  ? `${membership.daysRemaining} 天`
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Membership Benefits */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">会员权益</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="ml-3">
                <h3 className="font-medium text-gray-900">无限阅读</h3>
                <p className="text-sm text-gray-600">
                  不受月度阅读限制，随时随地畅读所有内容
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="ml-3">
                <h3 className="font-medium text-gray-900">阅读统计</h3>
                <p className="text-sm text-gray-600">
                  完整的阅读记录和统计数据
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="ml-3">
                <h3 className="font-medium text-gray-900">会员标识</h3>
                <p className="text-sm text-gray-600">
                  专属会员徽章，彰显身份
                </p>
              </div>
            </div>
            {membership.tier === 'lifetime' && (
              <div className="flex items-start">
                <svg
                  className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <div className="ml-3">
                  <h3 className="font-medium text-gray-900">未来新功能</h3>
                  <p className="text-sm text-gray-600">
                    优先体验平台所有未来新功能
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order History (Placeholder) */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">订单历史</h2>
          {orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {order.productName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        订单号: {order.orderId}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        order.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'paid'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {order.status === 'completed'
                        ? '已完成'
                        : order.status === 'paid'
                        ? '已支付'
                        : order.status === 'pending'
                        ? '待支付'
                        : order.status === 'failed'
                        ? '已失败'
                        : '已退款'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {new Date(order.createdAt).toLocaleString('zh-CN')}
                    </span>
                    <span className="font-medium text-gray-900">
                      ¥{order.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-gray-600">暂无订单记录</p>
              <Link
                href="/pricing"
                className="mt-4 inline-block text-primary hover:text-primary/80 underline"
              >
                前往定价页购买会员
              </Link>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-medium text-gray-900 mb-2">需要帮助？</h3>
          <p className="text-sm text-gray-600 mb-4">
            如有关于会员的任何问题，欢迎联系客服
          </p>
          <div className="flex gap-4">
            <Link
              href="/pricing"
              className="text-sm text-primary hover:text-primary/80 underline"
            >
              查看定价详情
            </Link>
            <Link
              href="/"
              className="text-sm text-primary hover:text-primary/80 underline"
            >
              返回首页
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
