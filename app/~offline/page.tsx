import { getTranslations } from 'next-intl/server';

export default async function OfflinePage() {
  const t = await getTranslations('common');
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('offlinePage.title')}</h1>
      <p className="text-gray-600">{t('offlinePage.message')}</p>
    </main>
  );
}
