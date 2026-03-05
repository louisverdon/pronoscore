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
}

export interface User {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
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
  totalPoints: number;
  exactScores: number;
  rank: number;
}
