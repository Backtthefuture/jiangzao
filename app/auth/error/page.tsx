import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '认证错误 - 降噪',
  description: '认证过程中出现错误',
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  const errorMessage = searchParams.message || '认证过程中出现错误';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            认证失败
          </h2>
          <p className="text-gray-600 mb-6">
            {decodeURIComponent(errorMessage)}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              返回登录
            </Link>
            <Link
              href="/"
              className="inline-block bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
