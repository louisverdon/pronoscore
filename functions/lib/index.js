"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeagueMemberDeleted = exports.onMatchCreated = exports.onMatchFinished = exports.reconcileFinishedMatchesDaily = exports.calculateScores = exports.calculateScoresManual = exports.updateTestMatch = exports.addTestMatches = exports.syncMatches = exports.syncMatchesManual = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || "";
const FL1_BASE = "https://api.football-data.org/v4/competitions/FL1";
const FL1_MATCHES_URL = `${FL1_BASE}/matches`;
const MATCH_BY_ID_URL = "https://api.football-data.org/v4/matches";
const LIVE_STATUSES = ["IN_PLAY", "PAUSED", "LIVE"];
const DONE_STATUSES = ["FINISHED", "POSTPONED"];
/** Intervalles de throttling (en ms) par mode */
const SYNC_INTERVALS = {
    update_1min: 60 * 1000,
    update_5min: 5 * 60 * 1000,
    next_matchday: 30 * 60 * 1000,
};
async function determineSyncMode(db) {
    const snapshot = await db.collection("matches").get();
    if (snapshot.empty)
        return "next_matchday";
    const statuses = snapshot.docs.map((d) => d.data().status);
    if (statuses.some((s) => LIVE_STATUSES.includes(s)))
        return "update_1min";
    if (statuses.every((s) => DONE_STATUSES.includes(s)))
        return "next_matchday";
    return "update_5min";
}
/**
 * Retourne true si assez de temps s'est écoulé depuis la dernière sync
 * (ou si le mode a changé, pour réagir immédiatement).
 */
async function shouldRunSync(db, mode) {
    const stateDoc = await db.doc("config/syncState").get();
    if (!stateDoc.exists)
        return true;
    const data = stateDoc.data();
    const lastMode = data?.lastMode;
    const lastSyncAt = data?.lastSyncAt;
    if (!lastSyncAt)
        return true;
    if (lastMode !== mode)
        return true;
    return Date.now() - lastSyncAt.toMillis() >= SYNC_INTERVALS[mode];
}
async function recordSyncAt(db, mode) {
    await db.doc("config/syncState").set({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp(), lastMode: mode }, { merge: true });
}
function formatDateUTC(date) {
    return date.toISOString().split("T")[0];
}
function getCurrentWeekRangeUTC(reference = new Date()) {
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
async function fetchCurrentWeekMatches(db) {
    const { dateFrom, dateTo } = getCurrentWeekRangeUTC();
    const url = `${FL1_MATCHES_URL}?${new URLSearchParams({ dateFrom, dateTo }).toString()}`;
    console.log(`Récupération hebdomadaire : ${dateFrom} → ${dateTo}`);
    const res = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
    if (!res.ok)
        throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const batch = db.batch();
    for (const m of data.matches) {
        const ref = db.collection("matches").doc(String(m.id));
        batch.set(ref, toFirestoreMatch(m), { merge: true });
    }
    await batch.commit();
    return data.matches.length;
}
async function syncMatchesForMode(db, mode) {
    return fetchCurrentWeekMatches(db);
}
function toFirestoreMatch(m) {
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
function parseFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function hasOfficialScore(score) {
    return typeof score?.home === "number" && typeof score?.away === "number";
}
function normalizePredictionMatchId(value) {
    return value === null || value === undefined ? "" : String(value);
}
function chunkArray(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
async function fetchOfficialMatchesByIdsFromApi(matchIds) {
    const officialById = new Map();
    if (matchIds.length === 0)
        return officialById;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const query = new URLSearchParams({ ids: matchIds.join(",") }).toString();
        const res = await fetch(`${MATCH_BY_ID_URL}?${query}`, {
            headers: { "X-Auth-Token": FOOTBALL_API_KEY },
            signal: controller.signal,
        });
        if (!res.ok) {
            throw new Error(`API error ${res.status} for ids batch (${matchIds.length})`);
        }
        const payload = await res.json();
        for (const match of payload.matches ?? []) {
            officialById.set(String(match.id), {
                status: match.status ?? "UNKNOWN",
                home: match.score?.fullTime?.home ?? null,
                away: match.score?.fullTime?.away ?? null,
            });
        }
        return officialById;
    }
    finally {
        clearTimeout(timeout);
    }
}
async function getPredictionsForMatch(db, matchId) {
    const docsById = new Map();
    const stringQuery = await db.collection("predictions").where("matchId", "==", matchId).get();
    for (const doc of stringQuery.docs)
        docsById.set(doc.id, doc);
    if (/^\d+$/.test(matchId)) {
        const numberQuery = await db.collection("predictions").where("matchId", "==", Number(matchId)).get();
        for (const doc of numberQuery.docs)
            docsById.set(doc.id, doc);
    }
    if (docsById.size > 0) {
        return Array.from(docsById.values());
    }
    let cursor = null;
    const pageSize = 500;
    while (true) {
        let query = db
            .collection("predictions")
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(pageSize);
        if (cursor) {
            query = query.startAfter(cursor);
        }
        const page = await query.get();
        if (page.empty)
            break;
        for (const doc of page.docs) {
            if (normalizePredictionMatchId(doc.data().matchId) === matchId) {
                docsById.set(doc.id, doc);
            }
        }
        if (page.size < pageSize)
            break;
        cursor = page.docs[page.docs.length - 1];
    }
    return Array.from(docsById.values());
}
/**
 * HTTP endpoint to manually trigger match sync (bypasses throttle).
 */
exports.syncMatchesManual = functions.https.onRequest(async (req, res) => {
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
    }
    catch (e) {
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
exports.syncMatches = functions.pubsub
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
function computePoints(predHome, predAway, realHome, realAway) {
    if (predHome === realHome && predAway === realAway)
        return 3;
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;
    if (predDiff === realDiff)
        return 2;
    const predWinner = predHome > predAway ? "HOME" : predHome < predAway ? "AWAY" : "DRAW";
    const realWinner = realHome > realAway ? "HOME" : realHome < realAway ? "AWAY" : "DRAW";
    if (predWinner === realWinner)
        return 1;
    return 0;
}
/**
 * Réconcilie les points d'un match terminé:
 * - recalcule les points de tous les pronostics du match
 * - applique la différence (delta) sur currentScore des utilisateurs
 * - met à jour le champ points du pronostic si nécessaire
 */
async function reconcileFinishedMatchScores(db, matchId, matchData) {
    const realHome = parseFiniteNumber(matchData.homeScore);
    const realAway = parseFiniteNumber(matchData.awayScore);
    const matchIdStr = String(matchId);
    if (realHome === null || realAway === null) {
        functions.logger.warn("reconcileFinishedMatchScores skipped: missing match score", {
            matchId: matchIdStr,
            homeScore: matchData.homeScore ?? null,
            awayScore: matchData.awayScore ?? null,
        });
        return { predictionsUpdated: 0, usersScoreAdjusted: 0, totalDeltaApplied: 0 };
    }
    const predictionDocs = await getPredictionsForMatch(db, matchIdStr);
    if (predictionDocs.length === 0)
        return { predictionsUpdated: 0, usersScoreAdjusted: 0, totalDeltaApplied: 0 };
    let batch = db.batch();
    let operationCount = 0;
    let predictionsUpdated = 0;
    let usersScoreAdjusted = 0;
    let totalDeltaApplied = 0;
    const commitBatchIfNeeded = async (force = false) => {
        if (operationCount === 0)
            return;
        if (!force && operationCount < 400)
            return;
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
    };
    for (const predDoc of predictionDocs) {
        const data = predDoc.data();
        const predHome = parseFiniteNumber(data.homeScore) ?? 0;
        const predAway = parseFiniteNumber(data.awayScore) ?? 0;
        const nextPoints = computePoints(predHome, predAway, realHome, realAway);
        const prevPointsRaw = data.points;
        const prevPoints = typeof prevPointsRaw === "number" && Number.isFinite(prevPointsRaw) ? prevPointsRaw : 0;
        const delta = nextPoints - prevPoints;
        if (delta === 0 && prevPointsRaw === nextPoints) {
            continue;
        }
        batch.update(predDoc.ref, { points: nextPoints });
        operationCount += 1;
        predictionsUpdated += 1;
        const userId = data.userId;
        if (userId && delta !== 0) {
            const userRef = db.collection("users").doc(userId);
            batch.set(userRef, { currentScore: admin.firestore.FieldValue.increment(delta) }, { merge: true });
            operationCount += 1;
            usersScoreAdjusted += 1;
            totalDeltaApplied += delta;
        }
        await commitBatchIfNeeded();
    }
    await commitBatchIfNeeded(true);
    if (predictionsUpdated > 0) {
        functions.logger.info("reconcileFinishedMatchScores committed", {
            matchId: matchIdStr,
            predictionsUpdated,
            usersScoreAdjusted,
            totalDeltaApplied,
            realScore: `${realHome}-${realAway}`,
        });
    }
    return { predictionsUpdated, usersScoreAdjusted, totalDeltaApplied };
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
exports.addTestMatches = functions.https.onRequest(async (req, res) => {
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
    }
    catch (e) {
        console.error(e);
        res.status(500).send(String(e));
    }
});
/**
 * HTTP endpoint pour modifier l'état ou le score d'un match de test.
 * POST body JSON: { matchId: string, status?: "SCHEDULED"|"IN_PLAY"|"FINISHED", homeScore?: number, awayScore?: number }
 */
exports.updateTestMatch = functions.https.onRequest(async (req, res) => {
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
        const updates = {};
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
    }
    catch (e) {
        console.error(e);
        res.status(500).send(String(e));
    }
});
/**
 * Recalcule currentScore de tous les utilisateurs à partir de la somme des points
 * des pronostics. Utile si processFinishedMatch n'a pas mis à jour les scores
 * (ex: pronostics trouvés mais userId manquant, ou réparation manuelle).
 */
async function recalculateAllUserScores(db) {
    const preds = await db.collection("predictions").get();
    const scoreByUser = new Map();
    for (const doc of preds.docs) {
        const data = doc.data();
        const userId = data.userId;
        if (!userId)
            continue;
        const pts = data.points ?? 0;
        scoreByUser.set(userId, (scoreByUser.get(userId) ?? 0) + pts);
    }
    const batch = db.batch();
    for (const [userId, totalScore] of scoreByUser) {
        const userRef = db.collection("users").doc(userId);
        batch.set(userRef, { currentScore: totalScore }, { merge: true });
    }
    if (scoreByUser.size > 0)
        await batch.commit();
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
exports.calculateScoresManual = functions.https.onRequest(async (req, res) => {
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
        const details = [];
        let totalUpdated = 0;
        for (const matchDoc of finished.docs) {
            const result = await reconcileFinishedMatchScores(db, matchDoc.id, matchDoc.data());
            totalUpdated += result.predictionsUpdated;
            details.push({ matchId: matchDoc.id, updated: result.predictionsUpdated });
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
    }
    catch (e) {
        functions.logger.error("calculateScoresManual error", e);
        res.status(500).send(String(e));
    }
});
exports.calculateScores = functions.pubsub
    .schedule("every 30 minutes")
    .onRun(async () => {
    const db = admin.firestore();
    await processAllFinishedMatches(db);
    return null;
});
/**
 * Vérification quotidienne des matchs terminés.
 * Recalcule les points et corrige currentScore si un score officiel a été modifié après coup.
 */
exports.reconcileFinishedMatchesDaily = functions.pubsub
    .schedule("0 0 * * *")
    .timeZone("Europe/Paris")
    .onRun(async () => {
    const startedAt = Date.now();
    if (!FOOTBALL_API_KEY) {
        functions.logger.warn("reconcileFinishedMatchesDaily skipped: FOOTBALL_API_KEY missing");
        return null;
    }
    const db = admin.firestore();
    const maxRecentMatches = 100;
    const counters = {
        matchesChecked: 0,
        matchesScoreChanged: 0,
        matchesSkippedNoChange: 0,
        matchesSkippedMissingOfficialScore: 0,
        matchesApiErrors: 0,
        predictionsUpdated: 0,
        usersScoreAdjusted: 0,
        totalDeltaApplied: 0,
    };
    const recent = await db
        .collection("matches")
        .orderBy("matchDate", "desc")
        .limit(maxRecentMatches)
        .get();
    // On ne réconcilie que les matchs terminés, mais dans la fenêtre des 100 plus récents.
    const finishedRecentDocs = recent.docs.filter((doc) => doc.data().status === "FINISHED");
    counters.matchesChecked += finishedRecentDocs.length;
    // Doc football-data v4: GET /v4/matches?ids=333,3303,3213
    // Pour limiter les 429, on interroge l'API par lots d'ids.
    const batches = chunkArray(finishedRecentDocs, 20);
    for (const batch of batches) {
        const batchIds = batch.map((doc) => String(doc.id));
        let officialById;
        try {
            officialById = await fetchOfficialMatchesByIdsFromApi(batchIds);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            counters.matchesApiErrors += batchIds.length;
            functions.logger.error("reconcileFinishedMatchesDaily API batch error", {
                error: message,
                batchSize: batchIds.length,
                batchIdsSample: batchIds.slice(0, 5),
            });
            continue;
        }
        for (const matchDoc of batch) {
            const local = matchDoc.data();
            const localHome = parseFiniteNumber(local.homeScore);
            const localAway = parseFiniteNumber(local.awayScore);
            const matchId = String(matchDoc.id);
            const official = officialById.get(matchId);
            if (!official) {
                counters.matchesSkippedMissingOfficialScore += 1;
                functions.logger.warn("reconcileFinishedMatchesDaily skipped: official match not found", {
                    matchId,
                    reason: "not returned by /v4/matches?ids",
                });
                continue;
            }
            if (!hasOfficialScore(official)) {
                counters.matchesSkippedMissingOfficialScore += 1;
                functions.logger.warn("reconcileFinishedMatchesDaily skipped: missing official score", {
                    matchId,
                    apiStatus: official.status,
                    apiHomeScore: official.home,
                    apiAwayScore: official.away,
                });
                continue;
            }
            const scoreChanged = localHome !== official.home || localAway !== official.away;
            if (!scoreChanged) {
                counters.matchesSkippedNoChange += 1;
                continue;
            }
            counters.matchesScoreChanged += 1;
            await matchDoc.ref.set({
                homeScore: official.home,
                awayScore: official.away,
                status: official.status || local.status || "FINISHED",
            }, { merge: true });
            const result = await reconcileFinishedMatchScores(db, matchId, {
                ...local,
                homeScore: official.home,
                awayScore: official.away,
            });
            counters.predictionsUpdated += result.predictionsUpdated;
            counters.usersScoreAdjusted += result.usersScoreAdjusted;
            counters.totalDeltaApplied += result.totalDeltaApplied;
        }
    }
    functions.logger.info("reconcileFinishedMatchesDaily done", {
        ...counters,
        runDurationMs: Date.now() - startedAt,
    });
    return null;
});
/**
 * Traite tous les matchs terminés (appelé par onMatchFinished et calculateScores).
 * Traiter tous les matchs en une seule exécution évite les conditions de concurrence
 * quand plusieurs matchs se terminent simultanément (un seul batch d'incréments par user).
 */
async function processAllFinishedMatches(db) {
    const finished = await db
        .collection("matches")
        .where("status", "==", "FINISHED")
        .get();
    for (const matchDoc of finished.docs) {
        await reconcileFinishedMatchScores(db, matchDoc.id, matchDoc.data());
    }
}
/**
 * Déclenche le calcul des scores dès qu'un match passe à FINISHED (onUpdate).
 */
exports.onMatchFinished = functions.firestore
    .document("matches/{matchId}")
    .onUpdate(async (change, context) => {
    const after = change.after.data();
    if (after.status !== "FINISHED")
        return null;
    const matchId = String(context.params.matchId);
    const db = admin.firestore();
    functions.logger.info("onMatchFinished triggered", { matchId });
    // 1. Traiter d'abord le match déclencheur (évite la cohérence éventuelle)
    await reconcileFinishedMatchScores(db, matchId, after);
    // 2. Traiter les autres matchs terminés (plusieurs matchs peuvent finir en même temps)
    await processAllFinishedMatches(db);
    return null;
});
/**
 * Déclenche le calcul des scores quand un match est créé avec status FINISHED.
 * (ex: sync API qui crée un match déjà terminé)
 */
exports.onMatchCreated = functions.firestore
    .document("matches/{matchId}")
    .onCreate(async (snap, context) => {
    const data = snap.data();
    if (data.status !== "FINISHED")
        return null;
    const matchId = String(context.params.matchId);
    const db = admin.firestore();
    functions.logger.info("onMatchCreated (FINISHED) triggered", { matchId });
    await reconcileFinishedMatchScores(db, matchId, data);
    return null;
});
/**
 * Quand un membre quitte une ligue, supprime la ligue si elle n'a plus aucun membre.
 */
exports.onLeagueMemberDeleted = functions.firestore
    .document("leagueMembers/{memberId}")
    .onDelete(async (snap) => {
    const data = snap.data();
    const leagueId = data?.leagueId;
    if (!leagueId)
        return null;
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
//# sourceMappingURL=index.js.map