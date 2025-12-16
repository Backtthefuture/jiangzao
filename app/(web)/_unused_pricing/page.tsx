'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MEMBERSHIP_PLANS } from '@/lib/membership';
import BargainModal from '@/components/bargain/BargainModal'; // V1.4.0: 砍价功能
import type { PaymentMethod } from '@/lib/types';

/**
 * 定价页
 *
 * 展示 3 种会员套餐：月会员、年会员、终身会员
 */
export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bargainModalOpen, setBargainModalOpen] = useState(false); // V1.4.0: 砍价弹窗状态

  const handlePurchase = async (
    productType: 'monthly' | 'yearly' | 'lifetime',
    paymentMethod: PaymentMethod
  ) => {
    try {
      setLoading(productType);
      setError(null);

      // 调用创建订单 API
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productType,
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        if (response.status === 401) {
          // 未登录，跳转到登录页
          router.push(`/auth/login?redirect=/pricing`);
          return;
        }
        throw new Error(data.error || '创建订单失败');
      }

      // 跳转到支付页面
      window.location.href = data.paymentUrl;
    } catch (err) {
      console.error('[PRICING] 创建订单失败', err);
      setError(err instanceof Error ? err.message : '创建订单失败，请稍后重试');
      setLoading(null);
    }
  };

  const plans = Object.values(MEMBERSHIP_PLANS);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            选择适合你的会员套餐
          </h1>
          <p className="text-xl text-gray-600">
            体验无限阅读，深度学习 AI 行业的每一篇精选访谈
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-center">{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isRecommended = plan.recommended;
            const isLoading = loading === plan.type;

            return (
              <div
                key={plan.type}
                className={`relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                  isRecommended ? 'ring-2 ring-primary scale-105' : ''
                }`}
              >
                {/* Recommended Badge */}
                {isRecommended && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                      推荐
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Name */}
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-bold text-gray-900">
                        ¥{plan.price}
                      </span>
                      {plan.durationDays && (
                        <span className="text-gray-600 ml-2">
                          /{plan.durationDays === 30 ? '月' : '年'}
                        </span>
                      )}
                    </div>
                    {plan.type === 'yearly' && (
                      <p className="text-sm text-green-600 mt-2">
                        相当于每月 ¥8.25，节省 ¥19.8
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg
                          className="h-6 w-6 text-green-500 flex-shrink-0"
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
                        <span className="ml-3 text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* V1.4.0: 砍价入口（仅月会员） */}
                  {plan.type === 'monthly' && (
                    <div className="mb-4">
                      <button
                        onClick={() => setBargainModalOpen(true)}
                        className="w-full py-3 px-6 rounded-lg font-medium border-2 border-dashed border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 hover:from-yellow-100 hover:to-orange-100 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="text-xl">🎲</span>
                        <span>摇一摇神秘优惠</span>
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full ml-1">
                          最低¥0.01
                        </span>
                      </button>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        每人仅可摇一次，折扣最高可达99%
                      </p>
                    </div>
                  )}

                  {/* Payment Button - V1.4.1: 仅微信支付 */}
                  <button
                    onClick={() => handlePurchase(plan.type as 'monthly' | 'yearly' | 'lifetime', 'wxpay')}
                    disabled={isLoading}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                      isRecommended
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        处理中...
                      </span>
                    ) : (
                      '立即购买 - 微信支付'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            常见问题
          </h2>
          <div className="space-y-4">
            <details className="bg-white rounded-lg shadow p-6">
              <summary className="font-medium text-gray-900 cursor-pointer">
                购买会员后多久生效？
              </summary>
              <p className="mt-2 text-gray-600">
                支付成功后会员立即生效，您可以立刻享受无限阅读权益。
              </p>
            </details>

            <details className="bg-white rounded-lg shadow p-6">
              <summary className="font-medium text-gray-900 cursor-pointer">
                会员到期后会自动续费吗？
              </summary>
              <p className="mt-2 text-gray-600">
                不会自动续费，您需要手动购买。我们会在到期前提醒您。
              </p>
            </details>

            <details className="bg-white rounded-lg shadow p-6">
              <summary className="font-medium text-gray-900 cursor-pointer">
                可以退款吗？
              </summary>
              <p className="mt-2 text-gray-600">
                支持 7 天无理由退款，请联系客服处理。
              </p>
            </details>

            <details className="bg-white rounded-lg shadow p-6">
              <summary className="font-medium text-gray-900 cursor-pointer">
                终身会员包含未来新功能吗？
              </summary>
              <p className="mt-2 text-gray-600">
                是的，终身会员可以优先体验所有未来新功能。
              </p>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-600">
          <p>如有问题，请联系客服</p>
        </div>
      </main>

      {/* V1.4.0: 砍价弹窗 */}
      <BargainModal
        isOpen={bargainModalOpen}
        onClose={() => setBargainModalOpen(false)}
      />
    </div>
  );
}
