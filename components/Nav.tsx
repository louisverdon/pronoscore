"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Nav() {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blue-600">
          Pronoscore
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <Link
              href="/matchs"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Matchs
            </Link>
            <Link
              href="/pronostics"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Mes pronostics
            </Link>
            <Link
              href="/classement"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Classement
            </Link>
            <div className="flex items-center gap-2">
              {user.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              )}
              <button
                onClick={signOut}
                className="rounded bg-zinc-200 px-3 py-1 text-sm hover:bg-zinc-300"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
