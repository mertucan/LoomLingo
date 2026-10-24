import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings } from "../types";

const SETTINGS_KEY = "loom-lingo/settings/v1";
/** Expo replaces EXPO_PUBLIC_ variables at bundle time, so the key from .env is built into the APK. */
const bundledApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || null;
/** Speech slightly slower than normal is easier to follow for an older listener. */
export const defaultSettings: Settings = { fontScale: 1.2, theme: "light", showTimestamps: true, glossary: [], voice: "device", speechRate: 0.95, dubbing: true };
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY); return raw ? { ...defaultSettings, ...JSON.parse(raw) as Partial<Settings> } : defaultSettings;
}
export async function saveSettings(settings: Settings): Promise<void> { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
export function getApiKey(): string | null { return bundledApiKey && !bundledApiKey.startsWith("PASTE_") ? bundledApiKey : null; }
