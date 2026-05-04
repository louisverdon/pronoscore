import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Prediction } from "./types";

const PREDICTIONS_COLLECTION = "predictions";

function predictionId(userId: string, matchId: string): string {
  return `${userId}_${matchId}`;
}

export async function getPrediction(
  userId: string,
  matchId: string
): Promise<Prediction | null> {
  const predRef = doc(db, PREDICTIONS_COLLECTION, predictionId(userId, matchId));
  const snap = await getDoc(predRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Prediction;
  }
  return null;
}

export async function savePrediction(prediction: Prediction): Promise<void> {
  const id = predictionId(prediction.userId, prediction.matchId);
  await setDoc(doc(db, PREDICTIONS_COLLECTION, id), {
    ...prediction,
    createdAt: prediction.createdAt || new Date().toISOString(),
  });
}

export async function getUserPredictions(
  userId: string
): Promise<Prediction[]> {
  const q = query(
    collection(db, PREDICTIONS_COLLECTION),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Prediction));
}

export async function getMatchPredictions(
  matchId: string
): Promise<Prediction[]> {
  const byId = new Map<string, Prediction>();

  const stringSnap = await getDocs(
    query(collection(db, PREDICTIONS_COLLECTION), where("matchId", "==", matchId))
  );
  for (const d of stringSnap.docs) {
    byId.set(d.id, { id: d.id, ...d.data() } as Prediction);
  }

  if (/^\d+$/.test(matchId)) {
    const numSnap = await getDocs(
      query(
        collection(db, PREDICTIONS_COLLECTION),
        where("matchId", "==", Number(matchId))
      )
    );
    for (const d of numSnap.docs) {
      byId.set(d.id, { id: d.id, ...d.data() } as Prediction);
    }
  }

  return Array.from(byId.values());
}
