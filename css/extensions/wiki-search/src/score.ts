/**
 * Density-based score formula (Refinement 2 v1 baseline).
 *
 * Under AND-semantics, uniqueTermsMatched == totalTerms is invariant, so
 * the original §4 formula degenerated. Density distinguishes "page name-
 * drops a term once" from "page genuinely about a term"; log dampening
 * stops a 10-KB body with 50 matches from monopolising the rank.
 *
 * RQ-Search-1 open: tune against Rung 1.5 eval evidence.
 */
export function computeScore(matchCount: number, bodyLength: number): number {
  if (matchCount === 0) return 0;
  const safeLen = Math.max(1, bodyLength);
  const matchesPerKB = (matchCount / safeLen) * 1000;
  const densityComponent = 20 * Math.log2(1 + matchesPerKB);
  const countComponent = 10 * Math.min(matchCount, 10);
  return Math.min(100, Math.round(densityComponent + countComponent));
}
