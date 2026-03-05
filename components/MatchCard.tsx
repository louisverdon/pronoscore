"use client";

import { useState } from "react";
import Link from "next/link";
import type { Match } from "@/lib/types";
import { getPrediction, savePrediction } from "@/lib/predictions";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

interface MatchCardProps {
  match: Match;
  showPronosticsLink?: boolean;
}

export default function MatchCard({
  match,
  showPronosticsLink = true,
}: MatchCardProps) {
  const { user } = useAuth();
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existingPoints, setExistingPoints] = useState<number | undefined>();

  const matchDate = new Date(match.matchDate);
  const isUpcoming =
    match.status === "SCHEDULED" || match.status === "TIMED";
  const isFinished = match.status === "FINISHED";
  const canEdit = isUpcoming && matchDate > new Date();

  useEffect(() => {
    if (!user) return;
    getPrediction(user.uid, match.id).then((pred) => {
      if (pred) {
        setHomeScore(String(pred.homeScore));
        setAwayScore(String(pred.awayScore));
        setExistingPoints(pred.points);
      }
      setLoaded(true);
    });
  }, [user, match.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canEdit) return;
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    setSaving(true);
    await savePrediction({
      userId: user.uid,
      matchId: match.id,
      homeScore: h,
      awayScore: a,
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-sm text-zinc-500">
        <span>{formatDate(matchDate)}</span>
        {isFinished && existingPoints !== undefined && (
          <span className="font-medium text-green-600">
            +{existingPoints} pt{existingPoints > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1 text-right font-medium">
          {match.homeTeam.name}
        </div>
        <div className="flex items-center gap-2">
          {isFinished ? (
            <span className="text-lg font-bold">
              {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
            </span>
          ) : canEdit && loaded ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="20"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-14 rounded border border-zinc-300 px-2 py-1 text-center text-lg"
              />
              <span className="text-zinc-400">-</span>
              <input
                type="number"
                min="0"
                max="20"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-14 rounded border border-zinc-300 px-2 py-1 text-center text-lg"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Valider
              </button>
            </form>
          ) : loaded ? (
            <span className="text-lg">
              {homeScore || "-"} - {awayScore || "-"}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </div>
        <div className="flex-1 font-medium">{match.awayTeam.name}</div>
      </div>
      {showPronosticsLink && !canEdit && (
        <div className="mt-3">
          <Link
            href={`/matchs/match?id=${match.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Voir les pronostics
          </Link>
        </div>
      )}
    </div>
  );
}
