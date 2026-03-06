"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Wrapper pour les pages protégées. Redirige vers /login si l'utilisateur n'est pas connecté.
 * Évite d'afficher "Chargement..." indéfiniment quand user est null.
 */
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Redirection en cours : ne pas afficher "Chargement..." (on n'attend pas un user)
  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Redirection vers la connexion...</div>
      </div>
    );
  }

  // Vraiment en chargement (Firebase n'a pas encore répondu)
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  return <>{children}</>;
}
