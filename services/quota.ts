import AsyncStorage from "@react-native-async-storage/async-storage";
import { quotaDay, resetText } from "../utils/quota";
import { MODELS } from "./gemini";

/**
 * Google does not tell a free key its remaining quota in advance; it only
 * answers "daily quota used up" for a model. Those answers are remembered per
 * quota day (Pacific time), so used-up models are skipped and the app can say
 * truthfully when everything is used up and when it resets.
 */
const KEY = "loom-lingo/exhausted-models/v1";
type Exhausted = { day: string; models: string[] };
let memory: Exhausted | null = null;

async function load(): Promise<Exhausted> {
  const today = quotaDay();
  if (memory?.day === today) return memory;
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const saved = raw ? JSON.parse(raw) as Exhausted : null;
  memory = saved?.day === today ? saved : { day: today, models: [] };
  return memory;
}
export async function recordDailyQuota(model: string): Promise<void> {
  const day = await load();
  if (!day.models.includes(model)) day.models.push(model);
  await AsyncStorage.setItem(KEY, JSON.stringify(day));
}
/** Synchronous check for the Gemini client; uses the copy loaded by the last call. */
export const isExhaustedToday = (model: string) => memory?.day === quotaDay() && memory.models.includes(model);
/** When every model is used up today: the reset time as "yarın saat 10:00", otherwise null. */
export async function quotaUsedUpUntil(): Promise<string | null> {
  const day = await load();
  return MODELS.every(m => day.models.includes(m)) ? resetText() : null;
}
