"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScores = exports.syncMatches = exports.syncMatchesManual = void 0;
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
 * Calculate points for finished matches, runs every 30 minutes.
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
exports.calculateScores = functions.pubsub
    .schedule("every 30 minutes")
    .onRun(async () => {
    const db = admin.firestore();
    const finished = await db
        .collection("matches")
        .where("status", "==", "FINISHED")
        .get();
    for (const matchDoc of finished.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data();
        const realHome = Number(matchData.homeScore ?? 0);
        const realAway = Number(matchData.awayScore ?? 0);
        const preds = await db
            .collection("predictions")
            .where("matchId", "==", matchId)
            .get();
        const batch = db.batch();
        for (const predDoc of preds.docs) {
            const data = predDoc.data();
            const points = computePoints(data.homeScore ?? 0, data.awayScore ?? 0, realHome, realAway);
            batch.update(predDoc.ref, { points });
        }
        await batch.commit();
    }
    return null;
});
//# sourceMappingURL=index.js.map