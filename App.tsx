import { useCallback, useEffect, useRef, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { BackHandler, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useShareIntent } from "./hooks/useShareIntent";
import { removeCached } from "./services/cache";
import { HomeScreen } from "./screens/HomeScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { WatchScreen } from "./screens/WatchScreen";
import { TranslationResult } from "./types";
type Page = "home" | "history" | "settings" | "watch" | "read";
export default function App() {
  const [page, setPage] = useState<Page>("home"); const [result, setResult] = useState<TranslationResult | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const watch = (item: TranslationResult) => { setResult(item); setPage("watch"); };
  const home = () => setPage("home");
  const retranslate = (item: TranslationResult) => void removeCached(item.videoId).then(() => { setSharedText(item.url); setPage("home"); });
  // Android back button: go to the previous screen instead of leaving the app; leave only from Home.
  // Registered once (reading the page from a ref) so screens can add their own handler on top.
  const pageRef = useRef(page); pageRef.current = page;
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const current = pageRef.current;
      if (current === "home") return false;
      setPage(current === "read" ? "watch" : "home"); return true;
    });
    return () => subscription.remove();
  }, []);
  // Upright everywhere; only the watch screen's "Büyük Ekran" turns the phone sideways.
  useEffect(() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined); }, []);
  useShareIntent(useCallback((text: string) => { setSharedText(text); setPage("home"); }, []));
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar style="dark" />
    {page === "home" && <HomeScreen sharedText={sharedText} onSharedTextHandled={() => setSharedText(null)} onResult={watch} onHistory={() => setPage("history")} onSettings={() => setPage("settings")} />}
    {page === "history" && <HistoryScreen onOpen={watch} onBack={home} />}
    {page === "settings" && <SettingsScreen onBack={home} />}
    {page === "watch" && result && <WatchScreen result={result} onBack={home} onRead={() => setPage("read")} onRetranslate={() => retranslate(result)} />}
    {page === "read" && result && <ResultScreen result={result} onBack={home} onWatch={() => setPage("watch")} />}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F8FAFC" } });
