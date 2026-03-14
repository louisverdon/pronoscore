import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import { useAuth, getPrediction, savePrediction } from "@pronoscore/shared";
import type { Match } from "@pronoscore/shared";

interface MatchCardProps {
  match: Match;
}

export default function MatchCard({ match }: MatchCardProps) {
  const { user } = useAuth();
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [existingPoints, setExistingPoints] = useState<number | undefined>();

  const matchDate = new Date(match.matchDate);
  const isUpcoming =
    match.status === "SCHEDULED" || match.status === "TIMED";
  const isFinished = match.status === "FINISHED";
  const canEdit = isUpcoming && matchDate > new Date();

  useEffect(() => {
    if (!user) return;
    getPrediction(user.uid, match.id).then((pred) => {
      if (pred) {
        setHomeScore(String(pred.homeScore));
        setAwayScore(String(pred.awayScore));
        setExistingPoints(pred.points);
      }
      setLoaded(true);
    });
  }, [user, match.id]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !canEdit || !loaded) return;
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      setSaving(true);
      await savePrediction({
        userId: user.uid,
        matchId: match.id,
        homeScore: h,
        awayScore: a,
        createdAt: new Date().toISOString(),
      });
      setSaving(false);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user, canEdit, loaded, homeScore, awayScore, match.id]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(matchDate)}</Text>
        {isFinished && existingPoints !== undefined && (
          <Text style={styles.points}>
            +{existingPoints} pt{existingPoints > 1 ? "s" : ""}
          </Text>
        )}
      </View>
      <View style={styles.row}>
        <View style={styles.team}>
          {match.homeTeam.crest && (
            <Image
              source={{ uri: match.homeTeam.crest }}
              style={styles.crest}
              resizeMode="contain"
            />
          )}
          <Text style={styles.teamName} numberOfLines={2}>
            {match.homeTeam.name}
          </Text>
        </View>
        <View style={styles.scores}>
          {isFinished ? (
            <Text style={styles.finalScore}>
              {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
            </Text>
          ) : canEdit && loaded ? (
            <View style={styles.inputs}>
              <View style={styles.scoreInputs}>
                <TextInput
                  style={styles.input}
                  value={homeScore}
                  onChangeText={setHomeScore}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="-"
                />
                <Text style={styles.dash}>-</Text>
                <TextInput
                  style={styles.input}
                  value={awayScore}
                  onChangeText={setAwayScore}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="-"
                />
              </View>
              <Text style={[styles.saving, !saving && styles.invisible]}>
                {saving ? "Enregistrement…" : " "}
              </Text>
            </View>
          ) : loaded ? (
            <Text style={styles.prediction}>
              {homeScore || "-"} - {awayScore || "-"}
            </Text>
          ) : (
            <Text style={styles.placeholder}>—</Text>
          )}
        </View>
        <View style={[styles.team, styles.teamAway]}>
          <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={2}>
            {match.awayTeam.name}
          </Text>
          {match.awayTeam.crest && (
            <Image
              source={{ uri: match.awayTeam.crest }}
              style={styles.crest}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  date: { fontSize: 13, color: "#71717a" },
  points: { fontSize: 13, fontWeight: "600", color: "#16a34a" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  team: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamAway: { justifyContent: "flex-end" },
  teamName: { fontSize: 14, fontWeight: "500", color: "#18181b", flex: 1 },
  teamNameRight: { textAlign: "right" },
  crest: { width: 24, height: 24 },
  scores: { minWidth: 100, alignItems: "center" },
  finalScore: { fontSize: 18, fontWeight: "bold", color: "#18181b" },
  prediction: { fontSize: 16, color: "#18181b" },
  placeholder: { fontSize: 16, color: "#a1a1aa" },
  inputs: { alignItems: "center" },
  scoreInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 18,
    color: "#18181b",
  },
  dash: { fontSize: 18, color: "#a1a1aa" },
  saving: { fontSize: 11, color: "#a1a1aa", marginTop: 4, minHeight: 14 },
  invisible: { opacity: 0 },
});
