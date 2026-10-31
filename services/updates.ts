import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as Updates from "expo-updates";
import app from "../app.json";
import { logEvent } from "./log";

/**
 * Over-the-air updates (EAS Update, "preview" channel), announced with a phone
 * notification:
 * - Every hour or so (Android decides the exact time) a background task asks
 *   whether a newer release was published. If so it downloads it and shows
 *   "Loom Lingo v1.1.1 hazır". Tapping the notification opens the app on the
 *   new version.
 * - While the app is open, a newer release shows a banner on the home screen.
 * - A downloaded release is also used automatically the next time the app starts.
 * Only JavaScript changes travel this way; native changes still need a new APK
 * with a higher "version" in app.json (the runtime version).
 * Release labels ("1.1.1") live in app.json under extra.release and are raised by
 * `npm run update`.
 */
const TASK = "loom-lingo-update-check";
const NOTIFIED_KEY = "loom-lingo/update-notified/v1";
const CHANNEL = "updates";
export const currentRelease: string = app.expo.extra.release;

type ReleaseManifest = { extra?: { expoClient?: { extra?: { release?: string } } } };
const timeout = <T,>(promise: Promise<T>, ms: number) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
const enabled = () => Updates.isEnabled && !__DEV__;

/** The label of a newer published release, or null when there is none (or no connection). */
export async function findNewRelease(): Promise<string | null> {
  if (!enabled()) return null;
  try {
    const check = await timeout(Updates.checkForUpdateAsync(), 10_000);
    if (!check.isAvailable) return null;
    return (check.manifest as ReleaseManifest).extra?.expoClient?.extra?.release ?? "yeni sürüm";
  } catch { return null; }
}

/** Downloads the newest release and restarts the app on it. */
export async function installNewRelease(): Promise<void> {
  if (!enabled()) return;
  try {
    const fetched = await timeout(Updates.fetchUpdateAsync(), 90_000);
    if (fetched.isNew || (await Updates.checkForUpdateAsync()).isAvailable) { logEvent("Güncelleme yüklendi"); await Updates.reloadAsync(); }
  } catch (error) { logEvent(`Güncelleme yüklenemedi: ${error instanceof Error ? error.message : String(error)}`); throw error; }
}

async function notifyOnce(release: string): Promise<void> {
  if ((await AsyncStorage.getItem(NOTIFIED_KEY)) === release) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: `Loom Lingo v${release} hazır`, body: "Güncellemek için dokunun.", data: { type: "update" } },
    trigger: { channelId: CHANNEL },
  });
  await AsyncStorage.setItem(NOTIFIED_KEY, release);
}

// Runs in the background, also when the app is closed. Must be defined at start-up, outside any component.
TaskManager.defineTask(TASK, async () => {
  try {
    const release = await findNewRelease();
    if (release) { await Updates.fetchUpdateAsync(); await notifyOnce(release); }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch { return BackgroundTask.BackgroundTaskResult.Failed; }
});

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

/**
 * Called once at start: asks for notification permission, registers the hourly
 * background check and installs the update when the user tapped its notification.
 */
export async function setUpUpdates(): Promise<void> {
  if (!enabled()) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Güncellemeler", importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.requestPermissionsAsync();
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
    const opened = await Notifications.getLastNotificationResponseAsync();
    if (opened?.notification.request.content.data?.type === "update") { await Notifications.clearLastNotificationResponseAsync?.(); await installNewRelease(); }
  } catch (error) { logEvent(`Güncelleme ayarı: ${error instanceof Error ? error.message : String(error)}`); }
  // Tapping the notification while the app is already running.
  Notifications.addNotificationResponseReceivedListener(response => {
    if (response.notification.request.content.data?.type === "update") void installNewRelease().catch(() => undefined);
  });
}
