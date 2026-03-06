"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRanking } from "@/lib/ranking";
import type { RankingEntry } from "@/lib/types";
import Nav from "@/components/Nav";
import RequireAuth from "@/components/RequireAuth";
import Avatar from "@/components/Avatar";

function ClassementPageContent() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(true);

  useEffect(() => {
    if (user) {
      getRanking().then((r) => {
        setRanking(r);
        setLoadingRanking(false);
      });
      const interval = setInterval(() => {
        getRanking().then(setRanking);
      }, 60_000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">Classement</h1>
        {loadingRanking ? (
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
                    <span className="font-medium">
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
      <ClassementPageContent />
    </RequireAuth>
  );
}
