"use client";

import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { computePoints } from "@/lib/points";
import { getMatchPredictions } from "@/lib/predictions";
import { getUser, getDisplayName } from "@/lib/user";
import type { Match, Prediction, User } from "@/lib/types";

interface UserPredictionEntry {
  user: User;
  prediction: Prediction;
  points: number;
}

interface Props {
  match: Match;
  visibleUserIds: string[];
  onClose: () => void;
}

function pointsBadgeClass(points: number): string {
  if (points === 3) return "bg-green-100 text-green-800";
  if (points === 2) return "bg-blue-100 text-blue-800";
  if (points === 1) return "bg-yellow-100 text-yellow-800";
  return "bg-zinc-100 text-zinc-500";
}

export default function OtherUsersPredictionsModal({
  match,
  visibleUserIds,
  onClose,
}: Props) {
  const [entries, setEntries] = useState<UserPredictionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const allPredictions = await getMatchPredictions(match.id);
      const filtered = allPredictions.filter((p) =>
        visibleUserIds.includes(p.userId)
      );

      const result: UserPredictionEntry[] = [];
      for (const pred of filtered) {
        const user = await getUser(pred.userId);
        if (!user) continue;

        let points = 0;
        if (match.status === "FINISHED" && pred.points !== undefined) {
          points = pred.points;
        } else if (
          (match.status === "LIVE" || match.status === "IN_PLAY") &&
          match.homeScore !== undefined &&
          match.awayScore !== undefined
        ) {
          points = computePoints(
            pred.homeScore,
            pred.awayScore,
            match.homeScore,
            match.awayScore
          );
        }

        result.push({ user, prediction: pred, points });
      }

      result.sort((a, b) => b.points - a.points);
      setEntries(result);
      setLoading(false);
    }
    load();
  }, [match, visibleUserIds]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-zinc-900">
              Pronostics de mes ligues
            </h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {match.homeTeam.name} — {match.awayTeam.name}
            </p>
            {match.status === "FINISHED" && (
              <p className="text-xs text-zinc-400">
                Résultat&nbsp;: {match.homeScore} - {match.awayScore}
              </p>
            )}
            {(match.status === "LIVE" || match.status === "IN_PLAY") && (
              <p className="text-xs text-orange-600">
                En cours&nbsp;: {match.homeScore} - {match.awayScore}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-10 text-center text-zinc-500">
              Chargement…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-zinc-500">
              Aucun membre de vos ligues n&apos;a fait de pronostic pour ce
              match.
            </div>
          ) : (
            <ol className="space-y-2">
              {entries.map(({ user, prediction, points }, index) => (
                <li
                  key={user.uid}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-zinc-400">
                    {index + 1}
                  </span>
                  <Avatar
                    src={user.avatar}
                    name={getDisplayName(user)}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                    {getDisplayName(user)}
                  </span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-zinc-700">
                    {prediction.homeScore}&nbsp;-&nbsp;{prediction.awayScore}
                  </span>
                  {match.status !== "SCHEDULED" &&
                    match.status !== "TIMED" && (
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${pointsBadgeClass(points)}`}
                      >
                        {points}&nbsp;pt{points > 1 ? "s" : ""}
                      </span>
                    )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
