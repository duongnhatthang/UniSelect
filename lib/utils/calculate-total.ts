export function calculateTotal(
  subjectScores: Record<string, number>,
  subjects: string[]
): number | null {
  if (subjects.length === 0) return 0;
  const scores = subjects.map(s => subjectScores[s]);
  if (scores.some(s => s === undefined || s === null)) return null;
  return scores.reduce((sum, s) => sum + s, 0);
}
