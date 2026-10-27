import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import app from "../app.json";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { card, colors, font, radius } from "../components/theme";
import { canReport, logEvent, sendReport } from "../services/log";
import { getSettings, saveSettings } from "../services/settings";
import { createVoice, installPiperVoice, isPiperInstalled, isPiperSupported, PIPER_SIZE_MB, PIPER_VOICES, PiperVoiceId, removePiperVoice } from "../services/voices";
import { Settings, UserFacingError, VoiceId } from "../types";

const SAMPLE = "Merhaba. Önce masurayı yerine takın, sonra ipliği gerginlik yayının altından geçirin.";
const RATES = [{ label: "Yavaş", value: 0.85 }, { label: "Normal", value: 0.95 }, { label: "Hızlı", value: 1.05 }];
const PIPER_IDS = Object.keys(PIPER_VOICES) as PiperVoiceId[];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [source, setSource] = useState(""); const [turkish, setTurkish] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  const [piperSupported, setPiperSupported] = useState(false); const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<{ id: PiperVoiceId; progress: number } | null>(null); const [sampling, setSampling] = useState(false);
  const refreshVoices = useCallback(async () => {
    setPiperSupported(await isPiperSupported());
    setInstalled(Object.fromEntries(await Promise.all(PIPER_IDS.map(async id => [id, await isPiperInstalled(id).catch(() => false)] as const))));
  }, []);
  useEffect(() => { void getSettings().then(setSettings); void refreshVoices(); }, [refreshVoices]);
  if (!settings) return null;

  const change = async (patch: Partial<Settings>) => { const next = { ...settings, ...patch }; setSettings(next); await saveSettings(next); };
  const chooseVoice = async (voice: VoiceId) => {
    if (voice === "device" || installed[voice]) { await change({ voice }); return; }
    setDownloading({ id: voice, progress: 0 });
    try { await installPiperVoice(voice, progress => setDownloading({ id: voice, progress })); await refreshVoices(); await change({ voice }); }
    catch (e) { logEvent(`Ses indirilemedi (${voice}): ${e instanceof Error ? e.message : String(e)}`); Alert.alert("İndirilemedi", e instanceof UserFacingError ? e.userMessage : "Tekrar deneyin."); }
    finally { setDownloading(null); }
  };
  const removeVoice = (id: PiperVoiceId) => Alert.alert("Ses silinsin mi?", `${PIPER_SIZE_MB} MB yer açılır.`, [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: () => void removePiperVoice(id).then(refreshVoices) }]);
  const playSample = async () => {
    setSampling(true);
    const { voice } = await createVoice(settings.voice, "sample");
    try { await voice.play(await voice.prepare("sample", SAMPLE, settings.speechRate)); } finally { voice.dispose(); setSampling(false); }
  };
  const saveTerm = async () => {
    if (!source.trim() || !turkish.trim()) return;
    const term = { id: editingId ?? String(Date.now()), source: source.trim(), turkish: turkish.trim() };
    await change({ glossary: editingId ? settings.glossary.map(x => x.id === editingId ? term : x) : [...settings.glossary, term] });
    setSource(""); setTurkish(""); setEditingId(null);
  };

  const voiceRow = (id: VoiceId, label: string, detail: string) => {
    const selected = settings.voice === id; const piper = id !== "device";
    const usable = !piper || piperSupported; const busy = downloading?.id === id;
    const needsDownload = piper && !installed[id];
    return <Pressable key={id} onPress={() => void chooseVoice(id)} disabled={!usable || !!downloading} accessibilityRole="radio" accessibilityState={{ selected }}
      style={({ pressed }) => [styles.voiceRow, !usable && styles.disabled, pressed && { opacity: 0.6 }]}>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={28} color={colors.primary} />
      <View style={styles.voiceText}><Text style={styles.voiceLabel}>{label}</Text><Text style={styles.voiceDetail}>{usable ? detail : "Yalnızca kurulu uygulamada"}</Text></View>
      {busy ? <Text style={styles.voiceStatus}>%{Math.round((downloading?.progress ?? 0) * 100)}</Text>
        : needsDownload && usable ? <Ionicons name="cloud-download-outline" size={26} color={colors.primary} />
        : piper && installed[id] && !selected ? <Pressable onPress={() => removeVoice(id as PiperVoiceId)} hitSlop={10} accessibilityLabel="Sesi sil"><Ionicons name="trash-outline" size={24} color={colors.danger} /></Pressable> : null}
    </Pressable>;
  };

  return <View style={styles.page}><Header title="Ayarlar" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.section}>Türkçe ses</Text>
    <View style={styles.card}>
      {voiceRow("device", "Telefonun sesi", "Hazır")}
      {PIPER_IDS.map(id => <View key={id}><View style={styles.divider} />{voiceRow(id, `Doğal ses: ${PIPER_VOICES[id].label}`, installed[id] ? "İndirildi" : `${PIPER_SIZE_MB} MB indirilir`)}</View>)}
    </View>
    <Button icon={sampling ? "volume-high" : "play-circle-outline"} label={sampling ? "Çalıyor…" : "Örnek Dinle"} kind="secondary" disabled={sampling || !!downloading} onPress={() => void playSample()} />

    <Text style={styles.section}>Konuşma hızı</Text>
    <View style={styles.segment}>{RATES.map(r => { const on = settings.speechRate === r.value; return <Pressable key={r.value} onPress={() => void change({ speechRate: r.value })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.segmentItem, on && styles.segmentOn]}><Text style={[styles.segmentText, on && { color: colors.onPrimary }]}>{r.label}</Text></Pressable>; })}</View>

    <Text style={styles.section}>Terim sözlüğü</Text>
    <View style={styles.termInput}>
      <TextInput value={source} onChangeText={setSource} style={styles.input} placeholder="bobbin" placeholderTextColor="#94A3B8" autoCapitalize="none" accessibilityLabel="Kaynak terim" />
      <Text style={styles.equals}>=</Text>
      <TextInput value={turkish} onChangeText={setTurkish} style={styles.input} placeholder="masura" placeholderTextColor="#94A3B8" accessibilityLabel="Türkçe karşılık" onSubmitEditing={() => void saveTerm()} />
      <Pressable onPress={() => void saveTerm()} accessibilityRole="button" accessibilityLabel={editingId ? "Kaydet" : "Ekle"} style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}><Ionicons name={editingId ? "checkmark" : "add"} size={30} color={colors.onPrimary} /></Pressable>
    </View>
    {settings.glossary.length > 0 && <View style={styles.card}>{settings.glossary.map((item, i) => <View key={item.id}>
      {i > 0 && <View style={styles.divider} />}
      <View style={styles.termRow}>
        <Text style={styles.termText}>{item.source} <Text style={styles.termArrow}>=</Text> {item.turkish}</Text>
        <Pressable onPress={() => { setEditingId(item.id); setSource(item.source); setTurkish(item.turkish); }} hitSlop={10} accessibilityLabel="Düzenle"><Ionicons name="create-outline" size={24} color={colors.primary} /></Pressable>
        <Pressable onPress={() => void change({ glossary: settings.glossary.filter(x => x.id !== item.id) })} hitSlop={10} accessibilityLabel="Sil"><Ionicons name="trash-outline" size={24} color={colors.danger} /></Pressable>
      </View>
    </View>)}</View>}

    <Text style={styles.section}>Yardım</Text>
    {canReport() && <Button icon="mail-outline" label="Sorun Bildir" kind="secondary" onPress={() => void sendReport().then(ok => { if (!ok) Alert.alert("E-posta uygulaması bulunamadı"); })} />}
    <Text style={styles.version}>Sürüm {app.expo.version}{Updates.updateId ? ` · ${Updates.createdAt?.toLocaleDateString("tr-TR") ?? ""} güncellemesi` : ""}</Text>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { fontSize: font.small, fontWeight: "800", color: colors.muted, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  card: { ...card, paddingHorizontal: 14, marginBottom: 6 },
  divider: { height: 1, backgroundColor: colors.line },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68 },
  voiceText: { flex: 1 }, voiceLabel: { fontSize: font.body, fontWeight: "700", color: colors.text }, voiceDetail: { fontSize: font.caption, color: colors.muted, marginTop: 2 },
  voiceStatus: { fontSize: font.small, fontWeight: "800", color: colors.primary }, disabled: { opacity: 0.45 },
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius, borderWidth: 1.5, borderColor: colors.line, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 54, borderRadius: radius - 4, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.primary }, segmentText: { fontSize: font.body, fontWeight: "700", color: colors.primary },
  termInput: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  input: { ...card, flex: 1, minWidth: 0, minHeight: 58, paddingHorizontal: 12, fontSize: font.small, color: colors.text },
  equals: { fontSize: font.heading, fontWeight: "800", color: colors.muted },
  add: { width: 58, height: 58, borderRadius: radius, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  termRow: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 56 },
  version: { fontSize: font.caption, color: colors.muted, textAlign: "center", marginTop: 8 },
  termText: { flex: 1, fontSize: font.small, fontWeight: "600", color: colors.text }, termArrow: { color: colors.muted },
});
