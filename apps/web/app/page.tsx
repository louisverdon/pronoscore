"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@pronoscore/shared";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/matchs");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  // Afficher le chargement pendant la redirection (vers /login si non connecté, /matchs si connecté)
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  return null;
}
