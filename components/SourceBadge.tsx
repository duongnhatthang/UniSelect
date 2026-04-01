'use client';

import { useTranslations } from 'next-intl';

interface SourceBadgeProps {
  sourceType: string | null | undefined;
}

export function SourceBadge({ sourceType }: SourceBadgeProps) {
  const t = useTranslations('common');

  if (sourceType === 'user_submitted') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        title={t('userSubmittedTooltip')}
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.399l-.282 0 .07-.346 2.132-.316zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
        </svg>
        {t('userSubmitted')}
      </span>
    );
  }

  // aggregator or scraper — verified
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    >
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
      </svg>
      {t('verified')}
    </span>
  );
}
