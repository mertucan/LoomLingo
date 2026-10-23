import { ASSUMED_DAILY_REQUESTS, nextQuotaReset, pacificOffset, QuotaDay, quotaDay, quotaStatus } from "../utils/quota";

test("Pacific offset follows US summer time", () => {
  expect(pacificOffset(new Date("2026-07-01T12:00:00Z"))).toBe(-7);
  expect(pacificOffset(new Date("2026-12-01T12:00:00Z"))).toBe(-8);
  expect(pacificOffset(new Date("2026-03-08T09:59:00Z"))).toBe(-8); // just before 02:00 PST on the 2nd Sunday of March
  expect(pacificOffset(new Date("2026-03-08T10:00:00Z"))).toBe(-7);
  expect(pacificOffset(new Date("2026-11-01T08:59:00Z"))).toBe(-7); // just before 02:00 PDT on the 1st Sunday of November
  expect(pacificOffset(new Date("2026-11-01T09:00:00Z"))).toBe(-8);
});
test("the quota day changes at Pacific midnight (10:00 in Turkey in summer)", () => {
  expect(quotaDay(new Date("2026-07-02T06:59:00Z"))).toBe("2026-07-01");
  expect(quotaDay(new Date("2026-07-02T07:00:00Z"))).toBe("2026-07-02");
});
test("next reset in summer and winter", () => {
  expect(nextQuotaReset(new Date("2026-07-01T20:00:00Z")).toISOString()).toBe("2026-07-02T07:00:00.000Z");
  expect(nextQuotaReset(new Date("2026-12-01T20:00:00Z")).toISOString()).toBe("2026-12-02T08:00:00.000Z");
  expect(nextQuotaReset(new Date("2026-11-01T05:00:00Z")).toISOString()).toBe("2026-11-01T07:00:00.000Z"); // midnight is still PDT
  expect(nextQuotaReset(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-11-02T08:00:00.000Z"); // first PST midnight
});

const models = ["a", "b"] as const;
const day = (partial: Partial<QuotaDay>): QuotaDay => ({ day: "2026-10-23", models: {}, videos: 0, videoSeconds: 0, ...partial });
test("a fresh day is full", () => {
  expect(quotaStatus(day({}), models)).toMatchObject({ fraction: 0, level: "ok", videosLeft: ASSUMED_DAILY_REQUESTS });
});
test("uses learned limits and the day's real requests per video", () => {
  const status = quotaStatus(day({ models: { a: { used: 30, exhausted: false, limit: 40 }, b: { used: 0, exhausted: false } }, videos: 10 }), models);
  expect(status.fraction).toBeCloseTo(0.5);
  expect(status.videosLeft).toBe(10); // 30 left at 3 requests per video
  expect(status.level).toBe("ok");
});
test("warns as the quota runs low and is empty when every model is used up", () => {
  expect(quotaStatus(day({ models: { a: { used: 20, exhausted: true }, b: { used: 15, exhausted: false } } }), models).level).toBe("low");
  expect(quotaStatus(day({ models: { a: { used: 20, exhausted: true }, b: { used: 3, exhausted: true } } }), models)).toMatchObject({ level: "empty", videosLeft: 0, fraction: 1 });
});
