import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";

import { useAuth, getUserPredictions } from "@pronoscore/shared";

export default function PronosticsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (user) {
      getUserPredictions(user.uid)
        .then((preds) => setCount(preds.length))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mes pronostics</Text>
      <Text style={styles.text}>
        {count === 0
          ? "Vous n'avez pas encore de pronostic."
          : `${count} pronostic${count > 1 ? "s" : ""} enregistré${count > 1 ? "s" : ""}.`}
      </Text>
      <Text style={styles.hint}>
        Affichage détaillé à venir (journées, points, etc.)
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#18181b" },
  text: { color: "#52525b", marginBottom: 8 },
  hint: { fontSize: 13, color: "#a1a1aa" },
});
