import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorCard } from "../components/ErrorCard";
import { Header } from "../components/Header";
import { ProgressCard } from "../components/ProgressCard";
import { card, colors, font } from "../components/theme";
import { makeSteps } from "../services/assistant";
import { saveCached } from "../services/cache";
import { logEvent } from "../services/log";
import { geminiOptions } from "../services/pipeline";
import { Step, TranslationResult, UserFacingError } from "../types";

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** "Adımlar": the video as a short, numbered list; tapping a step plays the video from there. */
export function StepsScreen({ result, onBack, onPlayFrom, onUpdate }: { result: TranslationResult; onBack: () => void; onPlayFrom: (seconds: number) => void; onUpdate: (r: TranslationResult) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(result.steps ?? null);
  const [progress, setProgress] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null); setProgress("Adımlar hazırlanıyor…");
    try {
      const made = await makeSteps(await geminiOptions(setProgress), result);
      const updated = { ...result, steps: made };
      await saveCached(updated); onUpdate(updated); setSteps(made);
    } catch (e) {
      logEvent(`Adımlar: ${e instanceof Error ? e.message : String(e)}`);
      setError(e instanceof UserFacingError ? e.userMessage : "Adımlar hazırlanamadı. Tekrar deneyin.");
    } finally { setProgress(null); }
  }, [result, onUpdate]);
  // Made once, on first open; afterwards they come from the saved video.
  useEffect(() => { if (!steps) void load(); }, []);

  return <View style={styles.page}>
    <Header title="Adımlar" onBack={onBack} />
    {progress && <View style={styles.padded}><ProgressCard message={progress} /></View>}
    {error && <View style={styles.padded}><ErrorCard message={error} onRetry={() => void load()} /></View>}
    {steps && <FlatList contentContainerStyle={styles.list} data={steps} keyExtractor={(s, i) => `${s.start}-${i}`}
      ListHeaderComponent={<Text style={styles.help}>Bir adıma dokunun, video oradan başlasın.</Text>}
      renderItem={({ item, index }) => <Pressable onPress={() => onPlayFrom(item.start)} accessibilityRole="button" accessibilityLabel={`Adım ${index + 1}: ${item.title}. ${clock(item.start)} anından izle`}
        style={({ pressed }) => [styles.step, pressed && { opacity: 0.7 }]}>
        <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>
          {!!item.detail && <Text style={styles.detail}>{item.detail}</Text>}
          <View style={styles.time}><Ionicons name="play-circle" size={22} color={colors.primary} /><Text style={styles.timeText}>{clock(item.start)}</Text></View>
        </View>
      </Pressable>} />}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, padded: { paddingHorizontal: 16 }, list: { paddingHorizontal: 16, paddingBottom: 30 },
  help: { fontSize: font.caption, color: colors.muted, marginBottom: 6, marginLeft: 4 },
  step: { ...card, flexDirection: "row", gap: 14, padding: 16, marginVertical: 6 },
  number: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  numberText: { color: colors.onPrimary, fontSize: font.body, fontWeight: "800" },
  body: { flex: 1, gap: 6 },
  title: { fontSize: font.body, lineHeight: 27, fontWeight: "800", color: colors.text },
  detail: { fontSize: font.small, lineHeight: 25, color: colors.muted },
  time: { flexDirection: "row", alignItems: "center", gap: 6 }, timeText: { fontSize: font.small, fontWeight: "800", color: colors.primary },
});
