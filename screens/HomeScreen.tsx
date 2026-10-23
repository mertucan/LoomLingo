import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ErrorCard } from "../components/ErrorCard";
import { ProgressCard } from "../components/ProgressCard";
import { colors, font } from "../components/theme";
import { UsageBar } from "../components/UsageBar";
import { getHistoryItems } from "../services/cache";
import { translateVideo } from "../services/pipeline";
import { getQuotaStatus } from "../services/quota";
import { TranslationResult, UserFacingError } from "../types";
import { QuotaStatus } from "../utils/quota";
import { parseYoutubeLink } from "../utils/youtubeLink";

const confirm = (title: string, message: string) => new Promise<boolean>(resolve =>
  Alert.alert(title, message, [{ text: "Hayır", style: "cancel", onPress: () => resolve(false) }, { text: "Evet, çevir", onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));

type Props = { sharedText: string | null; onSharedTextHandled: () => void; onResult: (r: TranslationResult) => void; onHistory: () => void; onSettings: () => void };
export function HomeScreen({ sharedText, onSharedTextHandled, onResult, onHistory, onSettings }: Props) {
  const [link, setLink] = useState(""); const [progress, setProgress] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null); const [last, setLast] = useState<TranslationResult | null>(null);
  const busy = useRef(false);
  const refresh = useCallback(() => { void getQuotaStatus().then(setQuota).catch(() => undefined); void getHistoryItems().then(items => setLast(items[0] ?? null)).catch(() => undefined); }, []);
  useEffect(refresh, [refresh]);

  const begin = useCallback(async (raw: string) => {
    if (busy.current) return;
    setError(null);
    const parsed = parseYoutubeLink(raw);
    if (!parsed) { setError(raw.trim() ? "Bu bir YouTube video linki değil. YouTube'da videoyu açıp Paylaş → Bağlantıyı kopyala deyin, sonra tekrar deneyin." : "Önce bir YouTube linki kopyalayın."); return; }
    busy.current = true;
    try { const result = await translateVideo(parsed, { onProgress: setProgress, confirm }); if (result) onResult(result); }
    catch (e) { setError(e instanceof UserFacingError ? e.userMessage : "Bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin."); }
    finally { busy.current = false; setProgress(null); refresh(); }
  }, [onResult, refresh]);
  useEffect(() => { if (sharedText) { onSharedTextHandled(); setLink(sharedText); void begin(sharedText); } }, [sharedText, onSharedTextHandled, begin]);
  const pasteAndStart = async () => { const text = await Clipboard.getStringAsync(); setLink(text); await begin(text); };

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Loom Lingo</Text>
    <Text style={styles.intro}>YouTube videolarını Türkçe altyazı ve Türkçe sesle izleyin.</Text>
    <Button size="large" icon="📋" label="Linki Yapıştır ve Başla" onPress={() => void pasteAndStart()} disabled={!!progress} />
    <Text style={styles.hint}>YouTube'da videoyu açın → Paylaş → Bağlantıyı kopyala. Sonra bu butona basın.</Text>
    {progress && <ProgressCard message={progress} />}
    {error && !progress && <ErrorCard message={error} onRetry={() => void begin(link)} />}
    {quota && !progress && <UsageBar status={quota} />}
    {last && !progress && <View style={styles.lastCard}><Text style={styles.lastLabel}>Son video</Text><Text style={styles.lastTitle} numberOfLines={2}>{last.title}</Text><Button icon="▶️" label="Tekrar İzle" kind="secondary" onPress={() => onResult(last)} /></View>}
    <Text style={styles.label}>Ya da linki buraya yazın:</Text>
    <TextInput value={link} onChangeText={setLink} placeholder="https://youtu.be/…" placeholderTextColor="#64748B" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} accessibilityLabel="YouTube video linki" />
    <Button icon="▶️" label="Türkçeye Çevir" kind="secondary" onPress={() => void begin(link)} disabled={!!progress} />
    <View style={styles.bottom}><Button flex icon="🕘" label="Geçmiş" kind="secondary" onPress={onHistory} disabled={!!progress} /><Button flex icon="⚙️" label="Ayarlar" kind="secondary" onPress={onSettings} disabled={!!progress} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, flexGrow: 1, backgroundColor: colors.background },
  title: { fontSize: 36, fontWeight: "900", color: "#082F49", marginTop: 12 },
  intro: { fontSize: font.body, lineHeight: 30, color: colors.muted, marginTop: 6, marginBottom: 20 },
  hint: { fontSize: font.small, lineHeight: 26, color: colors.muted, textAlign: "center", marginBottom: 6 },
  lastCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, padding: 16, marginVertical: 10 },
  lastLabel: { fontSize: font.small, color: colors.muted, fontWeight: "700" },
  lastTitle: { fontSize: font.body, lineHeight: 29, color: colors.text, fontWeight: "800", marginVertical: 6 },
  label: { fontSize: font.small, fontWeight: "700", color: colors.text, marginTop: 18, marginBottom: 8 },
  input: { minHeight: 64, backgroundColor: colors.surface, borderWidth: 2, borderColor: "#0EA5E9", borderRadius: 14, padding: 14, color: colors.text, fontSize: font.small },
  bottom: { flexDirection: "row", gap: 10, marginTop: "auto", paddingTop: 20 },
});
