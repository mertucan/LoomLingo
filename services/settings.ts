import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Settings } from "../types";

const SETTINGS_KEY = "loom-lingo/settings/v1";
/** SecureStore keys may only contain letters, digits, ".", "-" and "_". */
const API_KEY = "loom-lingo.gemini-api-key";
/**
 * Expo replaces EXPO_PUBLIC_ variables at bundle time. This is intentionally
 * first so a personal APK can run without entering the key on the phone.
 */
const bundledApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || null;
/** Speech slightly slower than normal is easier to follow for an older listener. */
export const defaultSettings: Settings = { fontScale: 1.2, theme: "light", showTimestamps: true, glossary: [], voice: "device", speechRate: 0.95, dubbing: true };
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY); return raw ? { ...defaultSettings, ...JSON.parse(raw) as Partial<Settings> } : defaultSettings;
}
export async function saveSettings(settings: Settings): Promise<void> { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
export const hasBundledApiKey = (): boolean => bundledApiKey !== null && !bundledApiKey.startsWith("PASTE_");
export async function getStoredApiKey(): Promise<string | null> { return SecureStore.getItemAsync(API_KEY); }
export async function getApiKey(): Promise<string | null> { return hasBundledApiKey() ? bundledApiKey : getStoredApiKey(); }
export async function saveApiKey(key: string): Promise<void> {
  if (key.trim()) await SecureStore.setItemAsync(API_KEY, key.trim()); else await SecureStore.deleteItemAsync(API_KEY);
}
