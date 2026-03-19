import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function NotFound() {
  const t = useTranslations('NotFoundPage');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-surface">
      <p className="text-6xl font-bold text-on-surface-muted">404</p>
      <h1 className="text-xl font-bold text-on-surface">{t('title')}</h1>
      <p className="text-sm text-on-surface-muted text-center">{t('description')}</p>
      <Link href="/" className="text-primary underline">
        {t('backHome')}
      </Link>
    </main>
  );
}
