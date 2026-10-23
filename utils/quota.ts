/**
 * Gemini's free daily quotas reset at midnight Pacific time (US rules: summer
 * time from the second Sunday of March to the first Sunday of November).
 * Computed by hand because Hermes' Intl time-zone support varies by device.
 */
function nthSundayUtc(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Date.UTC(year, month, 1 + ((7 - first) % 7) + (n - 1) * 7);
}
/** Pacific UTC offset in hours (-7 in summer, -8 in winter) at the given moment. */
export function pacificOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const start = nthSundayUtc(year, 2, 2) + 10 * 3600_000; // 02:00 PST = 10:00 UTC
  const end = nthSundayUtc(year, 10, 1) + 9 * 3600_000;   // 02:00 PDT = 09:00 UTC
  const t = date.getTime();
  return t >= start && t < end ? -7 : -8;
}
const pacificWallClock = (date: Date) => new Date(date.getTime() + pacificOffset(date) * 3600_000);
/** Quota day as YYYY-MM-DD in Pacific time. */
export function quotaDay(date = new Date()): string { return pacificWallClock(date).toISOString().slice(0, 10); }
/** The next moment the free quota resets. */
export function nextQuotaReset(date = new Date()): Date {
  const wall = pacificWallClock(date);
  const midnightWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);
  const guess = new Date(midnightWall - pacificOffset(date) * 3600_000);
  return new Date(midnightWall - pacificOffset(guess) * 3600_000);
}
/** "bugün saat 10:00" / "yarın saat 10:00" in the phone's local time. */
export function resetText(now = new Date()): string {
  const reset = nextQuotaReset(now);
  const sameDay = reset.toDateString() === now.toDateString();
  return `${sameDay ? "bugün" : "yarın"} saat ${String(reset.getHours()).padStart(2, "0")}:${String(reset.getMinutes()).padStart(2, "0")}`;
}

/**
 * Google does not publish free-tier request limits; they are shown per
 * project in AI Studio and change over time. Until a model's real limit is
 * learned from a quota error, this conservative value is assumed.
 */
export const ASSUMED_DAILY_REQUESTS = 20;
export const TYPICAL_REQUESTS_PER_VIDEO = 2;
export type ModelUsage = { used: number; exhausted: boolean; limit?: number };
export type QuotaDay = { day: string; models: Record<string, ModelUsage>; videos: number; videoSeconds: number };
export type QuotaLevel = "ok" | "warn" | "low" | "empty";
export type QuotaStatus = { fraction: number; videosLeft: number; level: QuotaLevel; videos: number; minutes: number; resetText: string };

export function quotaStatus(day: QuotaDay, models: readonly string[], now = new Date()): QuotaStatus {
  let capacity = 0; let used = 0; let requests = 0;
  for (const model of models) {
    const usage = day.models[model] ?? { used: 0, exhausted: false };
    const limit = usage.limit ?? Math.max(ASSUMED_DAILY_REQUESTS, usage.used);
    capacity += limit; used += usage.exhausted ? limit : Math.min(usage.used, limit); requests += usage.used;
  }
  const allExhausted = models.every(m => day.models[m]?.exhausted);
  const fraction = allExhausted ? 1 : capacity ? Math.min(1, used / capacity) : 0;
  const perVideo = day.videos >= 2 ? Math.max(1, requests / day.videos) : TYPICAL_REQUESTS_PER_VIDEO;
  const videosLeft = allExhausted ? 0 : Math.floor((capacity - used) / perVideo);
  const level: QuotaLevel = allExhausted || videosLeft === 0 ? "empty" : fraction >= 0.85 ? "low" : fraction >= 0.6 ? "warn" : "ok";
  return { fraction, videosLeft, level, videos: day.videos, minutes: Math.round(day.videoSeconds / 60), resetText: resetText(now) };
}
