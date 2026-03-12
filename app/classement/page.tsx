"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getRanking } from "@/lib/ranking";
import { getUserLeagues, leaveLeague } from "@/lib/leagues";
import type { RankingEntry, League } from "@/lib/types";
import Nav from "@/components/Nav";
import RequireAuth from "@/components/RequireAuth";
import Avatar from "@/components/Avatar";

function ClassementContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const ligueParam = searchParams.get("ligue");

  const [leagues, setLeagues] = useState<(League & { creatorName?: string })[]>([]);
  const [leaguesLoaded, setLeaguesLoaded] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserLeagues(user.uid).then((list) => {
      setLeagues(list);
      setLeaguesLoaded(true);
      if (ligueParam && list.some((l) => l.id === ligueParam)) {
        setSelectedLeagueId(ligueParam);
      } else if (list.length > 0) {
        setSelectedLeagueId((prev) => (prev && list.some((l) => l.id === prev) ? prev : list[0].id));
      }
    });
  }, [user, ligueParam]);

  useEffect(() => {
    if (!user || !leaguesLoaded) return;
    if (!selectedLeagueId) {
      setRanking([]);
      setLoadingRanking(false);
      return;
    }
    setLoadingRanking(true);
    getRanking(selectedLeagueId).then((r) => {
      setRanking(r);
      setLoadingRanking(false);
    });
    const interval = setInterval(() => {
      getRanking(selectedLeagueId).then(setRanking);
    }, 60_000);
    return () => clearInterval(interval);
  }, [user, selectedLeagueId, leaguesLoaded]);

  const handleKickUser = async (userIdToRemove: string) => {
    if (!user || !selectedLeagueId) return;
    if (!window.confirm("Exclure cet utilisateur de la ligue ?")) return;
    setRemovingUserId(userIdToRemove);
    try {
      await leaveLeague(selectedLeagueId, userIdToRemove);
      // Mettre à jour le classement localement
      setRanking((prev) => prev.filter((r) => r.userId !== userIdToRemove));
    } catch (err) {
      console.error("Erreur exclusion membre:", err);
    } finally {
      setRemovingUserId(null);
    }
  };

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
        {loadingRanking ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : ranking.length === 0 ? (
          <p className="text-zinc-600">
            Aucun pronostic enregistré. Le classement apparaîtra une fois les
            matchs terminés et les scores calculés.
          </p>
        ) : (
          <div className="space-y-2">
            {(() => {
              const currentLeague = leagues.find((l) => l.id === selectedLeagueId) || null;
              const isCreator = !!(currentLeague && user && currentLeague.createdBy === user.uid);
              return ranking.map((r) => (
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
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-blue-600">
                      {r.totalPoints}
                      {r.potentialPoints > 0 && (
                        <span className="ml-1 text-orange-500">
                          +{r.potentialPoints}
                        </span>
                      )}
                    </span>
                    {isCreator && r.userId !== user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleKickUser(r.userId)}
                        disabled={removingUserId === r.userId}
                        title="Exclure cet utilisateur de la ligue"
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {removingUserId === r.userId ? "Exclusion..." : "Exclure"}
                      </button>
                    )}
                  </div>
                </div>
              ));
            })()}
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
