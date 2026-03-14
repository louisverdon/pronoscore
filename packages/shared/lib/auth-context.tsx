"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  AuthError,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import type { User } from "./types";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  /** Override pour mobile (signInWithPopup n'existe pas sur React Native) */
  signInWithGoogleOverride?: () => Promise<void>;
  /** Appelé avant firebase signOut (ex: déconnexion Google native) */
  signOutOverride?: () => Promise<void>;
}

export function AuthProvider({ children, signInWithGoogleOverride, signOutOverride }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const formatAuthError = (err: unknown) => {
    const e = err as Partial<AuthError> & { message?: string; code?: string };
    const code = e?.code ?? "";
    // Messages orientés utilisateur (mais suffisamment explicites pour debug)
    switch (code) {
      case "auth/unauthorized-domain":
        return "Domaine non autorisé par Firebase (auth/unauthorized-domain).";
      case "auth/operation-not-allowed":
        return "Connexion Google non activée sur Firebase (auth/operation-not-allowed).";
      case "auth/network-request-failed":
        return "Erreur réseau pendant la connexion (auth/network-request-failed).";
      case "auth/user-disabled":
        return "Compte utilisateur désactivé (auth/user-disabled).";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessayez plus tard (auth/too-many-requests).";
      case "auth/popup-blocked":
        return "La fenêtre de connexion a été bloquée. Autorisez les popups ou réessayez.";
      case "auth/cancelled-popup-request":
        return "Connexion annulée.";
      default:
        // "missing initial state" (storage-partitioned, ex: navigateur intégré Messenger/Instagram)
        if (
          e?.message &&
          String(e.message).toLowerCase().includes("missing initial state")
        ) {
          return "Ouvrez ce lien dans Safari ou Chrome (pas dans Messenger/Instagram) pour vous connecter.";
        }
        return e?.message ? String(e.message) : "Erreur de connexion.";
    }
  };

  const firebaseUserToFallbackUser = (fbUser: FirebaseUser): User => {
    const createdAtIso = fbUser.metadata?.creationTime
      ? new Date(fbUser.metadata.creationTime).toISOString()
      : new Date().toISOString();
    return {
      uid: fbUser.uid,
      name: fbUser.displayName || "Utilisateur",
      // Ne force pas l'onboarding ici : Firestore (si dispo) tranchera.
      displayName: fbUser.displayName || undefined,
      email: fbUser.email || "",
      avatar: fbUser.photoURL || undefined,
      createdAt: createdAtIso,
      currentScore: 0,
    };
  };


  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthError(null);
      try {
        if (fbUser) {
          // Fallback immédiat: on considère l'utilisateur connecté même si Firestore est temporairement KO.
          setUser((prev) => prev ?? firebaseUserToFallbackUser(fbUser));

          const userDoc = await getDoc(doc(db, "users", fbUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            const newUser: User = {
              uid: fbUser.uid,
              name: fbUser.displayName || "Utilisateur",
              email: fbUser.email || "",
              ...(fbUser.photoURL ? { avatar: fbUser.photoURL } : {}),
              createdAt: new Date().toISOString(),
              hasCompletedOnboarding: false,
              currentScore: 0,
            };
            // Firestore rejette undefined – on enlève les champs undefined
            const dataForFirestore = Object.fromEntries(
              Object.entries(newUser).filter(([, v]) => v !== undefined)
            );
            await setDoc(doc(db, "users", fbUser.uid), dataForFirestore);
            setUser(newUser);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("onAuthStateChanged:", err);
        // Ne pas bloquer la connexion si Firestore échoue: on garde le fallback user.
        if (fbUser) {
          setUser((prev) => prev ?? firebaseUserToFallbackUser(fbUser));
        }
        setAuthError(
          "Connexion OK, mais impossible de charger votre profil (Firestore)."
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured) {
      const msg =
        "Firebase n'est pas configuré (.env.local). Renseigne NEXT_PUBLIC_FIREBASE_* (web) ou EXPO_PUBLIC_FIREBASE_* (mobile).";
      setAuthError(msg);
      return;
    }
    setAuthError(null);
    try {
      if (signInWithGoogleOverride) {
        await signInWithGoogleOverride();
      } else {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (err: unknown) {
      const msg = formatAuthError(err);
      console.error("signInWithGoogle:", err);
      setAuthError(msg);
    }
  };

  const signOut = async () => {
    if (signOutOverride) await signOutOverride();
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const updateDisplayName = async (displayName: string) => {
    if (!firebaseUser) return;
    const userRef = doc(db, "users", firebaseUser.uid);
    await updateDoc(userRef, {
      displayName: displayName.trim(),
      hasCompletedOnboarding: true,
    });
    setUser((prev) =>
      prev
        ? { ...prev, displayName: displayName.trim(), hasCompletedOnboarding: true }
        : null
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
