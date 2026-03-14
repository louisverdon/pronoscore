import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@pronoscore/shared";

export default function LoginScreen() {
  const { user, loading, signInWithGoogle, authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/matchs");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>PronoScore</Text>
        <Text style={styles.subtitle}>
          Connectez-vous pour enregistrer vos pronostics et défier vos amis.
        </Text>
        <Pressable
          onPress={signInWithGoogle}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Connexion avec Google</Text>
        </Pressable>
        {authError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        )}
        <Text style={styles.hint}>
          Note : La connexion Google nécessite un development build (pas Expo Go).
          Utilisez « npx expo run:android » ou « npx expo run:ios ».
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, color: "#71717a" },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#18181b",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#52525b",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3f3f46",
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
  },
  errorText: { color: "#dc2626", fontSize: 14 },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: "#a1a1aa",
    textAlign: "center",
  },
});
