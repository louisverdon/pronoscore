"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUpcomingMatches } from "@/lib/matches";
import MatchCard from "@/components/MatchCard";
import type { Match } from "@/lib/types";
import Nav from "@/components/Nav";

export default function MatchsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }
    if (user) {
      getUpcomingMatches().then((u) => {
        setUpcoming(u);
        setLoadingMatches(false);
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
              <MatchCard key={m.id} match={m} showPronosticsLink={false} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
