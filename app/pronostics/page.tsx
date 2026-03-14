"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserPredictions } from "@/lib/predictions";
import RequireAuth from "@/components/RequireAuth";
import { getMatch } from "@/lib/matches";
import { computePoints } from "@/lib/points";
import { getLeagueVisibleUserIds } from "@/lib/leagues";
import OtherUsersPredictionsModal from "@/components/OtherUsersPredictionsModal";
import type { Prediction, Match } from "@/lib/types";
import Nav from "@/components/Nav";

/** Group key: matchday number, 0 = sans journée (matchs sans matchday). */
function getMatchdayKey(m: Match | null | undefined): number {
  if (m?.matchday != null && m.matchday > 0) return m.matchday;
  return 0;
}

const isMatchInProgress = (m: Match) =>
  (m.status === "LIVE" || m.status === "IN_PLAY") &&
  m.homeScore !== undefined &&
  m.homeScore !== null &&
  m.awayScore !== undefined &&
  m.awayScore !== null;

interface PredictionWithMatch extends Prediction {
  match?: Match | null;
}

function MesPronosticsPageContent() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [expandedMatchdays, setExpandedMatchdays] = useState<Set<number>>(new Set());
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const groupsByMatchday = useMemo(() => {
    const map = new Map<number, PredictionWithMatch[]>();
    for (const p of predictions) {
      const key = getMatchdayKey(p.match);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }, [predictions]);

  // Par défaut, ouvrir uniquement la première section (journée la plus récente)
  useEffect(() => {
    if (groupsByMatchday.length > 0) {
      const firstMatchday = groupsByMatchday[0][0];
      setExpandedMatchdays((prev) => {
        if (prev.size === 0) return new Set([firstMatchday]);
        return prev;
      });
    }
  }, [groupsByMatchday]);

  const toggleMatchday = (matchday: number) => {
    setExpandedMatchdays((prev) => {
      const next = new Set(prev);
      if (next.has(matchday)) next.delete(matchday);
      else next.add(matchday);
      return next;
    });
  };

  useEffect(() => {
    if (user) {
      getLeagueVisibleUserIds(user.uid).then(setVisibleUserIds);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const load = () => {
        getUserPredictions(user!.uid).then(async (preds) => {
          const withMatches = await Promise.all(
            preds.map(async (p) => {
              const m = await getMatch(p.matchId);
              return { ...p, match: m };
            })
          );
          withMatches.sort((a, b) => {
            const mdA = getMatchdayKey(a.match);
            const mdB = getMatchdayKey(b.match);
            if (mdA !== mdB) return mdB - mdA; // matchday desc (récente d'abord)
            const da = a.match?.matchDate ?? "";
            const db = b.match?.matchDate ?? "";
            return da.localeCompare(db);
          });
          setPredictions(withMatches);
          setLoadingData(false);
        });
      };
      load();
      const interval = setInterval(load, 60_000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">
          Mes pronostics
        </h1>
        {loadingData ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : predictions.length === 0 ? (
          <p className="text-zinc-600">
            Vous n&apos;avez pas encore de pronostic.{" "}
            <Link href="/matchs" className="text-blue-600 hover:underline">
              Allez sur les matchs
            </Link>{" "}
            pour en enregistrer.
          </p>
        ) : (
          <div className="space-y-6">
            {groupsByMatchday.map(([matchday, preds]) => {
              const isExpanded = expandedMatchdays.has(matchday);
              const label =
                matchday > 0
                  ? `Journée ${matchday}`
                  : "Autres";
              return (
                <section key={matchday} className="rounded-xl border border-zinc-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleMatchday(matchday)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-zinc-900 hover:bg-zinc-50"
                  >
                    <span>{label}</span>
                    <span className="text-zinc-500">
                      {preds.length} pronostic{preds.length > 1 ? "s" : ""}
                    </span>
                    <span
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-4 border-t border-zinc-200 p-4 pt-4">
                      {preds.map((p) => (
                        <div
                          key={p.id ?? `${p.userId}-${p.matchId}`}
                          className="rounded-lg border border-zinc-100 p-4"
                        >
                          {p.match ? (
                            <>
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm text-zinc-500">
                                  {new Date(p.match.matchDate).toLocaleString("fr-FR")}
                                </span>
                                {p.match.status === "FINISHED" && p.points !== undefined && (
                                  <span className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-800">
                                    +{p.points} pt{p.points > 1 ? "s" : ""}
                                  </span>
                                )}
                                {isMatchInProgress(p.match) && (() => {
                                  const pts = computePoints(p.homeScore, p.awayScore, p.match.homeScore ?? 0, p.match.awayScore ?? 0);
                                  return (
                                    <span className="rounded bg-orange-100 px-2 py-1 text-sm font-medium text-orange-700">
                                      +{pts} pt{pts > 1 ? "s" : ""}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-medium text-zinc-900">
                                <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
                                  {p.match.homeTeam.crest && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.match.homeTeam.crest}
                                      alt=""
                                      className="h-6 w-6 shrink-0 object-contain"
                                    />
                                  )}
                                  <span className="break-words line-clamp-2">{p.match.homeTeam.name}</span>
                                </div>
                                <span className="shrink-0 text-center text-lg tabular-nums">
                                  {p.homeScore} - {p.awayScore}
                                </span>
                                <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                                  <span className="break-words line-clamp-2 text-right">{p.match.awayTeam.name}</span>
                                  {p.match.awayTeam.crest && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.match.awayTeam.crest}
                                      alt=""
                                      className="h-6 w-6 shrink-0 object-contain"
                                    />
                                  )}
                                </div>
                              </div>
                              {p.match.status === "FINISHED" && (
                                <div className="mt-2 text-sm text-zinc-600">
                                  Résultat : {p.match.homeScore ?? "-"} -{" "}
                                  {p.match.awayScore ?? "-"}
                                </div>
                              )}
                              {isMatchInProgress(p.match) && (
                                <div className="mt-2 text-sm text-zinc-600">
                                  Score actuel : {p.match.homeScore} - {p.match.awayScore}
                                </div>
                              )}
                              {p.match.status !== "SCHEDULED" &&
                                p.match.status !== "TIMED" && (
                                  <div className="mt-2 flex flex-wrap gap-3">
                                    <Link
                                      href={`/matchs/match?id=${p.matchId}`}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      Voir tous les pronostics
                                    </Link>
                                    {visibleUserIds.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedMatch(p.match!)}
                                        className="text-sm text-indigo-600 hover:underline"
                                      >
                                        Pronostics de mes ligues
                                      </button>
                                    )}
                                  </div>
                                )}
                            </>
                          ) : (
                            <div className="text-zinc-500">
                              Match {p.matchId} — {p.homeScore} - {p.awayScore}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {selectedMatch && (
        <OtherUsersPredictionsModal
          match={selectedMatch}
          visibleUserIds={visibleUserIds}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

export default function MesPronosticsPage() {
  return (
    <RequireAuth>
      <MesPronosticsPageContent />
    </RequireAuth>
  );
}
