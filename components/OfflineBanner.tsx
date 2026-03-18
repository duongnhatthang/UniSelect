'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function OfflineBanner() {
  const t = useTranslations('common');
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  if (!isOffline) return null;
  return (
    <div className="bg-amber-100 text-amber-800 text-sm px-4 py-2 text-center">
      {t('offline')}
    </div>
  );
}
