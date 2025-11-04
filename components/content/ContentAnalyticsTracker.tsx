'use client';

import { useEffect } from 'react';

interface Props {
  recordId: string;
}

/**
 * 负责记录内容浏览量的轻量组件。
 */
export default function ContentAnalyticsTracker({ recordId }: Props) {
  useEffect(() => {
    if (!recordId) {
      return;
    }

    const controller = new AbortController();

    fetch('/api/analytics/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
      signal: controller.signal,
    }).catch((error) => {
      console.error('Failed to record view analytics:', error);
    });

    return () => {
      controller.abort();
    };
  }, [recordId]);

  return null;
}
