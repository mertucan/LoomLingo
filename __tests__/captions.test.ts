import { chooseCaptionTrack } from "../services/transcript";
import { captionDensity, groupCaptionLines } from "../utils/captions";
import { languageName } from "../utils/languages";

const line = (startMs: number, text: string, durationMs = 2000) => ({ startMs, durationMs, text });

test("joins short caption lines into a paragraph with the first timestamp", () => {
  expect(groupCaptionLines([line(65000, "first put the"), line(67000, "bobbin in")])).toEqual([{ startSeconds: 65, original: "first put the bobbin in", turkish: "" }]);
});
test("starts a new paragraph after a long pause", () => {
  const result = groupCaptionLines([line(0, "hello"), line(20000, "next part")]);
  expect(result.map(x => x.startSeconds)).toEqual([0, 20]);
});
test("breaks after a finished sentence once long enough", () => {
  const result = groupCaptionLines([line(0, "Thread the needle."), line(2000, "Now lower the foot.")], 10);
  expect(result.map(x => x.original)).toEqual(["Thread the needle.", "Now lower the foot."]);
});
test("never exceeds the hard limit for unpunctuated auto captions", () => {
  const lines = Array.from({ length: 50 }, (_, i) => line(i * 2000, "word word word word"));
  expect(groupCaptionLines(lines, 220, 100).every(x => x.original.length <= 100)).toBe(true);
});
test("ignores empty lines", () => expect(groupCaptionLines([line(0, "\n"), line(1000, " ")])).toEqual([]));

test("caption density is characters per minute", () => {
  expect(captionDensity([{ startSeconds: 0, original: "a".repeat(300), turkish: "" }], 120)).toBe(150);
});

const track = (languageCode: string, automatic = false) => ({ baseUrl: `https://x/${languageCode}`, languageCode, automatic });
test("prefers a human Turkish track", () => expect(chooseCaptionTrack([track("en"), track("tr"), track("en", true)])?.languageCode).toBe("tr"));
test("prefers the human track in the spoken language", () => expect(chooseCaptionTrack([track("de-DE"), track("hi"), track("hi", true)])?.languageCode).toBe("hi"));
test("falls back to the automatic track", () => expect(chooseCaptionTrack([track("bn", true)])).toEqual(track("bn", true)));
test("returns null without tracks", () => expect(chooseCaptionTrack([])).toBeNull());

test("names caption languages in Turkish", () => {
  expect(languageName("hi")).toBe("Hintçe");
  expect(languageName("pt-BR")).toBe("Portekizce");
  expect(languageName("xx")).toBeNull();
});
