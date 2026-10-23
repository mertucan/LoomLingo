import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { colors, font } from "../components/theme";
import { UsageBar } from "../components/UsageBar";
import { getQuotaStatus } from "../services/quota";
import { getSettings, getStoredApiKey, hasBundledApiKey, saveApiKey, saveSettings } from "../services/settings";
import { createVoice, installPiperVoice, isPiperInstalled, isPiperSupported, PIPER_SIZE_MB, PIPER_VOICES, PiperVoiceId, removePiperVoice } from "../services/voices";
import { GlossaryEntry, Settings, UserFacingError, VoiceId } from "../types";
import { QuotaStatus } from "../utils/quota";

const SAMPLE = "Merhaba. Önce masurayı yerine takın, sonra ipliği gerginlik yayının altından geçirin.";
const RATES = [{ label: "Yavaş", value: 0.85 }, { label: "Normal", value: 0.95 }, { label: "Hızlı", value: 1.05 }];
const PIPER_IDS = Object.keys(PIPER_VOICES) as PiperVoiceId[];

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null); const [key, setKey] = useState(""); const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [source, setSource] = useState(""); const [turkish, setTurkish] = useState(""); const [editingId, setEditingId] = useState<string | null>(null);
  const [piperSupported, setPiperSupported] = useState(false); const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<{ id: PiperVoiceId; progress: number } | null>(null); const [sampling, setSampling] = useState(false);
  const refreshVoices = useCallback(async () => {
    setPiperSupported(await isPiperSupported());
    setInstalled(Object.fromEntries(await Promise.all(PIPER_IDS.map(async id => [id, await isPiperInstalled(id).catch(() => false)] as const))));
  }, []);
  useEffect(() => { void Promise.all([getSettings(), getStoredApiKey(), getQuotaStatus()]).then(([s, k, q]) => { setSettings(s); setKey(k ?? ""); setQuota(q); }); void refreshVoices(); }, [refreshVoices]);
  if (!settings) return null;

  const change = async (patch: Partial<Settings>) => { const next = { ...settings, ...patch }; setSettings(next); await saveSettings(next); };
  const chooseVoice = async (voice: VoiceId) => {
    if (voice === "device" || installed[voice]) { await change({ voice }); return; }
    setDownloading({ id: voice, progress: 0 });
    try { await installPiperVoice(voice, progress => setDownloading({ id: voice, progress })); await refreshVoices(); await change({ voice }); }
    catch (e) { Alert.alert("İndirilemedi", e instanceof UserFacingError ? e.userMessage : "Ses indirilemedi. Tekrar deneyin."); }
    finally { setDownloading(null); }
  };
  const removeVoice = (id: PiperVoiceId) => Alert.alert("Ses silinsin mi?", `${PIPER_VOICES[id].label} sesi telefondan kaldırılır (${PIPER_SIZE_MB} MB yer açılır).`, [{ text: "Vazgeç", style: "cancel" }, { text: "Sil", style: "destructive", onPress: () => void removePiperVoice(id).then(refreshVoices).then(() => settings.voice === id ? change({ voice: "device" }) : undefined) }]);
  const playSample = async () => {
    setSampling(true);
    const { voice, fellBack } = await createVoice(settings.voice, "sample");
    try { await voice.play(await voice.prepare("sample", SAMPLE, settings.speechRate)); if (fellBack) Alert.alert("Bilgi", "Doğal ses hazır değil, telefonun sesi çalındı."); }
    finally { voice.dispose(); setSampling(false); }
  };
  const saveTerm = async () => { if (!source.trim() || !turkish.trim()) return; const term = { id: editingId ?? String(Date.now()), source: source.trim(), turkish: turkish.trim() }; const glossary = editingId ? settings.glossary.map(x => x.id === editingId ? term : x) : [...settings.glossary, term]; await change({ glossary }); setSource(""); setTurkish(""); setEditingId(null); };
  const removeTerm = (id: string) => void change({ glossary: settings.glossary.filter(x => x.id !== id) });

  const voiceOption = (id: VoiceId, label: string, detail: string) => {
    const selected = settings.voice === id; const piper = id !== "device";
    const busy = downloading?.id === id;
    const usable = !piper || piperSupported;
    return <View key={id} style={[styles.voice, selected && styles.voiceSelected]}>
      <Button icon={selected ? "✅" : piper && !installed[id] ? "⬇️" : "⚪"} label={busy ? `İndiriliyor… %${Math.round((downloading?.progress ?? 0) * 100)}` : label} kind={selected ? "primary" : "secondary"} disabled={!usable || !!downloading} onPress={() => void chooseVoice(id)} />
      <Text style={styles.voiceDetail}>{usable ? detail : "Bu ses yalnızca telefona kurulan uygulamada (APK) kullanılabilir."}</Text>
      {piper && installed[id] && !selected && <Text style={styles.link} onPress={() => removeVoice(id as PiperVoiceId)}>Bu sesi sil</Text>}
    </View>;
  };

  return <View style={styles.page}><FlatList ListHeaderComponent={<>
    <Text style={styles.title}>⚙️ Ayarlar</Text>
    {quota && <UsageBar status={quota} detailed />}

    <Text style={styles.heading}>🔊 Türkçe Ses</Text>
    {voiceOption("device", "Telefonun sesi", "Hazır, ek indirme gerekmez. Biraz robotik olabilir.")}
    {PIPER_IDS.map(id => voiceOption(id, `Doğal ses: ${PIPER_VOICES[id].label}`, installed[id] ? "İndirildi. İnternetsiz çalışır." : `Daha doğal erkek sesi. Bir kez ${PIPER_SIZE_MB} MB indirilir (Wi-Fi önerilir).`))}
    <Button icon="🔈" label={sampling ? "Çalıyor…" : "Örnek Dinle"} kind="secondary" disabled={sampling || !!downloading} onPress={() => void playSample()} />
    <Text style={styles.label}>Konuşma hızı</Text>
    <View style={styles.row}>{RATES.map(r => <Button key={r.value} flex label={r.label} kind={settings.speechRate === r.value ? "primary" : "secondary"} onPress={() => void change({ speechRate: r.value })} />)}</View>
    <Text style={styles.help}>Türkçe cümle videoya yetişmezse video kısa bir süre bekler, sonra devam eder. Türkçe ses açıkken videonun kendi sesi kapatılır.</Text>

    <Text style={styles.heading}>🔑 Gemini API anahtarı</Text>
    <Text style={[styles.help, hasBundledApiKey() && styles.ok]}>{hasBundledApiKey() ? "✓ Anahtar uygulamaya yüklü, bir şey girmenize gerek yok." : "Uygulamada yüklü anahtar yok. Lütfen anahtarı aşağıya girin."}</Text>
    <TextInput value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" style={styles.input} placeholder="İsteğe bağlı yedek API anahtarı" />
    <Button label="Yedek Anahtarı Kaydet" kind="secondary" onPress={() => void saveApiKey(key).then(() => Alert.alert("Kaydedildi", "Yedek anahtar telefonun güvenli alanında saklanır."))} />

    <Text style={styles.heading}>📚 Terim Sözlüğü</Text>
    <Text style={styles.help}>Kaynak terim ve Türkçe karşılığını ekleyin. Her çeviride kullanılır.</Text>
    <TextInput value={source} onChangeText={setSource} style={styles.input} placeholder="Kaynak terim (ör. bobbin)" />
    <TextInput value={turkish} onChangeText={setTurkish} style={styles.input} placeholder="Türkçe karşılık (ör. masura)" />
    <Button label={editingId ? "Terimi Güncelle" : "Terim Ekle"} kind="secondary" onPress={() => void saveTerm()} />
  </>} data={settings.glossary} keyExtractor={x => x.id} renderItem={({ item }: { item: GlossaryEntry }) => <View style={styles.term}><Text style={styles.termText}>{item.source} = {item.turkish}</Text><View style={styles.row}><Button flex label="Düzenle" kind="secondary" onPress={() => { setEditingId(item.id); setSource(item.source); setTurkish(item.turkish); }} /><Button flex label="Sil" kind="danger" onPress={() => removeTerm(item.id)} /></View></View>}
    ListFooterComponent={<Button icon="🏠" label="Ana Sayfa" onPress={onBack} />} /></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: font.title, fontWeight: "900", color: "#082F49", marginBottom: 6 },
  heading: { fontSize: font.heading, fontWeight: "900", color: "#082F49", marginTop: 26, marginBottom: 6 },
  label: { fontSize: font.small, fontWeight: "800", color: colors.text, marginTop: 14 },
  input: { backgroundColor: colors.surface, minHeight: 60, borderWidth: 2, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: font.small, marginBottom: 8 },
  help: { fontSize: 17, lineHeight: 25, color: colors.muted, marginVertical: 8 },
  ok: { color: "#166534", fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  voice: { borderRadius: 16, padding: 8, marginVertical: 4 },
  voiceSelected: { backgroundColor: "#DCFCE7" },
  voiceDetail: { fontSize: 16, lineHeight: 23, color: colors.muted, paddingHorizontal: 6 },
  link: { fontSize: 17, color: colors.danger, fontWeight: "700", padding: 6, textDecorationLine: "underline" },
  term: { backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginVertical: 6 },
  termText: { fontSize: font.small, color: colors.text, fontWeight: "700" },
});
