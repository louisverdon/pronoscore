import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { RankingEntry, User } from "./types";

export async function getRanking(): Promise<RankingEntry[]> {
  const predictionsSnap = await getDocs(
    collection(db, "predictions")
  );
  const pointsByUser: Record<
    string,
    { totalPoints: number; exactScores: number }
  > = {};

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
  }

  const entries: RankingEntry[] = [];
  for (const [userId, { totalPoints, exactScores }] of Object.entries(
    pointsByUser
  )) {
    const userSnap = await getDoc(doc(db, "users", userId));
    const user = userSnap.data() as User | undefined;
    entries.push({
      userId,
      userName: user?.name ?? "Inconnu",
      userAvatar: user?.avatar,
      totalPoints,
      exactScores,
      rank: 0,
    });
  }

  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return (b.exactScores ?? 0) - (a.exactScores ?? 0);
  });

  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}
