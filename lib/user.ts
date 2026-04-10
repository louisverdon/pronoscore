import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "./types";

/** Affiche displayName si défini, sinon name, sinon fallback */
export function getDisplayName(
  user: User | undefined,
  fallback = "Inconnu"
): string {
  if (!user) return fallback;
  return user.displayName ?? user.name ?? fallback;
}

/** Récupère un utilisateur par son uid */
export async function getUser(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as User;
}
