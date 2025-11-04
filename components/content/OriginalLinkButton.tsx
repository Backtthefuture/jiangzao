'use client';

import { useState } from 'react';

interface Props {
  recordId: string;
  originalLink: string;
  className?: string;
}

export default function OriginalLinkButton({
  recordId,
  originalLink,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!originalLink) {
      return;
    }

    try {
      setLoading(true);
      await fetch('/api/analytics/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId }),
      });
    } catch (error) {
      console.error('Failed to record click analytics:', error);
    } finally {
      setLoading(false);
      window.open(originalLink, '_blank', 'noopener');
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!originalLink || loading}
      className={className}
    >
      {loading ? '处理中...' : '🎧 查看完整访谈'}
    </button>
  );
}
