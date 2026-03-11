"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRanking } from "@/lib/ranking";
import { getUserLeagues } from "@/lib/leagues";
import type { RankingEntry, League } from "@/lib/types";
import Nav from "@/components/Nav";
import RequireAuth from "@/components/RequireAuth";
import Avatar from "@/components/Avatar";

function ClassementContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ligueParam = searchParams.get("ligue");

  const [leagues, setLeagues] = useState<(League & { creatorName?: string })[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingLeagues(true);
    getUserLeagues(user.uid).then((list) => {
      setLeagues(list);
      if (ligueParam && list.some((l) => l.id === ligueParam)) {
        setSelectedLeagueId(ligueParam);
      } else if (list.length > 0) {
        setSelectedLeagueId((prev) => (prev && list.some((l) => l.id === prev) ? prev : list[0].id));
      } else {
        setSelectedLeagueId(null);
      }
      setLoadingLeagues(false);
    });
  }, [user, ligueParam]);

  useEffect(() => {
    if (user && selectedLeagueId) {
      setLoadingRanking(true);
      getRanking(selectedLeagueId).then((r) => {
        setRanking(r);
        setLoadingRanking(false);
      });
      const interval = setInterval(() => {
        getRanking(selectedLeagueId).then(setRanking);
      }, 60_000);
      return () => clearInterval(interval);
    } else if (user && !loadingLeagues && leagues.length === 0) {
      setLoadingRanking(false);
      setRanking([]);
    }
  }, [user, selectedLeagueId, loadingLeagues, leagues.length]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-zinc-900">Classement</h1>
          {leagues.length > 0 && (
            <select
              value={selectedLeagueId ?? ""}
              onChange={(e) => setSelectedLeagueId(e.target.value || null)}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {loadingLeagues ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : leagues.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="mb-4 text-zinc-700">
              Vous n&apos;êtes membre d&apos;aucune ligue. Rejoignez une ligue ou
              créez-en une pour voir le classement.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/ligues"
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Créer une ligue
              </Link>
              <Link
                href="/rejoindre"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Rejoindre une ligue
              </Link>
            </div>
          </div>
        ) : loadingRanking ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : ranking.length === 0 ? (
          <p className="text-zinc-600">
            Aucun pronostic enregistré. Le classement apparaîtra une fois les
            matchs terminés et les scores calculés.
          </p>
        ) : (
          <div className="space-y-2">
            {ranking.map((r) => (
              <div
                key={r.userId}
                className={`flex items-center justify-between rounded-xl border p-4 ${
                  r.userId === user?.uid
                    ? "border-blue-300 bg-blue-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                      r.rank === 1
                        ? "bg-amber-200 text-amber-800"
                        : r.rank === 2
                          ? "bg-zinc-200 text-zinc-700"
                          : r.rank === 3
                            ? "bg-amber-100 text-amber-900"
                            : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {r.rank}
                  </span>
                  <Avatar src={r.userAvatar} name={r.userName} size="md" />
                  <div>
                    <span className="font-medium text-zinc-900">
                      {r.userName}
                      {r.userId === user?.uid && (
                        <span className="ml-2 text-sm text-blue-600">(vous)</span>
                      )}
                    </span>
                    <p className="text-xs text-zinc-500">
                      {r.exactScores} score{r.exactScores > 1 ? "s" : ""} exact
                      {r.exactScores > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {r.totalPoints}
                  {r.potentialPoints > 0 && (
                    <span className="ml-1 text-orange-500">
                      +{r.potentialPoints}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ClassementPage() {
  return (
    <RequireAuth>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-zinc-500">Chargement...</div>
        </div>
      }>
        <ClassementContent />
      </Suspense>
    </RequireAuth>
  );
}
