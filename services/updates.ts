import * as Updates from "expo-updates";
import { logEvent } from "./log";

const timeout = <T,>(promise: Promise<T>, ms: number) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

/**
 * Over-the-air updates (EAS Update, "preview" channel). On start the app asks
 * once whether a newer version was published; if so it downloads it and
 * restarts into it, which takes a few seconds. A slow or missing connection
 * just starts the installed version. Only JavaScript changes travel this way;
 * new native code still needs a new APK (the fingerprint runtime version
 * keeps incompatible updates away from old APKs).
 */
export async function applyUpdateIfAvailable(onDownloading: () => void): Promise<void> {
  if (!Updates.isEnabled || __DEV__) return;
  try {
    const check = await timeout(Updates.checkForUpdateAsync(), 8_000);
    if (!check.isAvailable) return;
    onDownloading();
    const fetched = await timeout(Updates.fetchUpdateAsync(), 60_000);
    if (fetched.isNew) { logEvent("Güncelleme yüklendi"); await Updates.reloadAsync(); }
  } catch (error) {
    logEvent(`Güncelleme denenemedi: ${error instanceof Error ? error.message : String(error)}`);
  }
}
