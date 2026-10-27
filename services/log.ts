import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { Linking, Platform } from "react-native";
import app from "../app.json";
import { getSettings } from "./settings";

/**
 * A short local log of what went wrong, sent by "Sorun Bildir" as an e-mail the
 * user only has to send. Nothing leaves the phone without that tap. The
 * address comes from .env (EXPO_PUBLIC_SUPPORT_EMAIL), not from the source.
 */
const KEY = "loom-lingo/log/v1";
const MAX_ENTRIES = 40;
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || null;
let writing: Promise<void> = Promise.resolve();

export function logEvent(message: string): void {
  const line = `${new Date().toISOString().slice(0, 19).replace("T", " ")} ${message.replace(/\s+/g, " ").slice(0, 300)}`;
  // Serialised so quick successive events do not overwrite each other.
  writing = writing.then(async () => {
    const entries = JSON.parse(await AsyncStorage.getItem(KEY) ?? "[]") as string[];
    await AsyncStorage.setItem(KEY, JSON.stringify([...entries, line].slice(-MAX_ENTRIES)));
  }).catch(() => undefined);
}
export async function getLog(): Promise<string[]> { await writing; return JSON.parse(await AsyncStorage.getItem(KEY) ?? "[]") as string[]; }

/** Records crashes before the default handler shows or reports them. */
export function installCrashLogging(): void {
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => { logEvent(`${isFatal ? "Çökme" : "Hata"}: ${error instanceof Error ? error.message : String(error)}`); previous(error, isFatal); });
}

export const canReport = () => supportEmail !== null;

/** Opens the mail app with a filled-in report. Returns false when no mail app can take it. */
export async function sendReport(): Promise<boolean> {
  if (!supportEmail) return false;
  const [entries, settings] = await Promise.all([getLog(), getSettings()]);
  const device = Platform.OS === "android" ? Platform.constants : null;
  const update = Updates.updateId ? `${Updates.updateId.slice(0, 8)} (${Updates.createdAt?.toISOString().slice(0, 16).replace("T", " ") ?? "?"})` : "yok";
  const body = [
    "Sorunu kısaca yazabilirsiniz:", "", "", "———",
    `Uygulama: ${app.expo.version} · güncelleme: ${update}`,
    `Telefon: ${device ? `${device.Brand} ${device.Model}, Android ${device.Release}` : Platform.OS}`,
    `Ses: ${settings.voice}, hız ${settings.speechRate}`,
    "", "Son olaylar:", ...(entries.length ? entries.slice(-25).reverse() : ["(kayıt yok)"]),
  ].join("\n");
  const url = `mailto:${supportEmail}?subject=${encodeURIComponent("Loom Lingo sorun bildirimi")}&body=${encodeURIComponent(body)}`;
  try { await Linking.openURL(url); return true; } catch { return false; }
}
