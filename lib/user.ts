import type { User } from "./types";

/** Affiche displayName si défini, sinon name, sinon fallback */
export function getDisplayName(
  user: User | undefined,
  fallback = "Inconnu"
): string {
  if (!user) return fallback;
  return user.displayName ?? user.name ?? fallback;
}
