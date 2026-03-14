import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { useAuth, getUpcomingMatches } from "@pronoscore/shared";
import type { Match } from "@pronoscore/shared";
import MatchCard from "@/components/MatchCard";

export default function MatchsScreen() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUpcomingMatches()
        .then(setMatches)
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Chargement des matchs...</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          Aucun match à venir. Les matchs sont synchronisés automatiquement.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Prochains matchs</Text>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#18181b",
  },
  loadingText: { marginTop: 12, color: "#71717a" },
  emptyText: { color: "#52525b", textAlign: "center" },
});
