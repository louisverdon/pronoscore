"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAuth,
  getLeagueByInviteCode,
  isLeagueMember,
  joinLeague,
} from "@pronoscore/shared";
import type { League } from "@pronoscore/shared";
import Nav from "@/components/Nav";

function RejoindreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const { user, loading } = useAuth();

  const [league, setLeague] = useState<(League & { creatorName?: string }) | null>(null);
  const [leagueLoading, setLeagueLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      setLeagueLoading(false);
      setError("Code d'invitation invalide.");
      return;
    }
    getLeagueByInviteCode(code)
      .then((l) => {
        setLeague(l ?? null);
        setError(l ? "" : "Ligue introuvable.");
      })
      .catch(() => setError("Erreur lors du chargement."))
      .finally(() => setLeagueLoading(false));
  }, [code]);

  useEffect(() => {
    if (user && league && !leagueLoading) {
      isLeagueMember(league.id, user.uid).then((member) => {
        if (member) {
          router.replace(`/classement?ligue=${league.id}`);
        }
      });
    }
  }, [user, league, leagueLoading, router]);

  const handleJoin = async () => {
    if (!user || !league || joining) return;
    setJoining(true);
    setError("");
    try {
      await joinLeague(league.id, user.uid);
      router.replace(`/classement?ligue=${league.id}`);
    } catch (err) {
      console.error("Erreur:", err);
      setError("Impossible de rejoindre la ligue. Réessayez.");
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = () => {
    router.replace("/matchs");
  };

  // Non connecté : redirection vers login avec redirect (si code) ou matchs (sinon)
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(code ? `/login?redirect=${encodeURIComponent(`/rejoindre?code=${code}`)}` : "/login");
      return;
    }
  }, [loading, user, code, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  // En attente d'onboarding : message court, UsernameOnboarding s'affiche au-dessus
  const needsOnboarding = user.hasCompletedOnboarding === false;
  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Nav />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-zinc-600">
            Complétez votre profil ci-dessus, puis vous pourrez rejoindre la
            ligue.
          </p>
        </main>
      </div>
    );
  }

  // Ligue introuvable ou erreur
  if (error && !league) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Nav />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="mb-6 text-red-600">{error}</p>
          <a href="/matchs" className="text-blue-600 hover:underline">
            Retour à l&apos;accueil
          </a>
        </main>
      </div>
    );
  }

  // Chargement ligue
  if (leagueLoading || !league) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement de l&apos;invitation...</div>
      </div>
    );
  }

  // Invitation à rejoindre
  const creatorName = league.creatorName ?? "Un utilisateur";
  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-zinc-900">
            Invitation à rejoindre une ligue
          </h1>
          <p className="mb-6 text-zinc-600">
            <strong>{creatorName}</strong> vous a invité à rejoindre la ligue
            &quot;{league.name}&quot;.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {joining ? "Rejoindre..." : "Rejoindre"}
            </button>
            <button
              onClick={handleCancel}
              disabled={joining}
              className="rounded-xl border border-zinc-300 px-4 py-3 font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </main>
    </div>
  );
}

export default function RejoindrePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    }>
      <RejoindreContent />
    </Suspense>
  );
}
