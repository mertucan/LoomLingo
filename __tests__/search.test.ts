jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
import { resumeFrom } from "../services/positions";
import { interleave } from "../services/search";
import { parseSearchResults } from "../services/transcript";

const video = (videoId: string, lengthText?: string, title = `Video ${videoId}`) =>
  ({ videoRenderer: { videoId, title: { runs: [{ text: title }] }, ownerText: { runs: [{ text: "Kanal" }] }, ...(lengthText ? { lengthText: { simpleText: lengthText } } : {}) } });

test("search results keep normal videos in page order and skip live streams and Shorts", () => {
  const response = { contents: { sections: [{ items: [video("aaaaaaaaaaa", "6:28"), video("bbbbbbbbbbb"), video("ccccccccccc", "0:45"), { shelf: { items: [video("ddddddddddd", "1:02:03"), video("aaaaaaaaaaa", "6:28")] } }] }] } };
  expect(parseSearchResults(response)).toEqual([
    { videoId: "aaaaaaaaaaa", title: "Video aaaaaaaaaaa", channel: "Kanal", lengthText: "6:28", lengthSeconds: 388 },
    { videoId: "ddddddddddd", title: "Video ddddddddddd", channel: "Kanal", lengthText: "1:02:03", lengthSeconds: 3723 },
  ]);
});
test("results from each language are mixed near the top, without duplicates", () => {
  const r = (id: string) => ({ videoId: id, title: id, channel: "", lengthText: "5:00", lengthSeconds: 300 });
  expect(interleave([[r("e1"), r("e2"), r("e3")], [r("h1"), r("e2")], [r("t1")]], 5).map(x => x.videoId)).toEqual(["e1", "h1", "t1", "e2", "e3"]);
});
test("a video continues a little before where it was left", () => {
  expect(resumeFrom(undefined, 300)).toBe(0);
  expect(resumeFrom(5, 300)).toBe(0);      // barely started
  expect(resumeFrom(120, 300)).toBe(117);  // a few seconds earlier
  expect(resumeFrom(290, 300)).toBe(0);    // nearly finished: start over
  expect(resumeFrom(120, null)).toBe(117);
});
