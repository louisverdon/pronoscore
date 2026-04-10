import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || "";
const FL1_BASE = "https://api.football-data.org/v4/competitions/FL1";
const FL1_MATCHES_URL = `${FL1_BASE}/matches`;

interface FootballTeam {
  id: number;
  name: string;
  crest?: string;
}

interface FootballMatch {
  id: number;
  homeTeam: FootballTeam;
  awayTeam: FootballTeam;
  utcDate: string;
  status: string;
  matchday?: number;
  score?: {
    fullTime: { home: number | null; away: number | null };
  };
}

interface FootballResponse {
  matches: FootballMatch[];
}

/**
 * Détermine le mode de synchronisation selon l'état de la base :
 * - "next_matchday" : base vide ou tous les matchs sont FINISHED/POSTPONED
 * - "update_1min"   : au moins un match en cours (IN_PLAY, PAUSED, LIVE)
 * - "update_5min"   : matchs en base mais aucun en cours
 */
type SyncMode = "next_matchday" | "update_1min" | "update_5min";

const LIVE_STATUSES = ["IN_PLAY", "PAUSED", "LIVE"];
const DONE_STATUSES = ["FINISHED", "POSTPONED"];

/** Intervalles de throttling (en ms) par mode */
const SYNC_INTERVALS: Record<SyncMode, number> = {
  update_1min: 60 * 1000,
  update_5min: 5 * 60 * 1000,
  next_matchday: 30 * 60 * 1000,
};

async function determineSyncMode(
  db: admin.firestore.Firestore
): Promise<SyncMode> {
  const snapshot = await db.collection("matches").get();
  if (snapshot.empty) return "next_matchday";

  const statuses = snapshot.docs.map((d) => d.data().status as string);

  if (statuses.some((s) => LIVE_STATUSES.includes(s))) return "update_1min";
  if (statuses.every((s) => DONE_STATUSES.includes(s))) return "next_matchday";
  return "update_5min";
}

/**
 * Retourne true si assez de temps s'est écoulé depuis la dernière sync
 * (ou si le mode a changé, pour réagir immédiatement).
 */
async function shouldRunSync(
  db: admin.firestore.Firestore,
  mode: SyncMode
): Promise<boolean> {
  const stateDoc = await db.doc("config/syncState").get();
  if (!stateDoc.exists) return true;

  const data = stateDoc.data();
  const lastMode = data?.lastMode as string | undefined;
  const lastSyncAt = data?.lastSyncAt as admin.firestore.Timestamp | undefined;

  if (!lastSyncAt) return true;
  if (lastMode !== mode) return true;

  return Date.now() - lastSyncAt.toMillis() >= SYNC_INTERVALS[mode];
}

async function recordSyncAt(
  db: admin.firestore.Firestore,
  mode: SyncMode
): Promise<void> {
  await db.doc("config/syncState").set(
    { lastSyncAt: admin.firestore.FieldValue.serverTimestamp(), lastMode: mode },
    { merge: true }
  );
}

function formatDateUTC(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getCurrentWeekRangeUTC(reference = new Date()): { dateFrom: string; dateTo: string } {
  const day = reference.getUTCDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(reference);
  monday.setUTCDate(reference.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { dateFrom: formatDateUTC(monday), dateTo: formatDateUTC(sunday) };
}

/**
 * Synchronise les matchs de la semaine courante (lundi -> dimanche).
 */
async function fetchCurrentWeekMatches(db: admin.firestore.Firestore): Promise<number> {
  const { dateFrom, dateTo } = getCurrentWeekRangeUTC();
  const url = `${FL1_MATCHES_URL}?${new URLSearchParams({ dateFrom, dateTo }).toString()}`;
  console.log(`Récupération hebdomadaire : ${dateFrom} → ${dateTo}`);

  const res = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data: FootballResponse = await res.json();

  const batch = db.batch();
  for (const m of data.matches) {
    const ref = db.collection("matches").doc(String(m.id));
    batch.set(ref, toFirestoreMatch(m), { merge: true });
  }
  await batch.commit();
  return data.matches.length;
}

async function syncMatchesForMode(
  db: admin.firestore.Firestore,
  mode: SyncMode
): Promise<number> {
  return fetchCurrentWeekMatches(db);
}

function toFirestoreMatch(m: FootballMatch) {
  return {
    id: String(m.id),
    homeTeam: {
      id: String(m.homeTeam.id),
      name: m.homeTeam.name,
      crest: m.homeTeam.crest,
    },
    awayTeam: {
      id: String(m.awayTeam.id),
      name: m.awayTeam.name,
      crest: m.awayTeam.crest,
    },
    matchDate: m.utcDate,
    status: m.status,
    matchday: m.matchday ?? null,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
  };
}

/**
 * HTTP endpoint to manually trigger match sync (bypasses throttle).
 */
export const syncMatchesManual = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  if (!FOOTBALL_API_KEY) {
    res.status(500).send("FOOTBALL_API_KEY not configured");
    return;
  }
  try {
    const db = admin.firestore();
    const mode = await determineSyncMode(db);
    const count = await syncMatchesForMode(db, mode);
    await recordSyncAt(db, mode);
    res.status(200).json({ synced: count, mode });
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e));
  }
});

/**
 * Sync Ligue 1 matches — tourne toutes les minutes, mais le throttling interne
 * adapte la fréquence réelle selon l'état de la base :
 * - Base vide / tous terminés : sync hebdomadaire (throttle 30 min)
 * - Matchs en cours (IN_PLAY) : mise à jour toutes les minutes
 * - Matchs planifiés (SCHEDULED/TIMED) : mise à jour toutes les 5 minutes
 */
export const syncMatches = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    if (!FOOTBALL_API_KEY) {
      console.warn("FOOTBALL_API_KEY not set, skipping sync");
      return null;
    }

    const db = admin.firestore();
    const mode = await determineSyncMode(db);

    if (!(await shouldRunSync(db, mode))) {
      console.log(`Mode: ${mode} — throttle actif, sync ignorée`);
      return null;
    }

    const count = await syncMatchesForMode(db, mode);
    await recordSyncAt(db, mode);
    console.log(`Mode: ${mode} — ${count} matchs synchronisés`);
    return null;
  });

/**
 * Calculate points for finished matches.
 */
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

/** Traite un match terminé : met à jour les pronostics et le currentScore des utilisateurs. */
async function processFinishedMatch(
  db: admin.firestore.Firestore,
  matchId: string,
  matchData: admin.firestore.DocumentData
): Promise<number> {
  const realHome = Number(matchData.homeScore ?? 0);
  const realAway = Number(matchData.awayScore ?? 0);

  // S'assurer que matchId est une string
  const matchIdStr = String(matchId);

  // Essayer d'abord avec matchId en string (format standard)
  let preds = await db
    .collection("predictions")
    .where("matchId", "==", matchIdStr)
    .get();

  // Si aucun pronostic trouvé et matchId ressemble à un nombre, essayer en number
  if (preds.empty && /^\d+$/.test(matchIdStr)) {
    preds = await db.collection("predictions").where("matchId", "==", Number(matchIdStr)).get();
  }

  // Dernier recours: récupérer tous les pronostics et filtrer par matchId en mémoire
  // (gère les cas où matchId est stocké sous un format inattendu)
  if (preds.empty) {
    const allPreds = await db.collection("predictions").limit(500).get();
    const filtered = allPreds.docs.filter((d) => {
      const m = d.data().matchId;
      return m === matchIdStr || m === matchId || String(m) === matchIdStr;
    });
    if (filtered.length > 0) {
      preds = { docs: filtered, empty: false, size: filtered.length } as admin.firestore.QuerySnapshot;
      functions.logger.info("processFinishedMatch: pronostics trouvés via fallback (filter)", {
        matchId: matchIdStr,
        count: filtered.length,
      });
    }
  }

  if (preds.empty) {
    functions.logger.warn("processFinishedMatch: aucun pronostic trouvé", {
      matchId: matchIdStr,
      realScore: `${realHome}-${realAway}`,
      hint: "Vérifiez dans Firestore que des documents 'predictions' existent avec matchId === '" + matchIdStr + "'",
    });
  }

  functions.logger.info("processFinishedMatch", {
    matchId: matchIdStr,
    realScore: `${realHome}-${realAway}`,
    predictionsFound: preds.size,
  });

  const batch = db.batch();
  let updated = 0;
  for (const predDoc of preds.docs) {
    const data = predDoc.data();
    if (data.points !== undefined && data.points !== null) continue;
    const points = computePoints(
      data.homeScore ?? 0,
      data.awayScore ?? 0,
      realHome,
      realAway
    );
    batch.update(predDoc.ref, { points });
    const userId = data.userId;
    if (userId) {
      const userRef = db.collection("users").doc(userId);
      batch.set(userRef, { currentScore: admin.firestore.FieldValue.increment(points) }, { merge: true });
    }
    updated++;
  }
  if (updated > 0) {
    await batch.commit();
    functions.logger.info("processFinishedMatch committed", { matchId: matchIdStr, updated });
  }
  return updated;
}

// --- Commandes de test (matchs fictifs) ---

const TEST_MATCHES = [
  { home: "Equipe 1", away: "Equipe 2" },
  { home: "Equipe 3", away: "Equipe 4" },
  { home: "Equipe 5", away: "Equipe 6" },
  { home: "Equipe 7", away: "Equipe 8" },
  { home: "Equipe 9", away: "Equipe 10" },
];

/**
 * HTTP endpoint pour ajouter 5 matchs de test.
 * POST (aucun body requis)
 */
export const addTestMatches = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  try {
    const db = admin.firestore();
    const batch = db.batch();
    const now = new Date();
    for (let i = 0; i < TEST_MATCHES.length; i++) {
      const m = TEST_MATCHES[i];
      const matchId = `test-${i + 1}`;
      const matchDate = new Date(now);
      matchDate.setDate(matchDate.getDate() + i + 1);
      const ref = db.collection("matches").doc(matchId);
      batch.set(ref, {
        id: matchId,
        homeTeam: { id: `team-${i * 2 + 1}`, name: m.home },
        awayTeam: { id: `team-${i * 2 + 2}`, name: m.away },
        matchDate: matchDate.toISOString(),
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
      });
    }
    await batch.commit();
    res.status(200).json({ added: TEST_MATCHES.length, ids: TEST_MATCHES.map((_, i) => `test-${i + 1}`) });
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e));
  }
});

/**
 * HTTP endpoint pour modifier l'état ou le score d'un match de test.
 * POST body JSON: { matchId: string, status?: "SCHEDULED"|"IN_PLAY"|"FINISHED", homeScore?: number, awayScore?: number }
 */
export const updateTestMatch = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  try {
    const body = typeof req.body === "object" ? req.body : {};
    const { matchId, status, homeScore, awayScore } = body;
    if (!matchId || typeof matchId !== "string") {
      res.status(400).json({ error: "matchId (string) requis" });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!["SCHEDULED", "TIMED", "IN_PLAY", "FINISHED"].includes(status)) {
        res.status(400).json({ error: "status invalide: SCHEDULED, TIMED, IN_PLAY ou FINISHED" });
        return;
      }
      updates.status = status;
    }
    if (homeScore !== undefined) {
      updates.homeScore = typeof homeScore === "number" ? homeScore : null;
    }
    if (awayScore !== undefined) {
      updates.awayScore = typeof awayScore === "number" ? awayScore : null;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Au moins un des champs: status, homeScore, awayScore" });
      return;
    }
    const db = admin.firestore();
    const ref = db.collection("matches").doc(matchId);
    await ref.update(updates);
    res.status(200).json({ matchId, updated: updates });
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e));
  }
});

/**
 * Recalcule currentScore de tous les utilisateurs à partir de la somme des points
 * des pronostics. Utile si processFinishedMatch n'a pas mis à jour les scores
 * (ex: pronostics trouvés mais userId manquant, ou réparation manuelle).
 */
async function recalculateAllUserScores(db: admin.firestore.Firestore): Promise<void> {
  const preds = await db.collection("predictions").get();
  const scoreByUser = new Map<string, number>();

  for (const doc of preds.docs) {
    const data = doc.data();
    const userId = data.userId;
    if (!userId) continue;
    const pts = data.points ?? 0;
    scoreByUser.set(userId, (scoreByUser.get(userId) ?? 0) + pts);
  }

  const batch = db.batch();
  for (const [userId, totalScore] of scoreByUser) {
    const userRef = db.collection("users").doc(userId);
    batch.set(userRef, { currentScore: totalScore }, { merge: true });
  }
  if (scoreByUser.size > 0) await batch.commit();
  functions.logger.info("recalculateAllUserScores", {
    usersUpdated: scoreByUser.size,
    scores: Object.fromEntries(scoreByUser),
  });
}

/**
 * HTTP endpoint pour déclencher manuellement le calcul des scores (utile en test).
 * POST (aucun body requis)
 * Retourne des infos de diagnostic : matchIds traités, nombre de pronostics mis à jour.
 * Si query param ?recalculate=1, recalcule aussi tous les currentScore depuis les pronostics.
 */
export const calculateScoresManual = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  try {
    const db = admin.firestore();
    const finished = await db
      .collection("matches")
      .where("status", "==", "FINISHED")
      .get();

    const details: { matchId: string; updated: number }[] = [];
    let totalUpdated = 0;
    for (const matchDoc of finished.docs) {
      const n = await processFinishedMatch(db, matchDoc.id, matchDoc.data());
      totalUpdated += n;
      details.push({ matchId: matchDoc.id, updated: n });
    }

    // Option recalculate: recalculer currentScore depuis la somme des points des pronostics
    const recalc = req.query?.recalculate === "1" || req.query?.recalculate === "true";
    if (recalc) {
      await recalculateAllUserScores(db);
    }

    res.status(200).json({
      matchesProcessed: finished.size,
      predictionsUpdated: totalUpdated,
      details,
      recalculated: recalc,
    });
  } catch (e) {
    functions.logger.error("calculateScoresManual error", e);
    res.status(500).send(String(e));
  }
});

export const calculateScores = functions.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    const db = admin.firestore();
    await processAllFinishedMatches(db);
    return null;
  });

/**
 * Traite tous les matchs terminés (appelé par onMatchFinished et calculateScores).
 * Traiter tous les matchs en une seule exécution évite les conditions de concurrence
 * quand plusieurs matchs se terminent simultanément (un seul batch d'incréments par user).
 */
async function processAllFinishedMatches(db: admin.firestore.Firestore): Promise<void> {
  const finished = await db
    .collection("matches")
    .where("status", "==", "FINISHED")
    .get();

  for (const matchDoc of finished.docs) {
    await processFinishedMatch(db, matchDoc.id, matchDoc.data());
  }
}

/**
 * Déclenche le calcul des scores dès qu'un match passe à FINISHED (onUpdate).
 */
export const onMatchFinished = functions.firestore
  .document("matches/{matchId}")
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    if (after.status !== "FINISHED") return null;

    const matchId = String(context.params.matchId);
    const db = admin.firestore();
    functions.logger.info("onMatchFinished triggered", { matchId });

    // 1. Traiter d'abord le match déclencheur (évite la cohérence éventuelle)
    await processFinishedMatch(db, matchId, after);

    // 2. Traiter les autres matchs terminés (plusieurs matchs peuvent finir en même temps)
    await processAllFinishedMatches(db);
    return null;
  });

/**
 * Déclenche le calcul des scores quand un match est créé avec status FINISHED.
 * (ex: sync API qui crée un match déjà terminé)
 */
export const onMatchCreated = functions.firestore
  .document("matches/{matchId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (data.status !== "FINISHED") return null;

    const matchId = String(context.params.matchId);
    const db = admin.firestore();
    functions.logger.info("onMatchCreated (FINISHED) triggered", { matchId });

    await processFinishedMatch(db, matchId, data);
    return null;
  });

/**
 * Quand un membre quitte une ligue, supprime la ligue si elle n'a plus aucun membre.
 */
export const onLeagueMemberDeleted = functions.firestore
  .document("leagueMembers/{memberId}")
  .onDelete(async (snap) => {
    const data = snap.data();
    const leagueId = data?.leagueId as string | undefined;
    if (!leagueId) return null;

    const db = admin.firestore();
    const remaining = await db
      .collection("leagueMembers")
      .where("leagueId", "==", leagueId)
      .limit(1)
      .get();

    if (remaining.empty) {
      await db.collection("leagues").doc(leagueId).delete();
      functions.logger.info("onLeagueMemberDeleted: ligue vide supprimée", { leagueId });
    }
    return null;
  });
