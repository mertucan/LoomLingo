import AsyncStorage from "@react-native-async-storage/async-storage";
import { QuotaDay, quotaDay, QuotaStatus, quotaStatus } from "../utils/quota";
import { MODELS } from "./gemini";

/** Today's Gemini usage per model, keyed by Google's (Pacific) quota day. Learned limits are kept across days. */
const KEY = "loom-lingo/quota/v1";
const LIMITS_KEY = "loom-lingo/quota-limits/v1";
let memory: QuotaDay | null = null;

async function load(): Promise<QuotaDay> {
  const today = quotaDay();
  if (memory?.day === today) return memory;
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const saved = raw ? JSON.parse(raw) as QuotaDay : null;
  const limits = JSON.parse(await AsyncStorage.getItem(LIMITS_KEY).catch(() => null) ?? "{}") as Record<string, number>;
  memory = saved?.day === today ? saved : { day: today, models: Object.fromEntries(Object.entries(limits).map(([m, limit]) => [m, { used: 0, exhausted: false, limit }])), videos: 0, videoSeconds: 0 };
  return memory;
}
async function update(change: (day: QuotaDay) => void): Promise<void> { const day = await load(); change(day); await AsyncStorage.setItem(KEY, JSON.stringify(day)); }
const model = (day: QuotaDay, name: string) => (day.models[name] ??= { used: 0, exhausted: false });

export const recordRequest = (name: string) => update(day => { model(day, name).used++; });
export async function recordDailyQuota(name: string, limit?: number): Promise<void> {
  await update(day => { const m = model(day, name); m.exhausted = true; if (limit) m.limit = limit; });
  if (limit) {
    const limits = JSON.parse(await AsyncStorage.getItem(LIMITS_KEY) ?? "{}") as Record<string, number>;
    await AsyncStorage.setItem(LIMITS_KEY, JSON.stringify({ ...limits, [name]: limit }));
  }
}
export const recordVideo = (seconds: number | null | undefined) => update(day => { day.videos++; day.videoSeconds += seconds ?? 0; });
/** Synchronous check for the Gemini client; uses the copy loaded by the last call. */
export const isExhaustedToday = (name: string) => memory?.day === quotaDay() && !!memory.models[name]?.exhausted;
export async function getQuotaStatus(): Promise<QuotaStatus> { return quotaStatus(await load(), MODELS); }
