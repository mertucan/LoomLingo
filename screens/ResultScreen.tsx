import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../components/Button";
import { colors, font } from "../components/theme";
import { getSettings, saveSettings } from "../services/settings";
import { Settings, TranslationResult } from "../types";
const stamp = (seconds?: number) => seconds === undefined ? "" : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
/** Reading view: the whole translation as paragraphs. */
export function ResultScreen({ result, onBack, onWatch }: { result: TranslationResult; onBack: () => void; onWatch: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null); const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => { void getSettings().then(setSettings); }, []);
  if (!settings) return null;
  const change = async (patch: Partial<Settings>) => { const next = { ...settings, ...patch }; setSettings(next); await saveSettings(next); };
  const text = result.paragraphs.map(p => `${settings.showTimestamps ? `[${stamp(p.startSeconds)}] ` : ""}${showOriginal ? p.original : p.turkish}`).join("\n\n");
  const dark = settings.theme === "dark"; const size = font.body * settings.fontScale;
  return <View style={[styles.page, dark && styles.dark]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={[styles.title, dark && styles.white]}>{result.title}</Text>
    <Text style={[styles.meta, dark && styles.muted]}>Algılanan dil: {result.sourceLanguage} · {result.method === "captions" ? "Altyazıdan çevrildi" : "Videodan çevrildi"}</Text>
    <Button size="large" icon="▶️" label="Videoyu Türkçe İzle" onPress={onWatch} />
    <View style={styles.row}><Button flex label="A−  Küçük" kind="secondary" onPress={() => void change({ fontScale: Math.max(0.8, Math.round((settings.fontScale - 0.1) * 10) / 10) })} /><Button flex label="A+  Büyük" kind="secondary" onPress={() => void change({ fontScale: Math.min(1.8, Math.round((settings.fontScale + 0.1) * 10) / 10) })} /></View>
    <Button label={showOriginal ? "Türkçeyi Göster" : "Orijinal Metni Göster"} kind="secondary" onPress={() => setShowOriginal(!showOriginal)} />
    <View style={styles.option}><Text style={[styles.optionText, dark && styles.white]}>Zaman damgaları</Text><Switch value={settings.showTimestamps} onValueChange={value => void change({ showTimestamps: value })} /></View>
    <View style={styles.option}><Text style={[styles.optionText, dark && styles.white]}>Koyu tema</Text><Switch value={dark} onValueChange={value => void change({ theme: value ? "dark" : "light" })} /></View>
    {result.paragraphs.map((p, i) => <View key={`${p.startSeconds}-${i}`} style={styles.paragraph}>{settings.showTimestamps && <Text style={styles.time}>{stamp(p.startSeconds)}</Text>}<Text selectable style={[styles.copy, { fontSize: size, lineHeight: size * 1.65 }, dark && styles.white]}>{showOriginal ? p.original : p.turkish}</Text></View>)}
    <View style={styles.row}><Button flex icon="📄" label="Kopyala" kind="secondary" onPress={() => void Clipboard.setStringAsync(text).then(() => Alert.alert("Kopyalandı", "Metin panoya kopyalandı."))} />
      <Button flex icon="📤" label="Paylaş" kind="secondary" onPress={() => void Share.share({ message: text }).catch(() => Alert.alert("Paylaşılamadı", "Bu telefonda paylaşım şu an kullanılamıyor."))} /></View>
    <Button icon="🏠" label="Ana Sayfa" onPress={onBack} />
  </ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, dark: { backgroundColor: "#0F172A" }, content: { padding: 20, paddingBottom: 40 }, title: { fontSize: font.heading, fontWeight: "800", color: "#082F49" }, meta: { fontSize: font.small, color: colors.muted, marginVertical: 10 }, row: { flexDirection: "row", gap: 10 }, option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 }, optionText: { color: colors.text, fontSize: font.small, fontWeight: "700" }, paragraph: { marginVertical: 13 }, time: { color: "#0369A1", fontWeight: "800", fontSize: 17, marginBottom: 3 }, copy: { color: "#111827" }, white: { color: "#F8FAFC" }, muted: { color: "#CBD5E1" } });
