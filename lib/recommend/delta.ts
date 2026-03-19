/**
 * Compute the delta between a student's score and a cutoff.
 *
 * Formula: userScore - cutoff
 *   Positive = student is above cutoff (favorable)
 *   Negative = student is below cutoff (unfavorable)
 *
 * Returns a formatted string with sign prefix and 1 decimal place.
 * Examples: '+1.0', '-1.0', '+0.0'
 */
export function computeDelta(userScore: number, cutoff: number): string {
  const diff = userScore - cutoff;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}
