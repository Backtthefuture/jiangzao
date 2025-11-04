'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MembershipBadge from '@/components/membership/MembershipBadge';
import { createClient } from '@/lib/supabase/client'; // V1.4.2: 新增导入

interface User {
  id: string;
  email: string;
}

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // V1.4.2: 创建 Supabase 客户端
    const supabase = createClient();

    // 1. 初始检查用户状态（保持向后兼容）
    checkUser();

    // 2. V1.4.2 新增: 订阅认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[UserMenu] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session) {
        // 用户登录成功 → 立即更新 UI
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        // 用户登出 → 立即清除 UI
        setUser(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token 刷新 → 确保用户状态正确
        setUser({
          id: session.user.id,
          email: session.user.email || '',
        });
      }
    });

    // 3. V1.4.2 新增: 组件卸载时取消订阅（防止内存泄漏）
    return () => {
      subscription?.unsubscribe();
    };
  }, []); // 依赖数组保持为空，监听器会持续工作

  const checkUser = async () => {
    try {
      const response = await fetch('/api/auth/user');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to check user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // V1.4.2: 改用客户端 Supabase SDK 登出
      // 这样会触发 onAuthStateChange 的 SIGNED_OUT 事件,UI 会立即更新
      const supabase = createClient();

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout failed:', error);
        return;
      }

      // Logout successful - Supabase will automatically trigger SIGNED_OUT event
      console.log('[UserMenu] Logout successful, redirecting...');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
    );
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link
          href="/auth/login"
          className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
        >
          登录
        </Link>
        <Link
          href="/auth/signup"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {user.email[0].toUpperCase()}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-gray-700">{user.email}</span>
          <MembershipBadge mode="compact" />
        </div>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20">
            <div className="px-4 py-3 border-b">
              <div className="text-sm text-gray-500 mb-1">{user.email}</div>
              <MembershipBadge mode="full" />
            </div>
            <Link
              href="/user/membership"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(false)}
            >
              会员中心
            </Link>
            <Link
              href="/user/reading-history"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(false)}
            >
              阅读历史
            </Link>
            <Link
              href="/pricing"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(false)}
            >
              升级会员
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t"
            >
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}
