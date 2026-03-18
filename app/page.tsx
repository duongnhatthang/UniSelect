import { getTranslations } from 'next-intl/server';
import { ScoreForm } from '../components/ScoreForm';
import { LocaleToggle } from '../components/LocaleToggle';
import { UniversitySearch } from '../components/UniversitySearch';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">{t('appName')}</h1>
          <LocaleToggle />
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto py-6">
        <ScoreForm />
      </div>

      {/* University Search */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          {t('search')} {t('university')}
        </h2>
        <UniversitySearch />
      </div>
    </main>
  );
}
