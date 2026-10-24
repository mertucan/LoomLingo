import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Row } from "../components/Button";
import { Header } from "../components/Header";
import { card, colors, font } from "../components/theme";
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
  const fontStep = (delta: number) => void change({ fontScale: Math.min(1.8, Math.max(0.8, Math.round((settings.fontScale + delta) * 10) / 10)) });
  const option = (label: string, value: boolean, onChange: (v: boolean) => void) =>
    <View style={styles.option}><Text style={[styles.optionText, dark && styles.light]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: "#CBD5E1" }} thumbColor="#FFFFFF" /></View>;

  return <View style={[styles.page, dark && styles.dark]}><Header title="Metin" onBack={onBack} /><ScrollView contentContainerStyle={styles.content}>
    <Text style={[styles.title, dark && styles.light]}>{result.title}</Text>
    <Text style={[styles.meta, dark && styles.light]}>{result.sourceLanguage} dilinden çevrildi</Text>
    <Button icon="play" label="Videoyu İzle" onPress={onWatch} />
    <Row><Button flex icon="remove" label="Yazı" kind="secondary" onPress={() => fontStep(-0.1)} /><Button flex icon="add" label="Yazı" kind="secondary" onPress={() => fontStep(0.1)} /></Row>
    <View style={[styles.options, dark && styles.darkCard]}>
      {option("Orijinal dil", showOriginal, setShowOriginal)}
      {option("Zaman", settings.showTimestamps, v => void change({ showTimestamps: v }))}
      {option("Koyu tema", dark, v => void change({ theme: v ? "dark" : "light" }))}
    </View>
    {result.paragraphs.map((p, i) => <View key={`${p.startSeconds}-${i}`} style={styles.paragraph}>
      {settings.showTimestamps && <Text style={styles.time}>{stamp(p.startSeconds)}</Text>}
      <Text selectable style={[styles.copy, { fontSize: size, lineHeight: size * 1.6 }, dark && styles.light]}>{showOriginal ? p.original : p.turkish}</Text>
    </View>)}
    <Row>
      <Button flex icon="copy-outline" label="Kopyala" kind="secondary" onPress={() => void Clipboard.setStringAsync(text).then(() => Alert.alert("Kopyalandı"))} />
      <Button flex icon="share-outline" label="Paylaş" kind="secondary" onPress={() => void Share.share({ message: text }).catch(() => undefined)} />
    </Row>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, dark: { backgroundColor: "#0F172A" }, content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: font.heading, lineHeight: 30, fontWeight: "800", color: colors.text },
  meta: { fontSize: font.caption, color: colors.muted, marginTop: 4, marginBottom: 10 },
  options: { ...card, paddingHorizontal: 16, paddingVertical: 4, marginVertical: 8 }, darkCard: { backgroundColor: "#1E293B" },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 52 },
  optionText: { color: colors.text, fontSize: font.small, fontWeight: "600" },
  paragraph: { marginVertical: 12 },
  time: { color: colors.primary, fontWeight: "800", fontSize: font.caption, marginBottom: 4 },
  copy: { color: colors.text }, light: { color: "#F1F5F9" },
});
