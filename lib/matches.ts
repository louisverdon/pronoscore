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

/** Heure de coup d'envoi passée (utile si l'API / la sync laisse encore TIMED). */
export function matchHasStarted(m: Pick<Match, "status" | "matchDate">): boolean {
  if (m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "LIVE" || m.status === "PAUSED") {
    return true;
  }
  const kickoff = new Date(m.matchDate).getTime();
  if (!Number.isFinite(kickoff)) return false;
  return kickoff <= Date.now();
}

/** Match en cours pour affichage des points "live" (score présent, pas terminé). */
export function isMatchLiveForScoring(m: Match): boolean {
  if (m.status === "FINISHED") return false;
  if (
    m.homeScore === undefined ||
    m.homeScore === null ||
    m.awayScore === undefined ||
    m.awayScore === null
  ) {
    return false;
  }
  if (m.status === "IN_PLAY" || m.status === "LIVE" || m.status === "PAUSED") return true;
  if ((m.status === "TIMED" || m.status === "SCHEDULED") && matchHasStarted(m)) return true;
  return false;
}

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

/** Matchs en cours (LIVE ou IN_PLAY) avec un score actuel */
export async function getOngoingMatches(): Promise<Match[]> {
  const matches = await getAllMatches();
  return matches.filter((m) => isMatchLiveForScoring(m));
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
