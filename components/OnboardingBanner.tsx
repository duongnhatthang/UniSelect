'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

export function OnboardingBanner() {
  const t = useTranslations('OnboardingBanner');
  const [dismissed, setDismissed] = useState(true); // default hidden on SSR
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem('onboarding-dismissed') === '1');
  }, []);

  if (!mounted || dismissed) {
    return null;
  }

  function handleDismiss() {
    localStorage.setItem('onboarding-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
      {/* Info icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 text-primary flex-shrink-0 mt-0.5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>

      {/* Message */}
      <p className="text-sm text-on-surface flex-1">{t('message')}</p>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="text-sm font-medium text-primary hover:underline whitespace-nowrap flex-shrink-0"
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
