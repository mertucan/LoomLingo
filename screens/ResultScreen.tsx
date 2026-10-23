import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button } from "../components/Button";
import { getSettings, saveSettings } from "../services/settings";
import { Settings, TranslationResult } from "../types";
const stamp = (seconds?: number) => seconds === undefined ? "" : `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
export function ResultScreen({ result, onBack }: { result: TranslationResult; onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null); const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => { void getSettings().then(setSettings); }, []);
  if (!settings) return null;
  const change = async (patch: Partial<Settings>) => { const next = { ...settings, ...patch }; setSettings(next); await saveSettings(next); };
  const text = result.paragraphs.map(p => `${settings.showTimestamps ? `[${stamp(p.startSeconds)}] ` : ""}${showOriginal ? p.original : p.turkish}`).join("\n\n");
  const theme = settings.theme === "dark"; const size = 20 * settings.fontScale;
  return <View style={[styles.page, theme && styles.dark]}><ScrollView contentContainerStyle={styles.content}><Text style={[styles.title, theme && styles.white]}>{result.title}</Text><Text style={[styles.meta, theme && styles.muted]}>Algılanan dil: {result.sourceLanguage} · {result.method === "captions" ? "Altyazıdan çevrildi" : "Videodan çevrildi"}</Text>
    <View style={styles.row}><Button label="A−" kind="secondary" onPress={() => void change({ fontScale: Math.max(.9, settings.fontScale - .1) })} /><Button label="A+" kind="secondary" onPress={() => void change({ fontScale: Math.min(1.8, settings.fontScale + .1) })} /></View>
    <Button label={showOriginal ? "Türkçeyi Göster" : "Orijinal Metni Göster"} kind="secondary" onPress={() => setShowOriginal(!showOriginal)} />
    <View style={styles.option}><Text style={[styles.optionText, theme && styles.white]}>Zaman damgaları</Text><Switch value={settings.showTimestamps} onValueChange={value => void change({ showTimestamps: value })} /></View>
    <View style={styles.option}><Text style={[styles.optionText, theme && styles.white]}>Koyu tema</Text><Switch value={theme} onValueChange={value => void change({ theme: value ? "dark" : "light" })} /></View>
    {result.paragraphs.map((p, i) => <View key={`${p.startSeconds}-${i}`} style={styles.paragraph}>{settings.showTimestamps && <Text style={styles.time}>{stamp(p.startSeconds)}</Text>}<Text selectable style={[styles.copy, { fontSize: size, lineHeight: size * 1.65 }, theme && styles.white]}>{showOriginal ? p.original : p.turkish}</Text></View>)}
    <Button label="Kopyala" kind="secondary" onPress={() => void Clipboard.setStringAsync(text).then(() => Alert.alert("Kopyalandı", "Metin panoya kopyalandı."))} />
    <Button label="Paylaş" kind="secondary" onPress={() => void Share.share({ message: text }).catch(() => Alert.alert("Paylaşılamadı", "Bu telefonda paylaşım şu an kullanılamıyor."))} /><Button label="Ana Sayfaya Dön" onPress={onBack} />
  </ScrollView></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F8FAFC" }, dark: { backgroundColor: "#0F172A" }, content: { padding: 20, paddingBottom: 40 }, title: { fontSize: 27, fontWeight: "800", color: "#082F49" }, meta: { fontSize: 16, color: "#475569", marginVertical: 10 }, row: { flexDirection: "row", gap: 8 }, option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 8 }, optionText: { color: "#0F172A", fontSize: 18, fontWeight: "600" }, paragraph: { marginVertical: 13 }, time: { color: "#0369A1", fontWeight: "800", fontSize: 16, marginBottom: 3 }, copy: { color: "#111827" }, white: { color: "#F8FAFC" }, muted: { color: "#CBD5E1" } });
