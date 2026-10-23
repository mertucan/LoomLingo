import { DubController, DubView } from "../services/dubController";
import { Clip, DubVoice } from "../services/voices";
import { Cue } from "../types";

/** A voice whose clips finish only when the test says so. */
function fakeVoice(readyKeys: "all" | string[] = "all") {
  const played: string[] = []; let finish: (() => void) | null = null;
  const generate: Record<string, () => void> = {};
  const ready = new Set(readyKeys === "all" ? [] : readyKeys);
  const voice: DubVoice = {
    charsPerSecond: 15,
    isReady: key => readyKeys === "all" || ready.has(key),
    prepare: (key, text, rate) => readyKeys === "all" || ready.has(key)
      ? Promise.resolve({ key, text, rate })
      : new Promise<Clip>(resolve => { generate[key] = () => { ready.add(key); resolve({ key, text, rate }); }; }),
    play: clip => new Promise<void>(resolve => { played.push(clip.text); finish = resolve; }),
    stop: () => { finish?.(); finish = null; },
    dispose: () => undefined,
  };
  return { voice, played, finishClip: () => { const f = finish; finish = null; f?.(); }, finishGenerating: (key: string) => generate[key]?.() };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const cues: Cue[] = [
  { start: 1, end: 3, original: "a", turkish: "Birinci cümle." },
  { start: 3, end: 5, original: "b", turkish: "İkinci cümle." },
  { start: 10, end: 12, original: "c", turkish: "Üçüncü cümle." },
];
function setup(readyKeys: "all" | string[] = "all", enabled = true) {
  const fake = fakeVoice(readyKeys); const video = { pause: jest.fn(), resume: jest.fn() }; const views: DubView[] = [];
  const controller = new DubController(cues, fake.voice, video, view => views.push(view), enabled, 1);
  return { ...fake, video, views, controller, last: () => views.at(-1) };
}

test("speaks each cue when it starts", async () => {
  const { controller, played, finishClip } = setup();
  controller.tick(0.5); expect(played).toEqual([]);
  controller.tick(1.2); await flush(); expect(played).toEqual(["Birinci cümle."]);
  finishClip(); await flush();
  controller.tick(3.1); await flush(); expect(played).toEqual(["Birinci cümle.", "İkinci cümle."]);
});

test("pauses the video while the previous sentence is still spoken, then resumes", async () => {
  const { controller, played, finishClip, video, last } = setup();
  controller.tick(1); await flush();
  controller.tick(3.2); await flush();
  expect(video.pause).toHaveBeenCalledTimes(1);
  expect(last()?.waiting).toBe("voice");
  expect(played).toEqual(["Birinci cümle."]);
  finishClip(); await flush();
  expect(played).toEqual(["Birinci cümle.", "İkinci cümle."]);
  expect(video.resume).toHaveBeenCalledTimes(1);
  expect(last()).toMatchObject({ index: 1, waiting: null });
});

test("waits for a natural-voice clip that is still being generated", async () => {
  const { controller, played, video, finishGenerating } = setup([]);
  controller.tick(1); await flush();
  expect(video.pause).toHaveBeenCalledTimes(1); expect(played).toEqual([]);
  finishGenerating("0"); await flush();
  expect(video.resume).toHaveBeenCalledTimes(1); expect(played).toEqual(["Birinci cümle."]);
});

test("a jump in the video stops the voice and skips cues that were jumped over", async () => {
  const { controller, played, finishClip } = setup();
  controller.tick(1); await flush();
  controller.tick(10.3); await flush(); // seek forward into the third cue, near its start
  expect(played).toEqual(["Birinci cümle.", "Üçüncü cümle."]);
  finishClip();
});

test("with the voice off, only subtitles follow the video", async () => {
  const { controller, played, video, last } = setup("all", false);
  controller.tick(3.5); await flush();
  expect(played).toEqual([]); expect(video.pause).not.toHaveBeenCalled();
  expect(last()).toMatchObject({ index: 1, text: "İkinci cümle." });
});

test("pressing pause stops speech and repeats the sentence on play", async () => {
  const { controller, played } = setup();
  controller.tick(1.1); await flush();
  controller.userPaused();
  controller.tick(1.6); await flush();
  expect(played).toEqual(["Birinci cümle.", "Birinci cümle."]);
});
