/** Calcule les points selon le score réel (ou actuel en cours de match). */
export function computePoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 3;
  const predDiff = predHome - predAway;
  const realDiff = realHome - realAway;
  if (predDiff === realDiff) return 2;
  const predWinner =
    predHome > predAway ? "HOME" : predHome < predAway ? "AWAY" : "DRAW";
  const realWinner =
    realHome > realAway ? "HOME" : realHome < realAway ? "AWAY" : "DRAW";
  if (predWinner === realWinner) return 1;
  return 0;
}
