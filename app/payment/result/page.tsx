'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface OrderInfo {
  orderId: string;
  status: string;
  productName: string;
  productType: string;
  amount: number;
  createdAt: string;
  paidAt?: string;
}

/**
 * 支付结果页
 *
 * 轮询订单状态，展示支付结果
 */
export default function PaymentResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!orderId) {
      setError('订单号缺失');
      setLoading(false);
      return;
    }

    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const checkOrderStatus = async () => {
      try {
        const response = await fetch(`/api/payment/check-status/${orderId}`);
        const data = await response.json();

        if (!data.success) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error(data.error || '查询订单失败');
        }

        setOrder(data.order);
        setPollCount((prev) => prev + 1);

        // 如果订单已支付或失败，停止轮询
        if (data.order.status === 'paid' || data.order.status === 'completed' || data.order.status === 'failed') {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          setLoading(false);
        }
      } catch (err) {
        console.error('[PAYMENT_RESULT] 查询订单失败', err);
        setError(err instanceof Error ? err.message : '查询订单失败');
        setLoading(false);
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      }
    };

    // 立即查询一次
    checkOrderStatus();

    // 每 2 秒轮询一次
    intervalId = setInterval(checkOrderStatus, 2000);

    // 最多轮询 60 秒（30 次）
    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      if (order?.status === 'pending') {
        setError('支付超时，请检查支付状态或重新支付');
      }
      setLoading(false);
    }, 60000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [orderId, router]);

  // 加载中
  if (loading && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">正在查询订单状态...</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">查询失败</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-4">
              <Link
                href="/pricing"
                className="flex-1 py-3 px-6 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-center"
              >
                返回定价页
              </Link>
              <Link
                href="/"
                className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 支付成功
  if (order && (order.status === 'paid' || order.status === 'completed')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
              <svg
                className="h-12 w-12 text-green-600"
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
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">支付成功！</h1>
            <p className="text-gray-600 mb-8">
              恭喜你成为降噪平台会员，现在可以无限阅读所有内容了！
            </p>

            {/* Order Info */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">订单信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">订单号:</span>
                  <span className="font-mono text-gray-900">{order.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">套餐:</span>
                  <span className="text-gray-900">{order.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">金额:</span>
                  <span className="text-gray-900">¥{order.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">支付时间:</span>
                  <span className="text-gray-900">
                    {order.paidAt
                      ? new Date(order.paidAt).toLocaleString('zh-CN')
                      : new Date(order.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/"
                className="flex-1 py-3 px-6 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-center font-medium"
              >
                开始阅读
              </Link>
              <Link
                href="/user/membership"
                className="flex-1 py-3 px-6 border-2 border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors text-center font-medium"
              >
                查看会员中心
              </Link>
            </div>

            {/* Tips */}
            <div className="mt-8 text-sm text-gray-500">
              <p>💡 小贴士:</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• 会员权益已立即生效，可无限阅读所有内容</li>
                <li>• 在会员中心可查看订单历史和会员状态</li>
                <li>• 如有问题请联系客服</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 支付失败
  if (order && order.status === 'failed') {
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">支付失败</h2>
            <p className="text-gray-600 mb-2">很抱歉，你的支付未成功</p>
            <p className="text-sm text-gray-500 mb-6">订单号: {order.orderId}</p>

            <div className="flex flex-col gap-4">
              <Link
                href="/pricing"
                className="w-full py-3 px-6 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-center"
              >
                重新支付
              </Link>
              <Link
                href="/"
                className="w-full py-3 px-6 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                返回首页
              </Link>
            </div>

            <div className="mt-6 text-sm text-gray-500 text-left">
              <p className="font-medium mb-2">💡 需要帮助?</p>
              <ul className="space-y-1">
                <li>• 检查支付宝/微信账户余额是否充足</li>
                <li>• 确认网络连接正常</li>
                <li>• 如仍有问题请联系客服</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 等待支付
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">等待支付...</h2>
          <p className="text-gray-600 mb-6">
            请在支付页面完成支付，支付成功后将自动跳转
          </p>

          {order && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">订单号:</span>
                <span className="font-mono text-gray-900">{order.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">金额:</span>
                <span className="text-gray-900">¥{order.amount}</span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            已轮询 {pollCount} 次，最多等待 60 秒
          </p>

          <Link
            href="/"
            className="mt-6 inline-block text-gray-600 hover:text-gray-900 underline"
          >
            取消并返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
