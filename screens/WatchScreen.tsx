import { useKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Row, Tile } from "../components/Button";
import { Header } from "../components/Header";
import { ErrorCard } from "../components/ErrorCard";
import { colors, font } from "../components/theme";
import { VideoStatus, YoutubeVideo, YoutubeVideoHandle } from "../components/YoutubeVideo";
import { DubController, DubView } from "../services/dubController";
import { logEvent } from "../services/log";
import { getSettings, saveSettings } from "../services/settings";
import { createVoice, DubVoice, hasTurkishDeviceVoice } from "../services/voices";
import { Settings, TranslationResult } from "../types";

/** `startAt`: where the video opens (a chosen step, or where the user left it). Leaving for another page reports the current time. */
type Props = { result: TranslationResult; startAt: number; onBack: () => void; onRead: (time: number) => void; onSteps: (time: number) => void; onAsk: (time: number) => void; onRetranslate: () => void };
export function WatchScreen({ result, startAt, onBack, onRead, onSteps, onAsk, onRetranslate }: Props) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  /** "Büyük ekran": the phone turns sideways, the video fills the screen and the subtitle sits on its lower part. */
  const [big, setBig] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [voice, setVoice] = useState<DubVoice | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [ad, setAd] = useState(false);
  const lastTime = useRef(startAt); const wasPlaying = useRef(false);
  const [prepared, setPrepared] = useState<{ ready: number; total: number } | null>(null);
  const [view, setView] = useState<DubView>({ index: -1, text: "", waiting: null });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const video = useRef<YoutubeVideoHandle | null>(null); const controller = useRef<DubController | null>(null);
  const cues = result.cues;

  useEffect(() => { void getSettings().then(setSettings); }, []);
  // Create the chosen voice once settings are known; fall back to the phone voice if needed.
  useEffect(() => {
    if (!settings || !cues) return;
    let alive = true; let created: DubVoice | null = null;
    void createVoice(settings.voice, result.videoId).then(async ({ voice: v, fellBack }) => {
      created = v;
      if (!alive) { v.dispose(); return; }
      if (fellBack) { setNotice("Doğal ses hazır değil; telefonun sesi kullanılıyor."); logEvent(`Doğal ses açılamadı (${settings.voice})`); }
      else if (settings.voice === "device" && !(await hasTurkishDeviceVoice())) setNotice("Telefonda Türkçe ses yok. Ayarlar'dan doğal ses indirin.");
      setVoice(v);
    });
    return () => { alive = false; created?.dispose(); };
    // Only the voice choice matters here; other settings change while watching.
  }, [settings?.voice, cues, result.videoId]);
  useEffect(() => {
    if (!voice || !cues || !settings) return;
    const c = new DubController(cues, voice, { pause: () => video.current?.pause(), resume: () => video.current?.play() }, setView, settings.dubbing, settings.speechRate);
    controller.current = c;
    // Natural voices: make every sentence now, in the background, so playback seldom waits.
    c.prepareAll((ready, total) => setPrepared({ ready, total }));
    return () => { c.dispose(); controller.current = null; };
  }, [voice, cues, settings?.speechRate]);

  /**
   * The player reports its state four times a second while playing. The player is the truth: a tap
   * on the video plays or pauses it, and pauses made by the voice sync (controller.waiting) are ignored.
   */
  const onStatus = useCallback((status: VideoStatus) => {
    setAd(status.ad);
    if (status.ad) return;
    lastTime.current = status.time;
    const c = controller.current;
    if (!status.paused && !status.ended) { wasPlaying.current = true; c?.tick(status.time); }
    else if (wasPlaying.current && !c?.waiting) { wasPlaying.current = false; c?.userPaused(); }
  }, []);

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
  const back10 = () => { controller.current?.userPaused(); video.current?.seekTo(lastTime.current - 10); };
  const toggleDubbing = () => {
    if (!settings) return;
    controller.current?.setEnabled(!settings.dubbing); video.current?.setMuted(!settings.dubbing);
    void change({ dubbing: !settings.dubbing });
  };
  if (!cues) return <View style={styles.root}><Header title="İzle" onBack={onBack} /><ScrollView contentContainerStyle={styles.padded}><Text style={styles.title}>{result.title}</Text><ErrorCard message="Bu video eski sürümle çevrildi. İzlemek için bir kez yeniden çevrilmeli." onRetry={onRetranslate} retryLabel="Yeniden Çevir" /><Button icon="document-text-outline" label="Metni Oku" kind="secondary" onPress={() => onRead(lastTime.current)} /></ScrollView></View>;
  if (!settings) return null;
  const videoWidth = big ? Math.min(width, Math.round(height * 16 / 9)) : width;
  const videoHeight = big ? height : Math.round(width * 9 / 16);
  const size = (big ? 24 : 26) * settings.fontScale;
  const subtitle = ad ? "Reklamdan sonra altyazı başlayacak…" : view.index < 0 ? "Başlatmak için videoya dokunun." : view.text;
  const waiting = view.waiting && <Text style={styles.waiting}>{view.waiting === "voice" ? "Türkçe anlatım bitiyor…" : "Türkçe ses hazırlanıyor…"}</Text>;
  const fontStep = (delta: number) => void change({ fontScale: Math.min(1.8, Math.max(0.8, Math.round((settings.fontScale + delta) * 10) / 10)) });

  if (playerError) return <View style={styles.root}><Header title="İzle" onBack={onBack} /><ScrollView contentContainerStyle={styles.padded}><ErrorCard message={playerError} /><Button icon="logo-youtube" label="YouTube'da Aç" onPress={() => void Linking.openURL(result.url)} /><Button icon="document-text-outline" label="Metni Oku" kind="secondary" onPress={() => onRead(lastTime.current)} /></ScrollView></View>;
  return <View style={[styles.root, big && styles.bigRoot]}>
    <StatusBar hidden={big} />
    {!big && <Header title={result.title} onBack={onBack} />}
    <View style={{ width: videoWidth, height: videoHeight }}>
      <YoutubeVideo ref={video} videoId={result.videoId} width={videoWidth} height={videoHeight} muted={settings.dubbing} startSeconds={startAt} onStatus={onStatus}
        onError={() => { logEvent(`Video oynatılamadı: ${result.videoId}`); setPlayerError("Bu video uygulamada oynatılamıyor. Metni okuyabilir ya da YouTube'da açabilirsiniz."); }} />
      {big && view.index >= 0 && <View style={styles.overlay} pointerEvents="none"><Text style={[styles.subtitle, { fontSize: size, lineHeight: size * 1.35 }]}>{subtitle}</Text>{waiting}</View>}
      {big && <Pressable style={styles.exitBig} onPress={() => setBigScreen(false)} accessibilityRole="button" accessibilityLabel="Küçült"><Ionicons name="contract-outline" size={26} color="#fff" /></Pressable>}
    </View>
    {!big && <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.subtitleBox} accessibilityLiveRegion="polite">
        <Text style={[styles.subtitle, { fontSize: size, lineHeight: size * 1.4 }]}>{subtitle}</Text>
        {waiting}
      </View>
      <View style={styles.padded}>
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {prepared && prepared.ready < prepared.total && <Text style={styles.preparing}>Türkçe ses hazırlanıyor: %{Math.floor(100 * prepared.ready / prepared.total)}</Text>}
        <Row>
          <Tile icon="play-back-outline" label="10 sn geri" onPress={back10} />
          <Tile icon={settings.dubbing ? "volume-high" : "volume-mute-outline"} label={settings.dubbing ? "Türkçe ses açık" : "Türkçe ses kapalı"} active={settings.dubbing} onPress={toggleDubbing} />
          <Tile icon="expand-outline" label="Büyük ekran" onPress={() => setBigScreen(true)} />
        </Row>
        <Row><Button flex icon="remove" label="Yazı" kind="secondary" onPress={() => fontStep(-0.1)} /><Button flex icon="add" label="Yazı" kind="secondary" onPress={() => fontStep(0.1)} /></Row>
        <Row>
          <Tile icon="document-text-outline" label="Metni oku" onPress={() => onRead(lastTime.current)} />
          <Tile icon="list-outline" label="Adımlar" onPress={() => onSteps(lastTime.current)} />
          <Tile icon="mic-outline" label="Soru sor" onPress={() => onAsk(lastTime.current)} />
        </Row>
        <Text style={styles.meta}>{result.sourceLanguage} dilinden çevrildi</Text>
      </View>
    </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  page: { padding: 20, backgroundColor: colors.background },
  root: { flex: 1, backgroundColor: colors.background },
  bigRoot: { backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 24, paddingVertical: 10 },
  exitBig: { position: "absolute", top: 10, right: 10, width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 30, backgroundColor: colors.background },
  padded: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: font.heading, fontWeight: "800", color: colors.text, marginBottom: 10 },
  subtitleBox: { backgroundColor: colors.subtitleBackground, minHeight: 180, paddingHorizontal: 20, paddingVertical: 18, justifyContent: "center", marginBottom: 12 },
  subtitle: { color: colors.subtitleText, fontWeight: "700", textAlign: "center" },
  waiting: { color: "#FDE68A", fontSize: font.small, textAlign: "center", marginTop: 10, fontWeight: "700" },
  notice: { fontSize: font.small, lineHeight: 25, color: colors.warning, fontWeight: "600", marginVertical: 6 },
  meta: { fontSize: font.caption, color: colors.muted, marginTop: 10, textAlign: "center" },
  preparing: { fontSize: font.caption, color: colors.muted, textAlign: "center", marginBottom: 4 },
});
