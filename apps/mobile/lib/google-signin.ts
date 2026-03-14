import {
  GoogleSignin,
  type User as GoogleUser,
} from "@react-native-google-signin/google-signin";
import {
  auth,
  isFirebaseConfigured,
} from "@pronoscore/shared";
import {
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";

const env = (key: string) =>
  process.env[`EXPO_PUBLIC_${key}`] ?? "";

export function configureGoogleSignIn() {
  const webClientId = env("GOOGLE_WEB_CLIENT_ID");
  if (!webClientId) {
    console.warn(
      "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID manquant. Google Sign-In désactivé."
    );
    return;
  }
  GoogleSignin.configure({
    webClientId,
    offlineAccess: true,
  });
}

export async function signInWithGoogleNative(): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase non configuré.");
  }
  const result = await GoogleSignin.signIn();
  const idToken = result?.data?.idToken ?? result?.idToken ?? null;
  if (!idToken) {
    throw new Error("Connexion annulée.");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore
  }
}
