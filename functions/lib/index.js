"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onLeagueMemberDeleted = exports.onMatchCreated = exports.onMatchFinished = exports.calculateScores = exports.calculateScoresManual = exports.updateTestMatch = exports.addTestMatches = exports.syncMatches = exports.syncMatchesManual = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || "";
const FL1_BASE = "https://api.football-data.org/v4/competitions/FL1";
const FL1_MATCHES_URL = `${FL1_BASE}/matches`;
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
/**
 * Récupère les matchs de la prochaine journée (matchday) non encore terminée.
 * Cherche sur les 30 prochains jours et ne stocke que les matchs du premier matchday trouvé.
 */
async function fetchNextMatchday(db) {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = future.toISOString().split("T")[0];
    const params = new URLSearchParams({ dateFrom, dateTo });
    const url = `${FL1_MATCHES_URL}?${params.toString()}`;
    const res = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
    if (!res.ok)
        throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const upcoming = data.matches.filter((m) => !DONE_STATUSES.includes(m.status) && m.matchday != null);
    if (upcoming.length === 0) {
        console.log("Aucun match à venir dans les 30 prochains jours");
        return 0;
    }
    const nextMatchday = Math.min(...upcoming.map((m) => m.matchday));
    const toStore = data.matches.filter((m) => m.matchday === nextMatchday);
    const batch = db.batch();
    for (const m of toStore) {
        const ref = db.collection("matches").doc(String(m.id));
        batch.set(ref, toFirestoreMatch(m), { merge: true });
    }
    await batch.commit();
    return toStore.length;
}
/**
 * Met à jour les matchs de la journée en cours.
 * Récupère le numéro de journée active depuis Firestore, puis interroge
 * l'API avec ?matchday=X pour avoir tous les matchs de cette journée.
 * Si aucun matchday n'est trouvé en base, repli sur ±3 jours autour d'aujourd'hui.
 */
async function fetchCurrentMatches(db) {
    // Trouver le matchday actif (SCHEDULED, TIMED ou IN_PLAY) depuis Firestore
    const snapshot = await db.collection("matches").get();
    const activeMatchdays = snapshot.docs
        .map((d) => d.data())
        .filter((d) => !DONE_STATUSES.includes(d.status) && d.matchday != null)
        .map((d) => d.matchday);
    let url;
    if (activeMatchdays.length > 0) {
        const currentMatchday = Math.min(...activeMatchdays);
        url = `${FL1_MATCHES_URL}?matchday=${currentMatchday}`;
        console.log(`Récupération journée ${currentMatchday}`);
    }
    else {
        // Repli : fenêtre de ±3 jours autour d'aujourd'hui
        const today = new Date();
        const past = new Date(today);
        past.setDate(past.getDate() - 3);
        const future = new Date(today);
        future.setDate(future.getDate() + 3);
        const dateFrom = past.toISOString().split("T")[0];
        const dateTo = future.toISOString().split("T")[0];
        url = `${FL1_MATCHES_URL}?${new URLSearchParams({ dateFrom, dateTo }).toString()}`;
        console.log(`Récupération par date (repli) : ${dateFrom} → ${dateTo}`);
    }
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
    if (mode === "next_matchday")
        return fetchNextMatchday(db);
    return fetchCurrentMatches(db);
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
 * - Base vide / tous terminés : récupère la prochaine journée (throttle 30 min)
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
/** Traite un match terminé : met à jour les pronostics et le currentScore des utilisateurs. */
async function processFinishedMatch(db, matchId, matchData) {
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
            preds = { docs: filtered, empty: false, size: filtered.length };
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
        if (data.points !== undefined && data.points !== null)
            continue;
        const points = computePoints(data.homeScore ?? 0, data.awayScore ?? 0, realHome, realAway);
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
        await processFinishedMatch(db, matchDoc.id, matchDoc.data());
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
    await processFinishedMatch(db, matchId, after);
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
    await processFinishedMatch(db, matchId, data);
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