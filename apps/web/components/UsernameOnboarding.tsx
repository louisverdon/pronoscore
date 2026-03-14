"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@pronoscore/shared";

export default function UsernameOnboarding() {
  const { user, updateDisplayName } = useAuth();
  const [input, setInput] = useState("");

  useEffect(() => {
    if (user) {
      setInput(user.displayName ?? user.name ?? "");
    }
  }, [user]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const needsOnboarding =
    user && user.hasCompletedOnboarding === false;

  if (!needsOnboarding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Veuillez saisir un nom d'affichage.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Le nom ne doit pas dépasser 50 caractères.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await updateDisplayName(trimmed);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="mb-2 text-xl font-bold text-zinc-900">
          Bienvenue sur PronoScore !
        </h2>
        <p className="mb-6 text-sm text-zinc-600">
          Choisissez un nom d&apos;affichage visible par vos amis dans le
          classement et sur les pronostics.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Nom d&apos;affichage
            </label>
            <input
              id="displayName"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex : Jean-Marc"
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
              disabled={submitting}
              maxLength={50}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Enregistrement..." : "Valider"}
          </button>
        </form>
      </div>
    </div>
  );
}
