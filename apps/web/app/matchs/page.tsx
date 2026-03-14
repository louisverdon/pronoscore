"use client";

import { useEffect, useState } from "react";
import { useAuth, getUpcomingMatches } from "@pronoscore/shared";
import type { Match } from "@pronoscore/shared";
import MatchCard from "@/components/MatchCard";
import Nav from "@/components/Nav";
import RequireAuth from "@/components/RequireAuth";

function MatchsPageContent() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    if (user) {
      getUpcomingMatches().then((u) => {
        setUpcoming(u);
        setLoadingMatches(false);
      });
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">
          Prochains matchs
        </h1>
        {loadingMatches ? (
          <div className="text-zinc-500">Chargement des matchs...</div>
        ) : upcoming.length === 0 ? (
          <p className="text-zinc-600">
            Aucun match à venir. Les matchs sont synchronisés automatiquement.
          </p>
        ) : (
          <div className="space-y-4">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MatchsPage() {
  return (
    <RequireAuth>
      <MatchsPageContent />
    </RequireAuth>
  );
}
