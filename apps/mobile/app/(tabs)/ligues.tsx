import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Share,
  Alert,
} from "react-native";

import {
  useAuth,
  createLeague,
  getUserLeagues,
  leaveLeague,
} from "@pronoscore/shared";
import type { League } from "@pronoscore/shared";

export default function LiguesScreen() {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<(League & { creatorName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (user) {
      getUserLeagues(user.uid).then((list) => {
        setLeagues(list);
        setLoading(false);
      });
    }
  }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const league = await createLeague(newName.trim(), user.uid);
      setLeagues((prev) => [
        { ...league, creatorName: user.displayName ?? user.name },
        ...prev,
      ]);
      setNewName("");
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const shareInvite = (league: League) => {
    const url = `https://pronoscore.web.app/rejoindre?code=${league.inviteCode}`;
    Share.share({
      message: `Rejoins ma ligue "${league.name}" sur PronoScore ! ${url}`,
      url,
      title: `Invitation ${league.name}`,
    });
  };

  const handleLeave = (league: League) => {
    if (!user) return;
    Alert.alert(
      "Quitter la ligue",
      `Voulez-vous quitter "${league.name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            await leaveLeague(league.id, user.uid);
            setLeagues((prev) => prev.filter((l) => l.id !== league.id));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mes ligues</Text>

      <View style={styles.createBox}>
        <Text style={styles.subtitle}>Créer une ligue</Text>
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Nom de la ligue"
            placeholderTextColor="#a1a1aa"
            maxLength={50}
            editable={!creating}
          />
          <Pressable
            onPress={handleCreate}
            disabled={creating || !newName.trim()}
            style={[
              styles.button,
              (creating || !newName.trim()) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.buttonText}>
              {creating ? "…" : "Créer"}
            </Text>
          </Pressable>
        </View>
      </View>

      {leagues.length === 0 ? (
        <Text style={styles.emptyText}>
          Créez une ligue ou rejoignez-en une via un lien d'invitation.
        </Text>
      ) : (
        leagues.map((league) => (
          <View key={league.id} style={styles.leagueCard}>
            <Text style={styles.leagueName}>{league.name}</Text>
            {league.creatorName && (
              <Text style={styles.creator}>créée par {league.creatorName}</Text>
            )}
            <View style={styles.leagueActions}>
              <Pressable
                onPress={() => shareInvite(league)}
                style={styles.actionButton}
              >
                <Text style={styles.actionText}>Partager</Text>
              </Pressable>
              <Pressable
                onPress={() => handleLeave(league)}
                style={[styles.actionButton, styles.actionDanger]}
              >
                <Text style={styles.actionDangerText}>Quitter</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#18181b" },
  subtitle: { fontSize: 16, fontWeight: "600", marginBottom: 12, color: "#27272a" },
  createBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 24,
  },
  createRow: { flexDirection: "row", gap: 12 },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#18181b",
  },
  button: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  emptyText: { color: "#52525b", marginBottom: 16 },
  leagueCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 12,
  },
  leagueName: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  creator: { fontSize: 13, color: "#71717a", marginTop: 4 },
  leagueActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  actionButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionText: { color: "#fff", fontWeight: "500" },
  actionDanger: { backgroundColor: "#fef2f2" },
  actionDangerText: { color: "#dc2626", fontWeight: "500" },
});
