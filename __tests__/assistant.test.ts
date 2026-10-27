import { normalizeSteps } from "../services/assistant";
import { transcriptForPrompt } from "../utils/cues";

test("steps are sorted, timed in seconds and kept inside the video", () => {
  expect(normalizeSteps([
    { start: "1:30", title: "İkinci", detail: "b" },
    { start: "0:05", title: "Birinci", detail: "a" },
    { start: "9:00", title: "Video bittikten sonra", detail: "" },
    { start: "abc", title: "Zamansız", detail: "" },
    { start: "0:40", title: "  ", detail: "boş başlık" },
  ], 300)).toEqual([{ start: 5, title: "Birinci", detail: "a" }, { start: 90, title: "İkinci", detail: "b" }]);
});
test("at most fifteen steps", () => {
  expect(normalizeSteps(Array.from({ length: 20 }, (_, i) => ({ start: `0:${String(i).padStart(2, "0")}`, title: `Adım ${i}`, detail: "" })))).toHaveLength(15);
});

const cue = (start: number, turkish: string) => ({ start, end: start + 2, original: "", turkish });
test("the transcript for prompts has a time on every line", () => {
  expect(transcriptForPrompt([cue(5, "Merhaba."), cue(65, "İpliği takın.")])).toBe("[0:05] Merhaba.\n[1:05] İpliği takın.");
});
test("very long transcripts are thinned out, not cut off at the end", () => {
  const cues = Array.from({ length: 1000 }, (_, i) => cue(i * 3, "x".repeat(50)));
  const text = transcriptForPrompt(cues, 30000);
  expect(text.length).toBeLessThanOrEqual(30000);
  expect(text).toContain("[49:54]"); // a line from near the end is still there
});
