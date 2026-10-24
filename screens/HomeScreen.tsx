import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Row, Tile } from "../components/Button";
import { ErrorCard } from "../components/ErrorCard";
import { ProgressCard } from "../components/ProgressCard";
import { card, colors, font, radius } from "../components/theme";
import { VideoCard } from "../components/VideoCard";
import { getHistoryItems } from "../services/cache";
import { translateVideo } from "../services/pipeline";
import { quotaUsedUpUntil } from "../services/quota";
import { TranslationResult, UserFacingError } from "../types";
import { parseYoutubeLink } from "../utils/youtubeLink";

const confirm = (title: string, message: string) => new Promise<boolean>(resolve =>
  Alert.alert(title, message, [{ text: "Hayır", style: "cancel", onPress: () => resolve(false) }, { text: "Evet", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));

type Props = { sharedText: string | null; onSharedTextHandled: () => void; onResult: (r: TranslationResult) => void; onHistory: () => void; onSettings: () => void };
export function HomeScreen({ sharedText, onSharedTextHandled, onResult, onHistory, onSettings }: Props) {
  const [link, setLink] = useState(""); const [progress, setProgress] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [usedUpUntil, setUsedUpUntil] = useState<string | null>(null); const [last, setLast] = useState<TranslationResult | null>(null);
  const busy = useRef(false);
  const refresh = useCallback(() => { void quotaUsedUpUntil().then(setUsedUpUntil).catch(() => undefined); void getHistoryItems().then(items => setLast(items[0] ?? null)).catch(() => undefined); }, []);
  useEffect(refresh, [refresh]);

  const begin = useCallback(async (raw: string) => {
    if (busy.current) return;
    setError(null);
    const parsed = parseYoutubeLink(raw);
    if (!parsed) { setError(raw.trim() ? "Bu bir YouTube linki değil." : "Önce YouTube'dan bir link kopyalayın."); return; }
    busy.current = true;
    try { const result = await translateVideo(parsed, { onProgress: setProgress, confirm }); if (result) onResult(result); }
    catch (e) { setError(e instanceof UserFacingError ? e.userMessage : "Bir sorun oluştu. Tekrar deneyin."); }
    finally { busy.current = false; setProgress(null); refresh(); }
  }, [onResult, refresh]);
  useEffect(() => { if (sharedText) { onSharedTextHandled(); setLink(sharedText); void begin(sharedText); } }, [sharedText, onSharedTextHandled, begin]);
  const pasteAndStart = async () => { const text = await Clipboard.getStringAsync(); setLink(text); await begin(text); };

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}>
      <Image source={require("../assets/icon.png")} style={styles.logo} />
      <View><Text style={styles.title}>Loom Lingo</Text><Text style={styles.subtitle}>YouTube videolarını Türkçe izleyin</Text></View>
    </View>

    <Button size="large" icon="clipboard-outline" label="Linki Yapıştır ve Başla" onPress={() => void pasteAndStart()} disabled={!!progress} />
    <Text style={styles.hint}>YouTube'da Paylaş → Bağlantıyı kopyala, sonra bu butona basın.</Text>

    {progress && <ProgressCard message={progress} />}
    {error && !progress && <ErrorCard message={error} onRetry={() => void begin(link)} />}
    {usedUpUntil && !progress && !error && <ErrorCard tone="warning" message={`Bugünkü çeviri hakkı doldu, ${usedUpUntil} yenilenir. Geçmişteki videolar izlenebilir.`} />}

    {last && !progress && <><Text style={styles.section}>Son video</Text><VideoCard item={last} detail={`${last.sourceLanguage} · Türkçe`} onPress={() => onResult(last)} /></>}

    <Text style={styles.section}>Ya da linki yazın</Text>
    <View style={styles.linkRow}>
      <TextInput value={link} onChangeText={setLink} placeholder="youtu.be/…" placeholderTextColor="#94A3B8" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} accessibilityLabel="YouTube linki" onSubmitEditing={() => void begin(link)} />
      <Pressable onPress={() => void begin(link)} disabled={!!progress} accessibilityRole="button" accessibilityLabel="Çevir" style={({ pressed }) => [styles.go, (pressed || !!progress) && { opacity: 0.6 }]}><Ionicons name="arrow-forward" size={28} color={colors.onPrimary} /></Pressable>
    </View>

    <View style={styles.bottom}><Row><Tile icon="time-outline" label="Geçmiş" onPress={onHistory} /><Tile icon="settings-outline" label="Ayarlar" onPress={onSettings} /></Row></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, flexGrow: 1, backgroundColor: colors.background },
  brand: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8, marginBottom: 24 },
  logo: { width: 60, height: 60, borderRadius: 14 },
  title: { fontSize: font.title, fontWeight: "900", color: colors.primary },
  subtitle: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  hint: { fontSize: font.caption, lineHeight: 21, color: colors.muted, textAlign: "center", marginTop: 2, marginBottom: 8 },
  section: { fontSize: font.small, fontWeight: "800", color: colors.muted, marginTop: 18, marginBottom: 4 },
  linkRow: { flexDirection: "row", gap: 10, marginVertical: 6 },
  input: { ...card, flex: 1, minWidth: 0, minHeight: 60, paddingHorizontal: 16, color: colors.text, fontSize: font.small },
  go: { width: 60, minHeight: 60, borderRadius: radius, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bottom: { marginTop: "auto", paddingTop: 22 },
});
