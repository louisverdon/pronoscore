"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createLeague, getUserLeagues } from "@/lib/leagues";
import type { League } from "@/lib/types";
import Nav from "@/components/Nav";
import RequireAuth from "@/components/RequireAuth";

function LiguesPageContent() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<(League & { creatorName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createdLeague, setCreatedLeague] = useState<(League & { creatorName?: string }) | null>(null);

  useEffect(() => {
    if (user) {
      getUserLeagues(user.uid).then((list) => {
        setLeagues(list);
        setLoading(false);
      });
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const league = await createLeague(newName.trim(), user.uid);
      setCreatedLeague({ ...league, creatorName: user.displayName ?? user.name });
      setLeagues((prev) => [{ ...league, creatorName: user.displayName ?? user.name }, ...prev]);
      setNewName("");
    } catch (err) {
      console.error("Erreur création ligue:", err);
    } finally {
      setCreating(false);
    }
  };

  const inviteUrl = typeof window !== "undefined" && createdLeague
    ? `${window.location.origin}/rejoindre?code=${createdLeague.inviteCode}`
    : "";

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-zinc-900">Mes ligues</h1>

        {/* Créer une ligue */}
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-800">
            Créer une ligue
          </h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom de la ligue"
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              maxLength={50}
              disabled={creating}
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Création..." : "Créer"}
            </button>
          </form>
        </div>

        {/* Lien à partager après création */}
        {createdLeague && (
          <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-6">
            <p className="mb-2 font-medium text-green-800">
              Ligue &quot;{createdLeague.name}&quot; créée !
            </p>
            <p className="mb-3 text-sm text-green-700">
              Partagez ce lien à vos amis pour qu&apos;ils rejoignent :
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm text-zinc-900"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Copier
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreatedLeague(null)}
              className="mt-3 text-sm text-green-700 underline hover:text-green-900"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Liste des ligues */}
        <h2 className="mb-4 text-lg font-semibold text-zinc-800">
          Mes ligues
        </h2>
        {loading ? (
          <div className="text-zinc-500">Chargement...</div>
        ) : leagues.length === 0 ? (
          <p className="text-zinc-600">
            Vous n&apos;êtes dans aucune ligue. Créez-en une ou rejoignez-en une
            via un lien d&apos;invitation.
          </p>
        ) : (
          <div className="space-y-2">
            {leagues.map((league) => {
              const inviteUrl =
                typeof window !== "undefined"
                  ? `${window.location.origin}/rejoindre?code=${league.inviteCode}`
                  : "";
              return (
                <div
                  key={league.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <a
                    href={`/classement?ligue=${league.id}`}
                    className="flex-1 min-w-0"
                  >
                    <span className="font-medium">{league.name}</span>
                    {league.creatorName && (
                      <span className="ml-2 text-sm text-zinc-500">
                        (créée par {league.creatorName})
                      </span>
                    )}
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (inviteUrl) {
                        navigator.clipboard.writeText(inviteUrl);
                        const btn = e.currentTarget;
                        const prev = btn.textContent;
                        btn.textContent = "Copié !";
                        btn.classList.add("bg-green-600");
                        btn.classList.remove("bg-blue-600");
                        setTimeout(() => {
                          btn.textContent = prev;
                          btn.classList.remove("bg-green-600");
                          btn.classList.add("bg-blue-600");
                        }, 1500);
                      }
                    }}
                    title="Copier le lien d'invitation"
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Lien d&apos;invitation
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function LiguesPage() {
  return (
    <RequireAuth>
      <LiguesPageContent />
    </RequireAuth>
  );
}
