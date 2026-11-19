import AsyncStorage from "@react-native-async-storage/async-storage";

/** Where each video was left, so it can continue from there ("kaldığı yerden devam"). */
const KEY = "loom-lingo/positions/v1";
let memory: Record<string, number> | null = null;

export async function getPositions(): Promise<Record<string, number>> {
  memory ??= JSON.parse(await AsyncStorage.getItem(KEY).catch(() => null) ?? "{}") as Record<string, number>;
  return memory;
}
export async function savePosition(videoId: string, seconds: number): Promise<void> {
  const positions = await getPositions();
  positions[videoId] = Math.max(0, Math.floor(seconds));
  await AsyncStorage.setItem(KEY, JSON.stringify(positions)).catch(() => undefined);
}

/**
 * Where to start a video that was left at `saved` seconds: from the beginning
 * when barely started or nearly finished, otherwise a few seconds earlier than
 * where it stopped, so the sentence that was cut off is heard again.
 */
export function resumeFrom(saved: number | undefined, lengthSeconds?: number | null): number {
  if (!saved || saved < 10) return 0;
  if (lengthSeconds && saved > lengthSeconds - 15) return 0;
  return Math.max(0, saved - 3);
}
