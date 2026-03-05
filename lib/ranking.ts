import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getDisplayName } from "./user";
import { getOngoingMatches } from "./matches";
import type { RankingEntry, User } from "./types";

/** Calcule les points selon le score réel (ou actuel en cours de match) */
function computePoints(
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

export async function getRanking(): Promise<RankingEntry[]> {
  const [predictionsSnap, ongoingMatches] = await Promise.all([
    getDocs(collection(db, "predictions")),
    getOngoingMatches(),
  ]);

  const pointsByUser: Record<
    string,
    { totalPoints: number; exactScores: number }
  > = {};
  const predictionsByMatch = new Map<string, { userId: string; homeScore: number; awayScore: number }[]>();

  for (const predDoc of predictionsSnap.docs) {
    const data = predDoc.data();
    const userId = data.userId;
    if (!userId) continue;
    if (!pointsByUser[userId]) {
      pointsByUser[userId] = { totalPoints: 0, exactScores: 0 };
    }
    const pts = data.points ?? 0;
    pointsByUser[userId].totalPoints += pts;
    if (pts === 3) pointsByUser[userId].exactScores += 1;

    const predHome = Number(data.homeScore ?? 0);
    const predAway = Number(data.awayScore ?? 0);
    const matchId = data.matchId;
    if (matchId && ongoingMatches.some((m) => m.id === matchId)) {
      const list = predictionsByMatch.get(matchId) ?? [];
      list.push({ userId, homeScore: predHome, awayScore: predAway });
      predictionsByMatch.set(matchId, list);
    }
  }

  const potentialByUser: Record<string, number> = {};
  for (const match of ongoingMatches) {
    const realHome = Number(match.homeScore ?? 0);
    const realAway = Number(match.awayScore ?? 0);
    const preds = predictionsByMatch.get(match.id) ?? [];
    for (const p of preds) {
      const pts = computePoints(p.homeScore, p.awayScore, realHome, realAway);
      potentialByUser[p.userId] = (potentialByUser[p.userId] ?? 0) + pts;
    }
  }

  const entries: RankingEntry[] = [];
  for (const [userId, { totalPoints, exactScores }] of Object.entries(
    pointsByUser
  )) {
    const userSnap = await getDoc(doc(db, "users", userId));
    const user = userSnap.data() as User | undefined;
    const currentScore =
      user?.currentScore ?? totalPoints;
    const potentialPoints = potentialByUser[userId] ?? 0;
    entries.push({
      userId,
      userName: getDisplayName(user),
      userAvatar: user?.avatar,
      totalPoints: currentScore,
      potentialPoints,
      exactScores,
      rank: 0,
    });
  }

  entries.sort((a, b) => {
    const scoreA = a.totalPoints + a.potentialPoints;
    const scoreB = b.totalPoints + b.potentialPoints;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.exactScores ?? 0) - (a.exactScores ?? 0);
  });

  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}
