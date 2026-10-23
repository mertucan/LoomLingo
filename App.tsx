import { useCallback, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useShareIntent } from "./hooks/useShareIntent";
import { HomeScreen } from "./screens/HomeScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TranslationResult } from "./types";
type Page = "home" | "history" | "settings" | "result";
export default function App() {
  const [page, setPage] = useState<Page>("home"); const [result, setResult] = useState<TranslationResult | null>(null);
  const [sharedText, setSharedText] = useState<string | null>(null);
  const open = (item: TranslationResult) => { setResult(item); setPage("result"); };
  useShareIntent(useCallback((text: string) => { setSharedText(text); setPage("home"); }, []));
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><StatusBar style="dark" />{page === "home" && <HomeScreen sharedText={sharedText} onSharedTextHandled={() => setSharedText(null)} onResult={open} onHistory={() => setPage("history")} onSettings={() => setPage("settings")} />}{page === "history" && <HistoryScreen onOpen={open} onBack={() => setPage("home")} />}{page === "settings" && <SettingsScreen onBack={() => setPage("home")} />}{page === "result" && result && <ResultScreen result={result} onBack={() => setPage("home")} />}</SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F8FAFC" } });
