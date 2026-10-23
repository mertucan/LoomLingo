import AsyncStorage from "@react-native-async-storage/async-storage";
import { TranslationResult } from "../types";
const PREFIX = "loom-lingo/video/";
const INDEX = "loom-lingo/history/v1";
export async function getCached(videoId: string): Promise<TranslationResult | null> { const raw = await AsyncStorage.getItem(PREFIX + videoId); return raw ? JSON.parse(raw) as TranslationResult : null; }
export async function saveCached(item: TranslationResult): Promise<void> {
  await AsyncStorage.setItem(PREFIX + item.videoId, JSON.stringify(item));
  const old = await getHistory(); await AsyncStorage.setItem(INDEX, JSON.stringify([item.videoId, ...old.filter(id => id !== item.videoId)].slice(0, 100)));
}
export async function getHistory(): Promise<string[]> { return JSON.parse((await AsyncStorage.getItem(INDEX)) ?? "[]") as string[]; }
export async function getHistoryItems(): Promise<TranslationResult[]> { return (await Promise.all((await getHistory()).map(getCached))).filter((x): x is TranslationResult => x !== null); }
export async function removeCached(videoId: string): Promise<void> { await AsyncStorage.removeItem(PREFIX + videoId); await AsyncStorage.setItem(INDEX, JSON.stringify((await getHistory()).filter(id => id !== videoId))); }
export async function clearCache(): Promise<void> { const ids = await getHistory(); await AsyncStorage.multiRemove([...ids.map(id => PREFIX + id), INDEX]); }
