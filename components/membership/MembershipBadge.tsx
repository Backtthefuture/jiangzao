'use client';

import { useEffect, useState } from 'react';
import type { MembershipStatus } from '@/lib/types';

interface MembershipBadgeProps {
  /**
   * 显示模式
   * - 'compact': 只显示会员图标/徽章
   * - 'full': 显示完整会员信息（徽章 + 到期时间）
   */
  mode?: 'compact' | 'full';

  /**
   * 自定义类名
   */
  className?: string;
}

/**
 * 会员标识组件
 *
 * 根据用户的会员状态显示不同的徽章样式：
 * - 月会员：蓝色徽章
 * - 年会员：紫色徽章
 * - 终身会员：金色渐变徽章
 * - 非会员：不显示
 */
export default function MembershipBadge({ mode = 'compact', className = '' }: MembershipBadgeProps) {
  const [membership, setMembership] = useState<MembershipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembership = async () => {
      try {
        const response = await fetch('/api/user/membership');
        const data = await response.json();

        if (data.success) {
          setMembership(data.membership);
        } else {
          // 未登录或其他错误，不显示徽章
          setMembership(null);
        }
      } catch (err) {
        console.error('[MembershipBadge] 获取会员信息失败', err);
        setError('获取会员信息失败');
        setMembership(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMembership();
  }, []);

  // 加载中或错误时不显示
  if (loading || error || !membership) {
    return null;
  }

  // 非活跃会员不显示
  if (!membership.isActive) {
    return null;
  }

  // 根据会员等级获取样式
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

  // Compact 模式：只显示徽章
  if (mode === 'compact') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeStyle()} ${className}`}
        title={`${membership.planName}${membership.expiresAt ? ` - 剩余${membership.daysRemaining}天` : ''}`}
      >
        {membership.badge}
      </span>
    );
  }

  // Full 模式：显示徽章 + 到期时间
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeStyle()}`}
      >
        {membership.badge}
      </span>
      {membership.expiresAt && membership.daysRemaining !== null && (
        <span className="text-xs text-gray-600">
          剩余 {membership.daysRemaining} 天
        </span>
      )}
      {membership.tier === 'lifetime' && (
        <span className="text-xs text-gray-600">永久有效</span>
      )}
    </div>
  );
}
