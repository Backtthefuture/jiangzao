'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface GuestInfo {
  name: string;
  slug: string;
  contentCount: number;
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<GuestInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuests();
  }, []);

  const loadGuests = async () => {
    try {
      const response = await fetch('/api/guests');
      const data = await response.json();
      setGuests(data.data || []);
    } catch (error) {
      console.error('Failed to load guests:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">全部嘉宾</h1>

      <div className="space-y-2">
        {guests.map((guest) => (
          <Link
            key={guest.name}
            href={`/guests/${guest.slug}`}
            className="block p-4 bg-white border rounded-lg hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {guest.name}
              </h2>
              <p className="text-sm text-gray-500">{guest.contentCount} 次访谈</p>
            </div>
          </Link>
        ))}
      </div>

      {guests.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">暂无嘉宾</p>
        </div>
      )}
    </div>
  );
}
