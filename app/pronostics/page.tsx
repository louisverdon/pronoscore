"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserPredictions } from "@/lib/predictions";
import { getMatch } from "@/lib/matches";
import type { Prediction, Match } from "@/lib/types";
import Nav from "@/components/Nav";

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
      getUserPredictions(user.uid).then(async (preds) => {
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
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-medium">
                      <span className="min-w-0 truncate text-right">
                        {p.match.homeTeam.name}
                      </span>
                      <span className="text-center text-lg tabular-nums">
                        {p.homeScore} - {p.awayScore}
                      </span>
                      <span className="min-w-0 truncate">
                        {p.match.awayTeam.name}
                      </span>
                    </div>
                    {p.match.status === "FINISHED" && (
                      <div className="mt-2 text-sm text-zinc-600">
                        Résultat : {p.match.homeScore ?? "-"} -{" "}
                        {p.match.awayScore ?? "-"}
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
