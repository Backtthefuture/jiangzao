'use client';

import Link from 'next/link';

interface Props {
  isAuthenticated: boolean;
  viewCount: number;
  maxViews: number;
  resetDate?: string | null;
  daysUntilReset?: number;
}

/**
 * V1.2.1 - 付费墙遮罩组件
 * 当用户超出阅读限制时显示
 */
export default function PaywallOverlay({
  isAuthenticated,
  viewCount,
  maxViews,
  resetDate,
  daysUntilReset,
}: Props) {
  const days = daysUntilReset ?? 0;

  // 未登录用户
  if (!isAuthenticated) {
    return (
      <div className="relative">
        {/* 模糊遮罩背景 */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* 居中卡片 */}
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4 border-2 border-gray-200">
              <div className="text-center">
                {/* 图标 */}
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                  <svg
                    className="h-10 w-10 text-yellow-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>

                {/* 标题 */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  免费阅读额度已用完
                </h3>

                {/* 说明 */}
                <p className="text-gray-600 mb-2">
                  您已阅读 <span className="font-semibold text-gray-900">{viewCount}</span> 篇完整文章（免费上限）
                </p>
                <p className="text-gray-600 mb-6">
                  登录后可继续阅读 <span className="font-semibold text-green-600">10 篇/月</span>
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  💡 登录后可在 <Link href="/user/reading-history" className="underline">阅读历史</Link> 查看本月足迹
                </p>

                {/* 操作按钮 */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
                  >
                    立即登录
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="inline-flex items-center justify-center px-6 py-3 border-2 border-primary text-base font-medium rounded-md text-primary bg-white hover:bg-gray-50 transition-colors"
                  >
                    免费注册
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 登录用户超限
  return (
    <div className="relative">
      {/* 模糊遮罩背景 */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white"
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {/* 居中卡片 */}
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md mx-4 border-2 border-gray-200">
            <div className="text-center">
              {/* 图标 */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                <svg
                  className="h-10 w-10 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>

              {/* 标题 */}
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                本月阅读额度已用完
              </h3>

              {/* 说明 */}
              <p className="text-gray-600 mb-2">
                您已阅读 <span className="font-semibold text-gray-900">{viewCount}</span> 篇完整文章（上限 {maxViews} 篇/月）
              </p>
              <p className="text-gray-600 mb-2">
                下月 <span className="font-semibold">1 日</span> 重置额度
              </p>
              {days > 0 && (
                <p className="text-sm text-gray-500 mb-6">
                  距离重置还有 <span className="font-semibold text-blue-600">{days}</span> 天
                </p>
              )}

              {/* 操作按钮 */}
              <div className="flex flex-col gap-3 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 transition-colors"
                >
                  返回首页
                </Link>

                {/* 提示信息 */}
                <p className="text-sm text-gray-500 mt-2">
                  💡 小贴士: 可在 <Link href="/user/reading-history" className="underline">阅读历史</Link> 回顾本月阅读
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
