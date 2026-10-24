import { nextQuotaReset, pacificOffset, quotaDay } from "../utils/quota";

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
