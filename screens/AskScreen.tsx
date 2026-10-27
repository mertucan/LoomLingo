import { Ionicons } from "@expo/vector-icons";
import { RecordingOptions, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ErrorCard } from "../components/ErrorCard";
import { Header } from "../components/Header";
import { card, colors, font, radius } from "../components/theme";
import { Answer, askAboutVideo, Question } from "../services/assistant";
import { logEvent } from "../services/log";
import { geminiOptions } from "../services/pipeline";
import { getSettings } from "../services/settings";
import { createVoice, DubVoice } from "../services/voices";
import { TranslationResult, UserFacingError } from "../types";

/** Mono AAC in an ADTS stream ("audio/aac"), a format Gemini accepts directly. */
const RECORDING: RecordingOptions = { ...RecordingPresets.LOW_QUALITY, extension: ".aac", numberOfChannels: 1, android: { outputFormat: "aac_adts", audioEncoder: "aac" } };
const MAX_RECORDING_MS = 30_000;
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** "Soru sor": ask about the video by voice (or by typing); the answer is shown and read aloud. */
export function AskScreen({ result, onBack, onPlayFrom }: { result: TranslationResult; onBack: () => void; onPlayFrom: (seconds: number) => void }) {
  const recorder = useAudioRecorder(RECORDING); const recording = useAudioRecorderState(recorder, 250);
  const [typed, setTyped] = useState(""); const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null); const [error, setError] = useState<string | null>(null);
  const voice = useRef<DubVoice | null>(null); const finishing = useRef(false);

  useEffect(() => {
    let alive = true;
    void getSettings().then(s => createVoice(s.voice, "answers")).then(({ voice: v }) => { if (alive) voice.current = v; else v.dispose(); });
    return () => { alive = false; voice.current?.dispose(); void recorder.stop().catch(() => undefined); };
  }, [recorder]);
  // Stop by itself after 30 seconds.
  useEffect(() => { if (recording.isRecording && recording.durationMillis > MAX_RECORDING_MS) void finishRecording(); });

  const speak = async (text: string) => {
    const v = voice.current; if (!v) return;
    v.stop(); const settings = await getSettings();
    await v.play(await v.prepare(`answer-${text.length}-${text.slice(0, 20)}`, text, settings.speechRate)).catch(() => undefined);
  };
  const ask = async (question: Question) => {
    setBusy(true); setError(null); setAnswer(null); voice.current?.stop();
    try {
      const reply = await askAboutVideo(await geminiOptions(), result, question);
      setAnswer(reply); void speak(reply.answer);
    } catch (e) {
      logEvent(`Soru: ${e instanceof Error ? e.message : String(e)}`);
      setError(e instanceof UserFacingError ? e.userMessage : "Cevap alınamadı. Tekrar deneyin.");
    } finally { setBusy(false); }
  };
  const startRecording = async () => {
    setError(null); voice.current?.stop();
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) { setError("Mikrofon izni verilmedi. Sorunuzu aşağıya yazabilirsiniz."); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync(); recorder.record();
  };
  async function finishRecording() {
    if (!recorder.isRecording || finishing.current) return;
    finishing.current = true;
    try { await recorder.stop(); } finally { finishing.current = false; }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    if (!recorder.uri) { setError("Ses kaydedilemedi. Tekrar deneyin."); return; }
    const audioBase64 = await FileSystem.readAsStringAsync(recorder.uri, { encoding: FileSystem.EncodingType.Base64 });
    await ask({ audioBase64, mimeType: "audio/aac" });
  }
  const sendTyped = () => { if (typed.trim()) { void ask({ text: typed.trim() }); setTyped(""); } };

  return <View style={styles.page}><Header title="Soru Sor" onBack={onBack} /><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.help}>Videoyla ilgili sorunuzu söyleyin. Örnek: "Gerginliği kaç numaraya ayarladı?"</Text>
    <View style={styles.micArea}>
      <Pressable onPress={() => void (recording.isRecording ? finishRecording() : startRecording())} disabled={busy} accessibilityRole="button"
        accessibilityLabel={recording.isRecording ? "Bitirmek için dokunun" : "Konuşmak için dokunun"}
        style={({ pressed }) => [styles.mic, recording.isRecording && styles.micOn, (pressed || busy) && { opacity: 0.7 }]}>
        {busy ? <ActivityIndicator size="large" color={colors.onPrimary} /> : <Ionicons name={recording.isRecording ? "stop" : "mic"} size={64} color={colors.onPrimary} />}
      </Pressable>
      <Text style={styles.micText}>{busy ? "Cevap hazırlanıyor…" : recording.isRecording ? `Dinliyorum… Bitince dokunun (${Math.floor(recording.durationMillis / 1000)} sn)` : "Konuşmak için dokunun"}</Text>
    </View>

    {error && <ErrorCard message={error} />}
    {answer && <View style={styles.answer}>
      {!!answer.question && <Text style={styles.question}>“{answer.question}”</Text>}
      <Text style={styles.answerText}>{answer.answer}</Text>
      <Button icon="volume-high-outline" label="Tekrar Dinle" kind="secondary" onPress={() => void speak(answer.answer)} />
      {answer.time !== null && <Button icon="play" label={`Videoda Göster (${clock(answer.time)})`} onPress={() => onPlayFrom(answer.time ?? 0)} />}
    </View>}

    <Text style={styles.section}>Ya da yazarak sorun</Text>
    <View style={styles.typeRow}>
      <TextInput value={typed} onChangeText={setTyped} placeholder="Sorunuz…" placeholderTextColor="#94A3B8" style={styles.input} onSubmitEditing={sendTyped} editable={!busy} accessibilityLabel="Soru" />
      <Pressable onPress={sendTyped} disabled={busy} accessibilityRole="button" accessibilityLabel="Sor" style={({ pressed }) => [styles.send, (pressed || busy) && { opacity: 0.6 }]}><Ionicons name="send" size={26} color={colors.onPrimary} /></Pressable>
    </View>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { paddingHorizontal: 16, paddingBottom: 40 },
  help: { fontSize: font.small, lineHeight: 25, color: colors.muted, marginBottom: 8 },
  micArea: { alignItems: "center", gap: 12, marginVertical: 18 },
  mic: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", elevation: 3 },
  micOn: { backgroundColor: colors.danger },
  micText: { fontSize: font.body, fontWeight: "700", color: colors.text, textAlign: "center" },
  answer: { ...card, padding: 18, gap: 10, marginVertical: 10 },
  question: { fontSize: font.small, fontStyle: "italic", color: colors.muted },
  answerText: { fontSize: font.body + 2, lineHeight: 32, fontWeight: "600", color: colors.text },
  section: { fontSize: font.small, fontWeight: "800", color: colors.muted, marginTop: 18, marginBottom: 6, marginLeft: 4 },
  typeRow: { flexDirection: "row", gap: 10 },
  input: { ...card, flex: 1, minWidth: 0, minHeight: 60, paddingHorizontal: 14, fontSize: font.small, color: colors.text },
  send: { width: 60, minHeight: 60, borderRadius: radius, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
