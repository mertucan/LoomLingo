import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ErrorCard } from "../components/ErrorCard";
import { Header } from "../components/Header";
import { ProgressCard } from "../components/ProgressCard";
import { card, colors, font, radius } from "../components/theme";
import { logEvent } from "../services/log";
import { geminiOptions } from "../services/pipeline";
import { FoundVideo, searchInTurkish } from "../services/search";
import { UserFacingError } from "../types";

const EXAMPLES = ["Overlok iplik takma", "Masura gerginliği ayarı", "Dikiş makinesi iplik koparıyor"];

/** "Video Ara": search YouTube in Turkish; English, Hindi and Turkish videos come back with Turkish titles. */
export function SearchScreen({ onBack, onPick }: { onBack: () => void; onPick: (url: string) => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<FoundVideo[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const search = async (text = query) => {
    if (!text.trim() || progress) return;
    setQuery(text); setError(null); setResults(null);
    try { setResults(await searchInTurkish(await geminiOptions(setProgress), text.trim(), setProgress)); }
    catch (e) {
      logEvent(`Arama "${text}": ${e instanceof Error ? e.message : String(e)}`);
      setError(e instanceof UserFacingError ? e.userMessage : "Arama yapılamadı. Tekrar deneyin.");
    } finally { setProgress(null); }
  };

  return <View style={styles.page}>
    <Header title="Video Ara" onBack={onBack} />
    <View style={styles.padded}>
      <View style={styles.searchRow}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Ne arıyorsunuz?" placeholderTextColor="#94A3B8" style={styles.input} returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel="Arama" />
        <Pressable onPress={() => void search()} disabled={!!progress} accessibilityRole="button" accessibilityLabel="Ara" style={({ pressed }) => [styles.go, (pressed || !!progress) && { opacity: 0.6 }]}><Ionicons name="search" size={28} color={colors.onPrimary} /></Pressable>
      </View>
      {!results && !progress && !error && <>
        <Text style={styles.help}>Türkçe yazın; İngilizce, Hintçe ve Türkçe videolar aranır. Örnekler:</Text>
        {EXAMPLES.map(example => <Pressable key={example} onPress={() => void search(example)} style={({ pressed }) => [styles.example, pressed && { opacity: 0.7 }]}><Ionicons name="search-outline" size={20} color={colors.primary} /><Text style={styles.exampleText}>{example}</Text></Pressable>)}
      </>}
      {progress && <ProgressCard message={progress} />}
      {error && <ErrorCard message={error} onRetry={() => void search()} />}
    </View>
    {results && <FlatList contentContainerStyle={styles.list} data={results} keyExtractor={r => r.videoId}
      ListHeaderComponent={<Text style={styles.help}>Bir videoya dokunun, Türkçeye çevrilsin.</Text>}
      renderItem={({ item }) => <Pressable onPress={() => onPick(`https://www.youtube.com/watch?v=${item.videoId}`)} accessibilityRole="button" accessibilityLabel={`${item.turkishTitle}, ${item.lengthText}`}
        style={({ pressed }) => [styles.result, pressed && { opacity: 0.75 }]}>
        <View>
          <Image source={{ uri: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` }} style={styles.thumb} />
          <Text style={styles.length}>{item.lengthText}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={3}>{item.turkishTitle}</Text>
          <Text style={styles.channel} numberOfLines={1}>{item.channel}</Text>
        </View>
      </Pressable>} />}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, padded: { paddingHorizontal: 16 }, list: { paddingHorizontal: 16, paddingBottom: 30 },
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  input: { ...card, flex: 1, minWidth: 0, minHeight: 60, paddingHorizontal: 16, fontSize: font.body, color: colors.text },
  go: { width: 60, minHeight: 60, borderRadius: radius, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  help: { fontSize: font.caption, color: colors.muted, marginVertical: 8, marginLeft: 4 },
  example: { ...card, flexDirection: "row", alignItems: "center", gap: 10, padding: 16, marginVertical: 5 },
  exampleText: { fontSize: font.body, color: colors.primary, fontWeight: "700" },
  result: { ...card, flexDirection: "row", gap: 12, padding: 10, marginVertical: 6, alignItems: "center" },
  thumb: { width: 140, height: 79, borderRadius: 10, backgroundColor: colors.line },
  length: { position: "absolute", right: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 13, fontWeight: "700", paddingHorizontal: 5, borderRadius: 4 },
  body: { flex: 1, gap: 4 },
  title: { fontSize: font.small, lineHeight: 23, fontWeight: "700", color: colors.text },
  channel: { fontSize: font.caption, color: colors.muted },
});
