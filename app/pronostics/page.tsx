"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserPredictions } from "@/lib/predictions";
import { getMatch } from "@/lib/matches";
import { computePoints } from "@/lib/points";
import type { Prediction, Match } from "@/lib/types";
import Nav from "@/components/Nav";

const isMatchInProgress = (m: Match) =>
  (m.status === "LIVE" || m.status === "IN_PLAY") &&
  m.homeScore !== undefined &&
  m.homeScore !== null &&
  m.awayScore !== undefined &&
  m.awayScore !== null;

interface PredictionWithMatch extends Prediction {
  match?: Match | null;
}

export default function MesPronosticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [predictions, setPredictions] = useState<PredictionWithMatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
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
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

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
          <div className="space-y-4">
            {predictions.map((p) => (
              <div
                key={p.id ?? `${p.userId}-${p.matchId}`}
                className="rounded-xl border border-zinc-200 bg-white p-4"
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
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-medium">
                      <div className="flex min-w-0 flex-1 items-center justify-start gap-2">
                        {p.match.homeTeam.crest && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.match.homeTeam.crest}
                            alt=""
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                        )}
                        <span className="truncate">{p.match.homeTeam.name}</span>
                      </div>
                      <span className="shrink-0 text-center text-lg tabular-nums">
                        {p.homeScore} - {p.awayScore}
                      </span>
                      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                        <span className="truncate">{p.match.awayTeam.name}</span>
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
                        <Link
                          href={`/matchs/match?id=${p.matchId}`}
                          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                        >
                          Voir les pronostics
                        </Link>
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
      </main>
    </div>
  );
}
