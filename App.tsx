import { useCallback, useEffect, useRef, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors, font } from "./components/theme";
import { useShareIntent } from "./hooks/useShareIntent";
import { removeCached } from "./services/cache";
import { installCrashLogging } from "./services/log";
import { applyUpdateIfAvailable } from "./services/updates";
import { AskScreen } from "./screens/AskScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StepsScreen } from "./screens/StepsScreen";
import { WatchScreen } from "./screens/WatchScreen";
import { TranslationResult } from "./types";

installCrashLogging();
type Page = "home" | "history" | "settings" | "watch" | "read" | "steps" | "ask";
/** Pages reached from the watch screen go back to it; everything else goes back to Home. */
const WATCH_CHILDREN: Page[] = ["read", "steps", "ask"];

export default function App() {
  const [page, setPage] = useState<Page>("home"); const [result, setResult] = useState<TranslationResult | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0); const [updating, setUpdating] = useState(false);
  const watch = (item: TranslationResult) => { setResult(item); setStartAt(0); setPage("watch"); };
  const home = () => setPage("home");
  const leaveWatch = (target: Page) => (time: number) => { setStartAt(time); setPage(target); };
  const playFrom = (seconds: number) => { setStartAt(seconds); setPage("watch"); };
  const retranslate = (item: TranslationResult) => void removeCached(item.videoId).then(() => { setSharedText(item.url); setPage("home"); });
  // Android back button: go to the previous screen instead of leaving the app; leave only from Home.
  // Registered once (reading the page from a ref) so screens can add their own handler on top.
  const pageRef = useRef(page); pageRef.current = page;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const current = pageRef.current;
      if (current === "home") return false;
      setPage(WATCH_CHILDREN.includes(current) ? "watch" : "home"); return true;
    });
    return () => subscription.remove();
  }, []);
  // Upright everywhere; only the watch screen's "Büyük Ekran" turns the phone sideways.
  useEffect(() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined); }, []);
  useEffect(() => { void applyUpdateIfAvailable(() => setUpdating(true)).finally(() => setUpdating(false)); }, []);
  useShareIntent(useCallback((text: string) => { setSharedText(text); setPage("home"); }, []));

  if (updating) return <View style={styles.updating}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.updatingText}>Uygulama güncelleniyor…</Text></View>;
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar style="dark" />
    {page === "home" && <HomeScreen sharedText={sharedText} onSharedTextHandled={() => setSharedText(null)} onResult={watch} onHistory={() => setPage("history")} onSettings={() => setPage("settings")} />}
    {page === "history" && <HistoryScreen onOpen={watch} onBack={home} />}
    {page === "settings" && <SettingsScreen onBack={home} />}
    {page === "watch" && result && <WatchScreen result={result} startAt={startAt} onBack={home} onRead={leaveWatch("read")} onSteps={leaveWatch("steps")} onAsk={leaveWatch("ask")} onRetranslate={() => retranslate(result)} />}
    {page === "read" && result && <ResultScreen result={result} onBack={() => setPage("watch")} onWatch={() => setPage("watch")} />}
    {page === "steps" && result && <StepsScreen result={result} onBack={() => setPage("watch")} onPlayFrom={playFrom} onUpdate={setResult} />}
    {page === "ask" && result && <AskScreen result={result} onBack={() => setPage("watch")} onPlayFrom={playFrom} />}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  updating: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.background },
  updatingText: { fontSize: font.body, fontWeight: "700", color: colors.text },
});
