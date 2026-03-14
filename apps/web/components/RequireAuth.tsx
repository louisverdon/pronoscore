"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@pronoscore/shared";

/**
 * Wrapper pour les pages protégées. Redirige vers /login si l'utilisateur n'est pas connecté.
 * Transmet la page actuelle en paramètre redirect pour y revenir après connexion.
 */
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = pathname && pathname !== "/" ? pathname : "";
      router.replace(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login");
    }
  }, [loading, user, router, pathname]);

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
