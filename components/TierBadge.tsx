import type { Tier } from '../lib/recommend/types';

const TIER_STYLES = {
  dream:     'text-blue-500 border-blue-500 bg-blue-50',
  practical: 'text-green-500 border-green-500 bg-green-50',
  safe:      'text-amber-500 border-amber-500 bg-amber-50',
} as const;

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-full ${TIER_STYLES[tier]}`}>
      {tier}
    </span>
  );
}
