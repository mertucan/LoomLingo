import { useKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";
import { Button } from "../components/Button";
import { ErrorCard } from "../components/ErrorCard";
import { colors, font } from "../components/theme";
import { DubController, DubView } from "../services/dubController";
import { getSettings, saveSettings } from "../services/settings";
import { createVoice, DubVoice, hasTurkishDeviceVoice } from "../services/voices";
import { Settings, TranslationResult } from "../types";

const TICK_MS = 250;
/** How often (in ticks) the original sound is checked while the Turkish voice is on. */
const SILENCE_CHECK_TICKS = 4;

type Props = { result: TranslationResult; onBack: () => void; onRead: () => void; onRetranslate: () => void };
export function WatchScreen({ result, onBack, onRead, onRetranslate }: Props) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  /** "Büyük ekran": the phone turns sideways, the video fills the screen and the subtitle sits on its lower part. */
  const [big, setBig] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [voice, setVoice] = useState<DubVoice | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false); const [held, setHeld] = useState(false);
  // Volume sent to YouTube while dubbing; flipped between 0 and 1 (both silent) to re-send it.
  const [silentVolume, setSilentVolume] = useState(0); const dubbingRef = useRef(true);
  const [view, setView] = useState<DubView>({ index: -1, text: "", waiting: null });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const player = useRef<YoutubeIframeRef | null>(null); const controller = useRef<DubController | null>(null);
  const cues = result.cues;

  useEffect(() => { void getSettings().then(setSettings); }, []);
  // Create the chosen voice once settings are known; fall back to the phone voice if needed.
  useEffect(() => {
    if (!settings || !cues) return;
    let alive = true; let created: DubVoice | null = null;
    void createVoice(settings.voice, result.videoId).then(async ({ voice: v, fellBack }) => {
      created = v;
      if (!alive) { v.dispose(); return; }
      if (fellBack) setNotice("Doğal ses hazır değil, telefonun sesi kullanılıyor. Ayarlar'dan sesi indirebilirsiniz.");
      else if (settings.voice === "device" && !(await hasTurkishDeviceVoice())) setNotice("Telefonda Türkçe okuma sesi bulunamadı. Ayarlar'dan doğal ses indirin ya da telefon ayarlarında Metin okuma → Türkçe'yi ekleyin.");
      setVoice(v);
    });
    return () => { alive = false; created?.dispose(); };
    // Only the voice choice matters here; other settings change while watching.
  }, [settings?.voice, cues, result.videoId]);
  useEffect(() => {
    if (!voice || !cues || !settings) return;
    const c = new DubController(cues, voice, { pause: () => setHeld(true), resume: () => setHeld(false) }, setView, settings.dubbing, settings.speechRate);
    controller.current = c;
    return () => { c.dispose(); controller.current = null; };
  }, [voice, cues, settings?.speechRate]);

  dubbingRef.current = settings?.dubbing ?? true;
  /**
   * YouTube's player may turn its sound back on when it is started by a tap
   * inside it, ignoring the earlier mute. While the Turkish voice is on, the
   * sound is checked every second and silenced again if needed.
   */
  const enforceSilence = useCallback(async () => {
    if (!dubbingRef.current || !player.current) return;
    const [muted, volume] = await Promise.all([player.current.isMuted(), player.current.getVolume()]).catch((): [boolean, number] => [true, 0]);
    if (!muted && volume > 1) setSilentVolume(v => (v === 0 ? 1 : 0));
  }, []);
  useEffect(() => {
    if (!playing) return;
    let ticks = 0;
    const timer = setInterval(() => {
      void player.current?.getCurrentTime().then(t => controller.current?.tick(t)).catch(() => undefined);
      if (++ticks % SILENCE_CHECK_TICKS === 0) void enforceSilence();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, enforceSilence]);

  const setBigScreen = useCallback((on: boolean) => {
    setBig(on);
    void ScreenOrientation.lockAsync(on ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);
  // Leave the screen upright when leaving this page.
  useEffect(() => () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined); }, []);
  // In big-screen mode the back button first returns to the normal view.
  useEffect(() => {
    if (!big) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setBigScreen(false); return true; });
    return () => subscription.remove();
  }, [big, setBigScreen]);

  const change = async (patch: Partial<Settings>) => { if (!settings) return; const next = { ...settings, ...patch }; setSettings(next); await saveSettings(next); };
  const back10 = async () => { const t = await player.current?.getCurrentTime().catch(() => 0) ?? 0; controller.current?.userPaused(); player.current?.seekTo(Math.max(0, t - 10), true); };
  const toggleDubbing = () => { if (!settings) return; controller.current?.setEnabled(!settings.dubbing); void change({ dubbing: !settings.dubbing }); };
  // The player's own state is the truth: tapping the video plays or pauses it inside YouTube's player,
  // and pauses caused by the voice sync (controller.waiting) are ignored.
  const onState = useCallback((state: string) => {
    if (state === "playing") void enforceSilence();
    if (state === "playing" && !controller.current?.waiting) setPlaying(true);
    if ((state === "paused" || state === "ended") && !controller.current?.waiting) { setPlaying(false); controller.current?.userPaused(); }
  }, [enforceSilence]);

  if (!cues) return <ScrollView contentContainerStyle={styles.page}><Text style={styles.title}>{result.title}</Text><ErrorCard message="Bu video eski bir sürümle çevrildi. Türkçe altyazı ve sesle izlemek için bir kez yeniden çevrilmesi gerekiyor." onRetry={onRetranslate} retryLabel="Yeniden Çevir" /><Button icon="📖" label="Metni Oku" kind="secondary" onPress={onRead} /><Button icon="🏠" label="Ana Sayfa" kind="secondary" onPress={onBack} /></ScrollView>;
  if (!settings) return null;
  const videoWidth = big ? Math.min(width, Math.round(height * 16 / 9)) : width;
  const videoHeight = big ? height : Math.round(width * 9 / 16);
  const size = (big ? 24 : 26) * settings.fontScale;
  const subtitle = view.index < 0 ? "Başlatmak için videonun üstüne dokunun. Türkçe altyazı burada görünecek." : view.text;
  const waiting = view.waiting && <Text style={styles.waiting}>{view.waiting === "voice" ? "⏳ Türkçe anlatım bitiyor, video bekliyor…" : "⏳ Türkçe ses hazırlanıyor…"}</Text>;

  if (playerError) return <ScrollView contentContainerStyle={styles.page}><ErrorCard message={playerError} /><Button icon="▶️" label="YouTube'da Aç" onPress={() => void Linking.openURL(result.url)} /><Button icon="📖" label="Metni Oku" kind="secondary" onPress={onRead} /><Button icon="🏠" label="Ana Sayfa" kind="secondary" onPress={onBack} /></ScrollView>;
  return <View style={[styles.root, big && styles.bigRoot]}>
    <StatusBar hidden={big} />
    <View style={{ width: videoWidth, height: videoHeight }}>
      <YoutubePlayer ref={player} height={videoHeight} width={videoWidth} videoId={result.videoId} play={playing && !held} mute={settings.dubbing} volume={settings.dubbing ? silentVolume : 100}
        initialPlayerParams={{ controls: false, rel: false, preventFullScreen: true, iv_load_policy: 3 }} forceAndroidAutoplay onChangeState={onState}
        onError={(e: string) => { setPlaying(false); setPlayerError(e === "embed_not_allowed" ? "Bu videonun sahibi, videonun başka uygulamalarda oynatılmasına izin vermiyor. Türkçe metni okuyabilir ya da videoyu YouTube'da açabilirsiniz." : "Video oynatılamadı. İnternet bağlantısını kontrol edin ya da videoyu YouTube'da açın."); }} />
      {big && view.index >= 0 && <View style={styles.overlay} pointerEvents="none"><Text style={[styles.subtitle, { fontSize: size, lineHeight: size * 1.35 }]}>{subtitle}</Text>{waiting}</View>}
      {big && <Pressable style={styles.exitBig} onPress={() => setBigScreen(false)} accessibilityRole="button" accessibilityLabel="Küçült"><Text style={styles.exitBigText}>✕ Küçült</Text></Pressable>}
    </View>
    {!big && <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.subtitleBox} accessibilityLiveRegion="polite">
        <Text style={[styles.subtitle, { fontSize: size, lineHeight: size * 1.4 }]}>{subtitle}</Text>
        {waiting}
      </View>
      <View style={styles.padded}>
        {notice && <Text style={styles.notice}>ℹ️  {notice}</Text>}
        <Button size="large" icon="⛶" label="Büyük Ekran" onPress={() => setBigScreen(true)} />
        <Button icon="⏪" label="10 saniye geri" kind="secondary" onPress={() => void back10()} />
        <Button icon={settings.dubbing ? "🔊" : "🔇"} label={settings.dubbing ? "Türkçe Ses: AÇIK" : "Türkçe Ses: KAPALI"} kind={settings.dubbing ? "primary" : "secondary"} onPress={toggleDubbing} />
        <View style={styles.row}><Button flex label="A−  Küçük yazı" kind="secondary" onPress={() => void change({ fontScale: Math.max(0.8, Math.round((settings.fontScale - 0.1) * 10) / 10) })} /><Button flex label="A+  Büyük yazı" kind="secondary" onPress={() => void change({ fontScale: Math.min(1.8, Math.round((settings.fontScale + 0.1) * 10) / 10) })} /></View>
        <View style={styles.row}><Button flex icon="📖" label="Metni Oku" kind="secondary" onPress={onRead} /><Button flex icon="🏠" label="Ana Sayfa" kind="secondary" onPress={onBack} /></View>
        <Text style={styles.meta}>{result.title} · Algılanan dil: {result.sourceLanguage}</Text>
      </View>
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  page: { padding: 20, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  bigRoot: { backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 24, paddingVertical: 10 },
  exitBig: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  exitBigText: { color: "#fff", fontSize: font.small, fontWeight: "800" },
  content: { paddingBottom: 30, backgroundColor: colors.background },
  padded: { paddingHorizontal: 16 },
  title: { fontSize: font.heading, fontWeight: "800", color: colors.text, marginBottom: 10 },
  subtitleBox: { backgroundColor: colors.subtitleBackground, minHeight: 190, paddingHorizontal: 18, paddingVertical: 16, justifyContent: "center", marginBottom: 10 },
  subtitle: { color: colors.subtitleText, fontWeight: "700", textAlign: "center" },
  waiting: { color: "#FDE68A", fontSize: font.small, textAlign: "center", marginTop: 10, fontWeight: "700" },
  notice: { fontSize: font.small, lineHeight: 26, color: colors.warning, fontWeight: "700", marginVertical: 6 },
  row: { flexDirection: "row", gap: 10 },
  meta: { fontSize: 16, color: colors.muted, marginTop: 10, textAlign: "center" },
});
