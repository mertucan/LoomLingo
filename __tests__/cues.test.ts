import { chooseCaptionTrack } from "../services/transcript";
import { captionDensity, cuesToParagraphs, findCueIndex, groupCaptionLines, MAX_SPEECH_RATE, normalizeCues, parseTimestamp, planSpeech, splitLongCues, subtitlePieces } from "../utils/cues";
import { languageName } from "../utils/languages";

const line = (startMs: number, text: string, durationMs = 2000) => ({ startMs, durationMs, text });
const cue = (start: number, end: number, turkish: string, spoken?: string) => ({ start, end, original: turkish, turkish, spoken });

test("joins short caption lines into one cue with start and end", () => {
  expect(groupCaptionLines([line(65000, "first put the"), line(67000, "bobbin in")])).toEqual([{ start: 65, end: 69, original: "first put the bobbin in", turkish: "" }]);
});
test("starts a new cue after a pause", () => {
  expect(groupCaptionLines([line(0, "hello"), line(5000, "next part")]).map(c => c.start)).toEqual([0, 5]);
});
test("breaks after a finished sentence once long enough", () => {
  const result = groupCaptionLines([line(0, "Thread the needle now."), line(2000, "Now lower the foot.")], { minChars: 10 });
  expect(result.map(c => c.original)).toEqual(["Thread the needle now.", "Now lower the foot."]);
});
test("unpunctuated auto captions are split by length and duration", () => {
  const lines = Array.from({ length: 30 }, (_, i) => line(i * 2000, "word word word word"));
  const result = groupCaptionLines(lines, { maxChars: 100, maxMs: 9000 });
  expect(result.every(c => c.original.length <= 100 && c.end - c.start <= 9)).toBe(true);
});
test("cue ends never overlap the next cue", () => {
  expect(normalizeCues([cue(5, 9, "b"), cue(0, 7, "a"), cue(9, 0, "c")], 12).map(c => [c.start, c.end])).toEqual([[0, 5], [5, 9], [9, 12]]);
});
test("finds the cue on screen", () => {
  const cues = [cue(1, 2, "a"), cue(3, 4, "b"), cue(8, 9, "c")];
  expect([0, 1, 2.5, 3, 7.9, 100].map(t => findCueIndex(cues, t))).toEqual([-1, 0, 0, 1, 1, 2]);
});
test("builds reading paragraphs from cues", () => {
  expect(cuesToParagraphs([cue(0, 2, "Bir."), cue(2, 4, "İki."), cue(65, 67, "Üç.")], 9)).toEqual([{ startSeconds: 0, original: "Bir. İki.", turkish: "Bir. İki." }, { startSeconds: 65, original: "Üç.", turkish: "Üç." }]);
});
test("caption density is characters per minute", () => expect(captionDensity([cue(0, 5, "a".repeat(300))], 120)).toBe(150));

describe("planSpeech", () => {
  test("keeps the full translation and base speed when it fits", () => {
    expect(planSpeech(cue(0, 4, "a".repeat(40), "kısa"), 5, 0.95, 14)).toEqual({ text: "a".repeat(40), rate: 0.95 });
  });
  test("uses the short spoken version when the full one is too long", () => {
    expect(planSpeech(cue(0, 2, "a".repeat(80), "b".repeat(28)), 2, 1, 14)).toEqual({ text: "b".repeat(28), rate: 1 });
  });
  test("speeds up, but never past the limit", () => {
    expect(planSpeech(cue(0, 2, "a".repeat(32)), 2, 1, 14).rate).toBe(1.14);
    expect(planSpeech(cue(0, 1, "a".repeat(200)), 1, 1, 14).rate).toBe(MAX_SPEECH_RATE);
  });
});

const track = (languageCode: string, automatic = false) => ({ baseUrl: `https://x/${languageCode}`, languageCode, automatic });
test("prefers a human Turkish track", () => expect(chooseCaptionTrack([track("en"), track("tr"), track("en", true)])?.languageCode).toBe("tr"));
test("prefers the human track in the spoken language", () => expect(chooseCaptionTrack([track("de-DE"), track("hi"), track("hi", true)])?.languageCode).toBe("hi"));
test("falls back to the automatic track", () => expect(chooseCaptionTrack([track("bn", true)])).toEqual(track("bn", true)));
test("returns null without tracks", () => expect(chooseCaptionTrack([])).toBeNull());
test("names caption languages in Turkish", () => {
  expect(languageName("hi")).toBe("Hintçe"); expect(languageName("pt-BR")).toBe("Portekizce"); expect(languageName("xx")).toBeNull();
});

test("parses MM:SS and H:MM:SS timestamps", () => {
  expect(["00:05", "05:26", "1:02:03", "01:05.5"].map(parseTimestamp)).toEqual([5, 326, 3723, 65.5]);
  expect(parseTimestamp(12)).toBe(12);
  expect(parseTimestamp("abc")).toBeNaN();
});
test("wraps subtitle text at word boundaries", () => {
  const pieces = subtitlePieces("Bu çok uzun bir cümledir ve kelime ortasından asla bölünmemelidir, anlaşıldı mı?", 30);
  expect(pieces.every(p => p.length <= 30)).toBe(true);
  expect(pieces.join(" ")).toBe("Bu çok uzun bir cümledir ve kelime ortasından asla bölünmemelidir, anlaşıldı mı?");
});
test("splits a long cue and shares its time by text length", () => {
  const result = splitLongCues([{ start: 10, end: 22, original: "orig", turkish: "Birinci cümle burada bitiyor. İkinci cümle de burada bitiyor." }], 9, 40);
  expect(result.map(c => c.turkish)).toEqual(["Birinci cümle burada bitiyor.", "İkinci cümle de burada bitiyor."]);
  expect(result[0]?.start).toBe(10); expect(result[1]?.end).toBe(22);
  expect(result[0]?.end).toBeCloseTo(10 + 12 * 29 / 60);
  expect(result.map(c => c.original)).toEqual(["orig", ""]);
});
test("keeps short cues as they are", () => {
  const short = { start: 0, end: 3, original: "a", turkish: "Kısa." };
  expect(splitLongCues([short])).toEqual([short]);
});
