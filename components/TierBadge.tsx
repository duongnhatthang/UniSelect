'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Tier } from '../lib/recommend/types';

const TIER_STYLES = {
  dream:     'text-blue-500 border-blue-500 bg-blue-50',
  practical: 'text-green-500 border-green-500 bg-green-50',
  safe:      'text-amber-500 border-amber-500 bg-amber-50',
} as const;

interface TierBadgeProps {
  tier: Tier;
  delta?: string;
}

export function TierBadge({ tier, delta }: TierBadgeProps) {
  const t = useTranslations('common');
  const [shown, setShown] = useState(false);

  return (
    <span className="relative group inline-block">
      <span
        className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-full cursor-default ${TIER_STYLES[tier]}`}
        onClick={() => delta && setShown(prev => !prev)}
        onBlur={() => setShown(false)}
        tabIndex={delta ? 0 : undefined}
        aria-label={delta ? `${t('tier' + (tier.charAt(0).toUpperCase() + tier.slice(1)) as 'tierDream' | 'tierPractical' | 'tierSafe')} — ${delta}` : undefined}
      >
        {t(tier)}
      </span>
      {delta && (
        <span
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none z-10 transition-opacity ${
            shown ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {delta}
        </span>
      )}
    </span>
  );
}
