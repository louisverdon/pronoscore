"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getMatch } from "@/lib/matches";
import { getMatchPredictions } from "@/lib/predictions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDisplayName } from "@/lib/user";
import type { Match, Prediction, User } from "@/lib/types";
import Nav from "@/components/Nav";

function MatchPronosticsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("id") ?? "";
  const [match, setMatch] = useState<Match | null>(null);
  const [predictions, setPredictions] = useState<
    (Prediction & { userName: string; userAvatar?: string })[]
  >([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (!matchId || !user) {
      if (!matchId) setLoadingData(false);
      return;
    }

    const load = async () => {
      const m = await getMatch(matchId);
      if (!m) {
        setLoadingData(false);
        return;
      }
      setMatch(m);

      const matchDate = new Date(m.matchDate);
      const hasStarted = matchDate <= new Date();
      if (!hasStarted) {
        setLoadingData(false);
        return;
      }

      const preds = await getMatchPredictions(matchId);
      const withUsers = await Promise.all(
        preds.map(async (p) => {
          const userSnap = await getDoc(doc(db, "users", p.userId));
          const u = userSnap.data() as User | undefined;
          return {
            ...p,
            userName: getDisplayName(u),
            userAvatar: u?.avatar,
          };
        })
      );
      setPredictions(withUsers);
      setLoadingData(false);
    };
    load();
  }, [user, loading, router, matchId]);

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
        <Link
          href="/matchs"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Retour aux matchs
        </Link>

        {loadingData ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : !match ? (
          <p className="text-zinc-600">Match introuvable.</p>
        ) : (
          <>
            <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4 text-2xl font-bold text-zinc-900">
                <div className="flex min-w-0 flex-1 items-center justify-start gap-3">
                  {match.homeTeam.crest && (
                    <img
                      src={match.homeTeam.crest}
                      alt=""
                      className="h-10 w-10 shrink-0 object-contain"
                    />
                  )}
                  <span className="break-words line-clamp-2">{match.homeTeam.name}</span>
                </div>
                <span className="shrink-0">
                  {match.status === "FINISHED"
                    ? `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}`
                    : "vs"}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                  <span className="break-words line-clamp-2 text-right">{match.awayTeam.name}</span>
                  {match.awayTeam.crest && (
                    <img
                      src={match.awayTeam.crest}
                      alt=""
                      className="h-10 w-10 object-contain"
                    />
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {new Date(match.matchDate).toLocaleString("fr-FR")}
              </p>
            </div>

            <h2 className="mb-4 text-xl font-bold">Pronostics des joueurs</h2>
            {predictions.length === 0 ? (
              <p className="text-zinc-600">Aucun pronostic enregistré.</p>
            ) : (
              <div className="space-y-3">
                {predictions.map((p) => (
                  <div
                    key={p.id ?? `${p.userId}-${p.matchId}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-3">
                      {p.userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.userAvatar}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm">
                          {p.userName.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-zinc-900">{p.userName}</span>
                    </div>
                    <span className="text-lg font-bold">
                      {p.homeScore} - {p.awayScore}
                    </span>
                    {p.points !== undefined && (
                      <span className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-800">
                        +{p.points} pt{p.points > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function MatchPronosticsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    }>
      <MatchPronosticsContent />
    </Suspense>
  );
}
