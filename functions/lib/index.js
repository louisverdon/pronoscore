"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMatchFinished = exports.calculateScores = exports.calculateScoresManual = exports.updateTestMatch = exports.addTestMatches = exports.syncMatches = exports.syncMatchesManual = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || "";
const FL1_BASE = "https://api.football-data.org/v4/competitions/FL1";
const FL1_MATCHES_URL = `${FL1_BASE}/matches`;
async function getMatchesUrlForCurrentSeasonAndNextMatchday() {
    const today = new Date();
    // Calcul du prochain mardi
    const nextTuesday = new Date(today);
    const day = today.getDay(); // 0=Dimanche ... 2=Mardi
    const daysUntilTuesday = (2 - day + 7) % 7 || 7;
    nextTuesday.setDate(today.getDate() + daysUntilTuesday);
    const dateFrom = today.toISOString().split("T")[0];
    const dateTo = nextTuesday.toISOString().split("T")[0];
    const params = new URLSearchParams({
        dateFrom,
        dateTo,
        status: "SCHEDULED",
    });
    return `${FL1_MATCHES_URL}?${params.toString()}`;
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
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
    };
}
/**
 * HTTP endpoint to manually trigger match sync (for initial setup).
 * Requires Firebase Auth or can be restricted by App Check.
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
        const matchesUrl = await getMatchesUrlForCurrentSeasonAndNextMatchday();
        const apiRes = await fetch(matchesUrl, {
            headers: { "X-Auth-Token": FOOTBALL_API_KEY },
        });
        if (!apiRes.ok)
            throw new Error(`API error: ${apiRes.status}`);
        const data = await apiRes.json();
        const db = admin.firestore();
        const batch = db.batch();
        for (const m of data.matches) {
            const fm = toFirestoreMatch(m);
            const ref = db.collection("matches").doc(String(m.id));
            batch.set(ref, fm, { merge: true });
        }
        await batch.commit();
        res.status(200).json({ synced: data.matches.length });
    }
    catch (e) {
        console.error(e);
        res.status(500).send(String(e));
    }
});
/**
 * Sync Ligue 1 matches from football-data.org every 3 hours.
 */
exports.syncMatches = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
    if (!FOOTBALL_API_KEY) {
        console.warn("FOOTBALL_API_KEY not set, skipping sync");
        return null;
    }
    const matchesUrl = await getMatchesUrlForCurrentSeasonAndNextMatchday();
    const res = await fetch(matchesUrl, {
        headers: { "X-Auth-Token": FOOTBALL_API_KEY },
    });
    if (!res.ok) {
        throw new Error(`Football API error: ${res.status}`);
    }
    const data = await res.json();
    const db = admin.firestore();
    const batch = db.batch();
    for (const m of data.matches) {
        const fm = toFirestoreMatch(m);
        const ref = db.collection("matches").doc(String(m.id));
        batch.set(ref, fm, { merge: true });
    }
    await batch.commit();
    console.log(`Synced ${data.matches.length} matches`);
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
    const preds = await db
        .collection("predictions")
        .where("matchId", "==", matchId)
        .get();
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
    if (updated > 0)
        await batch.commit();
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
 * HTTP endpoint pour déclencher manuellement le calcul des scores (utile en test).
 * POST (aucun body requis)
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
        let totalUpdated = 0;
        for (const matchDoc of finished.docs) {
            totalUpdated += await processFinishedMatch(db, matchDoc.id, matchDoc.data());
        }
        res.status(200).json({ matchesProcessed: finished.size, predictionsUpdated: totalUpdated });
    }
    catch (e) {
        console.error(e);
        res.status(500).send(String(e));
    }
});
exports.calculateScores = functions.pubsub
    .schedule("every 30 minutes")
    .onRun(async () => {
    const db = admin.firestore();
    const finished = await db
        .collection("matches")
        .where("status", "==", "FINISHED")
        .get();
    for (const matchDoc of finished.docs) {
        await processFinishedMatch(db, matchDoc.id, matchDoc.data());
    }
    return null;
});
/**
 * Déclenche le calcul des scores dès qu'un match passe à FINISHED.
 */
exports.onMatchFinished = functions.firestore
    .document("matches/{matchId}")
    .onUpdate(async (change, context) => {
    const after = change.after.data();
    if (after.status !== "FINISHED")
        return null;
    const matchId = context.params.matchId;
    const db = admin.firestore();
    await processFinishedMatch(db, matchId, after);
    return null;
});
//# sourceMappingURL=index.js.map