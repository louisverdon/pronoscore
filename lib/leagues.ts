import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { League } from "./types";

const INVITE_CODE_LENGTH = 8;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans O,0,I,1 pour éviter confusion

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/** Crée une ligue et ajoute le créateur comme membre */
export async function createLeague(name: string, creatorUserId: string): Promise<League> {
  const inviteCode = generateInviteCode();
  const leagueRef = doc(collection(db, "leagues"));
  const now = new Date().toISOString();
  const league: Omit<League, "id"> & { id?: string } = {
    name: name.trim(),
    createdBy: creatorUserId,
    createdAt: now,
    inviteCode,
  };
  await setDoc(leagueRef, league);
  const created: League = { id: leagueRef.id, ...league };

  // Ajouter le créateur comme membre
  const memberId = `${created.id}_${creatorUserId}`;
  await setDoc(doc(db, "leagueMembers", memberId), {
    leagueId: created.id,
    userId: creatorUserId,
    joinedAt: now,
  });

  return created;
}

/** Récupère une ligue par son code d'invitation */
export async function getLeagueByInviteCode(
  inviteCode: string
): Promise<(League & { creatorName?: string }) | null> {
  const q = query(
    collection(db, "leagues"),
    where("inviteCode", "==", inviteCode.toUpperCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  const league: League & { creatorName?: string } = {
    id: snap.docs[0].id,
    name: data.name,
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    inviteCode: data.inviteCode,
  };
  // Optionnel: charger le nom du créateur
  const creatorDoc = await getDoc(doc(db, "users", data.createdBy));
  if (creatorDoc.exists()) {
    const u = creatorDoc.data();
    league.creatorName = u.displayName ?? u.name ?? "Un utilisateur";
  }
  return league;
}

/** Vérifie si l'utilisateur est déjà membre de la ligue */
export async function isLeagueMember(leagueId: string, userId: string): Promise<boolean> {
  const memberId = `${leagueId}_${userId}`;
  const memberDoc = await getDoc(doc(db, "leagueMembers", memberId));
  return memberDoc.exists();
}

/** Rejoint une ligue */
export async function joinLeague(leagueId: string, userId: string): Promise<void> {
  const memberId = `${leagueId}_${userId}`;
  await setDoc(doc(db, "leagueMembers", memberId), {
    leagueId,
    userId,
    joinedAt: new Date().toISOString(),
  });
}

/** Liste les ligues de l'utilisateur */
export async function getUserLeagues(userId: string): Promise<(League & { creatorName?: string })[]> {
  const q = query(
    collection(db, "leagueMembers"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  const leagueIds = snap.docs.map((d) => d.data().leagueId as string);
  if (leagueIds.length === 0) return [];

  const leagues: (League & { creatorName?: string })[] = [];
  for (const leagueId of leagueIds) {
    const leagueDoc = await getDoc(doc(db, "leagues", leagueId));
    if (!leagueDoc.exists()) continue;
    const data = leagueDoc.data();
    const league: League & { creatorName?: string } = {
      id: leagueDoc.id,
      name: data.name,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      inviteCode: data.inviteCode,
    };
    const creatorDoc = await getDoc(doc(db, "users", data.createdBy));
    if (creatorDoc.exists()) {
      const u = creatorDoc.data();
      league.creatorName = u.displayName ?? u.name ?? "Un utilisateur";
    }
    leagues.push(league);
  }
  // Trier par date de création (plus récente en premier)
  leagues.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return leagues;
}

/** Quitte une ligue (retire l'utilisateur de leagueMembers) */
export async function leaveLeague(leagueId: string, userId: string): Promise<void> {
  const memberId = `${leagueId}_${userId}`;
  await deleteDoc(doc(db, "leagueMembers", memberId));
}

/** Liste les userId membres d'une ligue */
export async function getLeagueMemberIds(leagueId: string): Promise<string[]> {
  const q = query(
    collection(db, "leagueMembers"),
    where("leagueId", "==", leagueId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().userId as string);
}
