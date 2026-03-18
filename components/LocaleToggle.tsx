'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

export function LocaleToggle() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common');
  const toggle = () => {
    const next = locale === 'vi' ? 'en' : 'vi';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    router.refresh();
  };
  return (
    <button
      onClick={toggle}
      className="px-3 py-1 text-sm border rounded-md hover:bg-gray-100"
      aria-label="Toggle language"
    >
      {t('language')}
    </button>
  );
}
