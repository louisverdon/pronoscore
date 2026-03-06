"use client";

import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Affiche l'avatar utilisateur ou un fallback (initiales) si l'image ne charge pas.
 * N'affiche jamais d'icône cassée : on montre les initiales par défaut, puis la photo
 * uniquement quand elle a réussi à charger (onLoad).
 */
export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const sizeClass = size === "sm" ? "h-8 w-8 text-sm" : "h-10 w-10 text-sm";
  const fallback = (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 ${className}`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );

  if (!src || error) {
    return fallback;
  }

  return (
    <div className={`relative ${sizeClass} shrink-0 ${className}`}>
      {fallback}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`absolute inset-0 h-full w-full rounded-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
