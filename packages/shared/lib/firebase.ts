import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, Firestore, connectFirestoreEmulator } from "firebase/firestore";

// Support both Next.js (NEXT_PUBLIC_*) and Expo (EXPO_PUBLIC_*) env vars
const env = (key: string) =>
  process.env[`NEXT_PUBLIC_${key}`] ?? process.env[`EXPO_PUBLIC_${key}`];

const firebaseConfig = {
  apiKey: env("FIREBASE_API_KEY") ?? "AIzaSyBuildTimePlaceholder0000000000000000000",
  authDomain: env("FIREBASE_AUTH_DOMAIN") ?? "pronoscore.firebaseapp.com",
  projectId: env("FIREBASE_PROJECT_ID") ?? "pronoscore",
  storageBucket: env("FIREBASE_STORAGE_BUCKET") ?? "pronoscore.appspot.com",
  messagingSenderId: env("FIREBASE_MESSAGING_SENDER_ID") ?? "000000000000",
  appId: env("FIREBASE_APP_ID") ?? "1:000000000000:web:0000000000000000000000",
};

export const isFirebaseConfigured =
  !!env("FIREBASE_API_KEY") &&
  !firebaseConfig.apiKey.startsWith("AIzaSyBuildTimePlaceholder") &&
  !!env("FIREBASE_AUTH_DOMAIN") &&
  !!env("FIREBASE_PROJECT_ID") &&
  !!env("FIREBASE_APP_ID");

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true" || process.env.EXPO_PUBLIC_USE_EMULATORS === "true";
  if (useEmulators) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    if (typeof window !== "undefined") {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
} else {
  app = getApps()[0] as FirebaseApp;
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
