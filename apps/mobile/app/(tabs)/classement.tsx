import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";

import { useAuth, getUserLeagues, getRanking } from "@pronoscore/shared";
import type { RankingEntry, League } from "@pronoscore/shared";

export default function ClassementScreen() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<(League & { creatorName?: string })[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserLeagues(user.uid).then((list) => {
        setLeagues(list);
        if (list.length > 0 && !selectedLeagueId) {
          setSelectedLeagueId(list[0].id);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user || !selectedLeagueId) {
      setRanking([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getRanking(selectedLeagueId).then((r) => {
      setRanking(r);
      setLoading(false);
    });
  }, [user, selectedLeagueId]);

  if (leagues.length === 0 && !loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>
          Rejoignez une ligue pour voir le classement.
        </Text>
      </View>
    );
  }

  if (loading && ranking.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Classement</Text>
      {ranking.length === 0 ? (
        <Text style={styles.text}>
          Aucun pronostic enregistré dans cette ligue.
        </Text>
      ) : (
        ranking.map((r, i) => (
          <View
            key={r.userId}
            style={[
              styles.row,
              r.userId === user?.uid && styles.rowHighlight,
            ]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{r.rank}</Text>
            </View>
            <Text style={styles.name}>
              {r.userName}
              {r.userId === user?.uid ? " (vous)" : ""}
            </Text>
            <Text style={styles.points}>
              {r.totalPoints}
              {r.potentialPoints > 0 && ` +${r.potentialPoints}`}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#18181b" },
  emptyText: { color: "#52525b", textAlign: "center" },
  text: { color: "#52525b", marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  rowHighlight: { borderColor: "#93c5fd", backgroundColor: "#eff6ff" },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f4f4f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankText: {
    fontWeight: "bold",
    color: "#52525b",
    fontSize: 14,
  },
  name: { flex: 1, fontSize: 16, color: "#18181b" },
  points: { fontSize: 18, fontWeight: "bold", color: "#2563eb" },
});
