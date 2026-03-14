// Types
export type {
  MatchStatus,
  Team,
  Match,
  User,
  Prediction,
  PredictionWithUser,
  RankingEntry,
  League,
  LeagueMember,
} from "./lib/types";

// Firebase
export { app, auth, db, isFirebaseConfigured } from "./lib/firebase";

// Auth context
export { AuthProvider, useAuth } from "./lib/auth-context";

// Data queries – Matches
export {
  getAllMatches,
  getUpcomingMatches,
  getRecentMatches,
  getOngoingMatches,
  getMatch,
} from "./lib/matches";

// Data queries – Predictions
export {
  getPrediction,
  savePrediction,
  getUserPredictions,
  getMatchPredictions,
} from "./lib/predictions";

// Data queries – Leagues
export {
  createLeague,
  getLeagueByInviteCode,
  isLeagueMember,
  joinLeague,
  getUserLeagues,
  leaveLeague,
  getLeagueMemberIds,
  getLeagueVisibleUserIds,
} from "./lib/leagues";

// Ranking
export { getRanking } from "./lib/ranking";

// Points
export { computePoints } from "./lib/points";

// User helpers
export { getDisplayName, getUser } from "./lib/user";
