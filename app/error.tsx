'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function ErrorPage({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('ErrorPage');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-surface">
      <h1 className="text-xl font-bold text-on-surface">{t('title')}</h1>
      <p className="text-on-surface-muted text-sm text-center">{t('description')}</p>
      <div className="flex gap-3 items-center">
        <button
          onClick={reset}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
        >
          {t('retry')}
        </button>
        <Link href="/" className="text-primary underline text-sm">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
