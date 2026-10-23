import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ErrorCard } from "../components/ErrorCard";
import { ProgressCard } from "../components/ProgressCard";
import { translateVideo } from "../services/pipeline";
import { TranslationResult, UserFacingError } from "../types";
import { parseYoutubeLink } from "../utils/youtubeLink";

type Props = { sharedText: string | null; onSharedTextHandled: () => void; onResult: (r: TranslationResult) => void; onHistory: () => void; onSettings: () => void };
export function HomeScreen({ sharedText, onSharedTextHandled, onResult, onHistory, onSettings }: Props) {
  const [link, setLink] = useState(""); const [progress, setProgress] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const begin = useCallback(async (raw: string) => {
    if (busy.current) return;
    setError(null);
    const parsed = parseYoutubeLink(raw);
    if (!parsed) { setError("Bu bir YouTube video linki değil. Lütfen linki kontrol edin."); return; }
    busy.current = true;
    try { onResult(await translateVideo(parsed, setProgress)); }
    catch (e) { setError(e instanceof UserFacingError ? e.userMessage : "Bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin."); }
    finally { busy.current = false; setProgress(null); }
  }, [onResult]);
  useEffect(() => { if (sharedText) { onSharedTextHandled(); setLink(sharedText); void begin(sharedText); } }, [sharedText, onSharedTextHandled, begin]);
  const paste = async () => { const text = await Clipboard.getStringAsync(); setLink(text); setError(null); };
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Text style={styles.title}>Loom Lingo</Text><Text style={styles.intro}>YouTube videosundaki anlatımı Türkçe okuyun.</Text>
    <Text style={styles.label}>YouTube video linki</Text><TextInput value={link} onChangeText={setLink} placeholder="Linki buraya yapıştırın" placeholderTextColor="#64748B" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} accessibilityLabel="YouTube video linki" />
    <Button label="Yapıştır" kind="secondary" onPress={() => void paste()} disabled={!!progress} /><Button label="Türkçeye Çevir" onPress={() => void begin(link)} disabled={!!progress} />
    {progress && <ProgressCard message={progress} />}{error && !progress && <ErrorCard message={error} onRetry={() => void begin(link)} />}<View style={styles.bottom}><Button label="Geçmiş" kind="secondary" onPress={onHistory} disabled={!!progress} /><Button label="Ayarlar" kind="secondary" onPress={onSettings} disabled={!!progress} /></View>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: 22, flexGrow: 1, backgroundColor: "#F8FAFC" }, title: { fontSize: 34, fontWeight: "800", color: "#082F49", marginTop: 22 }, intro: { fontSize: 20, lineHeight: 29, color: "#334155", marginTop: 10, marginBottom: 36 }, label: { fontSize: 19, fontWeight: "700", color: "#0F172A", marginBottom: 8 }, input: { minHeight: 118, backgroundColor: "white", borderWidth: 2, borderColor: "#0EA5E9", borderRadius: 14, padding: 15, color: "#0F172A", fontSize: 19, textAlignVertical: "top" }, bottom: { marginTop: "auto", paddingTop: 20 } });
