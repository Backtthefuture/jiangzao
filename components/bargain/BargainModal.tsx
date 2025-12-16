/**
 * 砍价弹窗主组件
 *
 * V1.4.0 - AI智能砍价系统
 *
 * 功能:
 * - 多步骤流程（输入 → 加载 → 结果）
 * - 理由输入与验证
 * - AI评估结果展示
 * - 优惠券信息展示
 * - 跳转支付
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SlotMachineAnimation from './SlotMachineAnimation';
import type {
  BargainSubmitResponse,
  BargainStatusResponse,
} from '@/lib/types';

interface BargainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'input' | 'loading' | 'result' | 'error' | 'existing';

export default function BargainModal({ isOpen, onClose }: BargainModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('input');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // 最小/最大字数限制
  const MIN_LENGTH = 10;
  const MAX_LENGTH = 300;

  const reasonLength = reason.length;
  const isValid = reasonLength >= MIN_LENGTH && reasonLength <= MAX_LENGTH;

  // 打开弹窗时检查用户是否已砍价
  useEffect(() => {
    if (isOpen) {
      checkBargainStatus();
    }
  }, [isOpen]);

  const checkBargainStatus = async () => {
    try {
      const response = await fetch('/api/bargain/status');
      const data: BargainStatusResponse = await response.json();

      if (!data.success) {
        if (response.status === 401) {
          // 未登录，跳转登录页
          onClose();
          router.push('/auth/login?redirect=/pricing');
          return;
        }
        setError(data.error || '查询失败');
        setStep('error');
        return;
      }

      if (!data.canBargain && data.existingAttempt) {
        // 用户已砍价，显示已有结果
        setResult({
          score: data.existingAttempt.ai_score,
          discount_percent: data.existingAttempt.discount_percent,
          final_price: data.existingAttempt.final_price,
          message: data.existingAttempt.ai_message,
          coupon_code: data.existingAttempt.coupon_code,
          expires_at: data.existingAttempt.coupon_expires_at,
        });
        setStep('existing');
      } else {
        // 可以砍价，显示输入页
        setStep('input');
      }
    } catch (err) {
      console.error('检查砍价状态失败:', err);
      setError('网络错误，请稍后重试');
      setStep('error');
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;

    setStep('loading');
    setError(null);

    try {
      const response = await fetch('/api/bargain/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data: BargainSubmitResponse = await response.json();

      if (!data.success) {
        if (response.status === 429) {
          setError('请求过于频繁，请稍后再试');
        } else {
          setError(data.error || '提交失败');
        }
        setStep('error');
        return;
      }

      // 成功，显示结果
      setResult(data.result);

      // 延迟2.5秒后显示结果（配合加载动画）
      setTimeout(() => {
        setStep('result');
      }, 2500);
    } catch (err) {
      console.error('提交砍价失败:', err);
      setError('网络错误，请稍后重试');
      setStep('error');
    }
  };

  const handlePayment = () => {
    // 跳转到支付页面（携带优惠券码）
    if (!result) return;

    // 关闭弹窗
    onClose();

    // 调用支付 API
    createOrder(result.coupon_code);
  };

  const createOrder = async (couponCode: string) => {
    try {
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productType: 'monthly',
          paymentMethod: 'wxpay', // V1.4.1: 改用微信支付
          couponCode,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        // 跳转到支付页面
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error || '创建订单失败');
      }
    } catch (err) {
      console.error('创建订单失败:', err);
      alert('网络错误，请稍后重试');
    }
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    setResult(null);
    setStep('input');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>

      {/* 弹窗内容 */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 标题 */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              🎲 摇一摇神秘优惠
            </h2>
            <p className="text-gray-600">
              {step === 'input' && '告诉我们你的故事，AI 将根据你的真诚度给出专属折扣 ✨'}
              {step === 'loading' && 'AI 正在分析你的理由...'}
              {step === 'result' && '恭喜你获得专属优惠！'}
              {step === 'existing' && '你已经砍价过了！'}
              {step === 'error' && '出现错误'}
            </p>
          </div>

          {/* 输入页 */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  说说你为什么想要这个优惠？（{MIN_LENGTH}-{MAX_LENGTH}字）
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={MAX_LENGTH}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder={`例如：\n• 作为一名AI从业者，每天都在关注行业动态...\n• 我是在校学生，预算有限但对AI学习充满热情...\n• 最近刚失业，但想通过学习AI转型...`}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-sm ${reasonLength < MIN_LENGTH ? 'text-red-500' : reasonLength >= MAX_LENGTH ? 'text-yellow-500' : 'text-gray-500'}`}>
                    已输入 {reasonLength} 字 / 最少 {MIN_LENGTH} 字
                  </span>
                  {reasonLength >= MIN_LENGTH && (
                    <span className="text-sm text-green-600">✓ 字数符合要求</span>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 提示：真诚的故事更容易获得高折扣哦！请尽可能详细地描述你的情况和需求。
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                  isValid
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isValid ? '提交' : `还需要 ${MIN_LENGTH - reasonLength} 字`}
              </button>
            </div>
          )}

          {/* 加载页 */}
          {step === 'loading' && (
            <div>
              <SlotMachineAnimation duration={2500} />
            </div>
          )}

          {/* 结果页 */}
          {(step === 'result' || step === 'existing') && result && (
            <div className="space-y-6">
              {/* 折扣展示 */}
              <div className="text-center">
                <div className="inline-block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white px-8 py-4 rounded-2xl shadow-lg transform -rotate-2">
                  <div className="text-5xl font-bold">
                    {result.discount_percent}% OFF!
                  </div>
                </div>
              </div>

              {/* AI 点评 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">💬 AI 点评</p>
                <p className="text-gray-800">{result.message}</p>
              </div>

              {/* 价格对比 */}
              <div className="bg-white border-2 border-primary rounded-lg p-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">原价</span>
                  <span className="text-gray-400 line-through">¥9.9</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">优惠</span>
                  <span className="text-green-600 font-medium">
                    -¥{(9.9 - result.final_price).toFixed(2)} ({result.discount_percent}%)
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-900">实付</span>
                    <span className="text-3xl font-bold text-primary">
                      ¥{result.final_price}
                    </span>
                  </div>
                </div>
              </div>

              {/* 优惠券信息 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-2">
                  🎫 优惠券：<code className="bg-yellow-100 px-2 py-1 rounded">{result.coupon_code}</code>
                </p>
                <p className="text-sm text-yellow-700">
                  ⏰ 有效期：{new Date(result.expires_at).toLocaleString('zh-CN')} 前有效
                </p>
              </div>

              {/* 支付按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={handlePayment}
                  className="flex-1 py-3 px-6 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  💰 ¥{result.final_price} 立即支付
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  稍后
                </button>
              </div>

              {step === 'existing' && (
                <p className="text-sm text-gray-500 text-center">
                  你已经砍价过了，每个用户只能砍价一次哦
                </p>
              )}
            </div>
          )}

          {/* 错误页 */}
          {step === 'error' && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">出现错误</h3>
              <p className="text-gray-600">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setStep('input')}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
