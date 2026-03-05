import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Match } from "./types";

const MATCHES_COLLECTION = "matches";

export async function getAllMatches(): Promise<Match[]> {
  const q = query(
    collection(db, MATCHES_COLLECTION),
    orderBy("matchDate", "asc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      matchDate:
        data.matchDate instanceof Timestamp
          ? data.matchDate.toDate().toISOString()
          : data.matchDate,
    } as Match;
  });
}

export async function getUpcomingMatches(): Promise<Match[]> {
  const matches = await getAllMatches();
  const now = new Date().toISOString();
  return matches
    .filter(
      (m) =>
        (m.status === "SCHEDULED" || m.status === "TIMED") &&
        m.matchDate >= now
    )
    .slice(0, 50);
}

export async function getRecentMatches(): Promise<Match[]> {
  const matches = await getAllMatches();
  const now = new Date().toISOString();
  return matches
    .filter(
      (m) => m.status === "FINISHED" && m.matchDate < now
    )
    .slice(-50)
    .reverse();
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const matchRef = doc(db, MATCHES_COLLECTION, matchId);
  const snap = await getDoc(matchRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      id: snap.id,
      ...data,
      matchDate:
        data.matchDate instanceof Timestamp
          ? data.matchDate.toDate().toISOString()
          : data.matchDate,
    } as Match;
  }
  return null;
}
