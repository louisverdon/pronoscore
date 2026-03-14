export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "LIVE"
  | "IN_PLAY"
  | "FINISHED"
  | "CANCELLED";

export interface Team {
  id: string;
  name: string;
  crest?: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  matchDate: string; // ISO string
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  matchday?: number; // Journée de Ligue 1 (1-38)
}

export interface User {
  uid: string;
  name: string;
  displayName?: string; // Nom choisi par l'utilisateur (première connexion)
  email: string;
  avatar?: string;
  createdAt: string;
  hasCompletedOnboarding?: boolean; // false = doit saisir son nom
  currentScore?: number; // Score actuel (0 par défaut), mis à jour quand un match se termine
}

export interface Prediction {
  id?: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points?: number;
  createdAt: string;
}

export interface PredictionWithUser extends Prediction {
  userName: string;
  userAvatar?: string;
}

export interface RankingEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  totalPoints: number; // currentScore (score actuel fixe)
  potentialPoints: number; // points si les matchs en cours s'arrêtaient maintenant
  exactScores: number;
  rank: number;
}

export interface League {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  inviteCode: string;
}

export interface LeagueMember {
  leagueId: string;
  userId: string;
  joinedAt: string;
}
