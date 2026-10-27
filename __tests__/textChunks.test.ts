import { batchByLength, planVideoSegments, splitTextIntoChunks } from "../utils/textChunks";
test("does not split simple sentences", () => expect(splitTextIntoChunks("Bir. Iki. Üç.", 10)).toEqual(["Bir. Iki.", "Üç."]));
test("splits a long sentence", () => expect(splitTextIntoChunks("abcdef", 3)).toEqual(["abc", "def"]));
test("splits at the Hindi full stop", () => expect(splitTextIntoChunks("सुई लगाओ। धागा डालो।", 12)).toEqual(["सुई लगाओ।", "धागा डालो।"]));

const p = (original: string) => ({ startSeconds: 0, original, turkish: "" });
test("batches paragraphs without splitting one", () => {
  expect(batchByLength([p("aaaa"), p("bbbb"), p("cccc")], 8).map(b => b.map(x => x.original))).toEqual([["aaaa", "bbbb"], ["cccc"]]);
});
test("keeps an oversized paragraph in its own batch", () => expect(batchByLength([p("a".repeat(20)), p("b")], 8)).toHaveLength(2));

test("short or unknown-length videos use one request", () => {
  expect(planVideoSegments(null)).toBeNull();
  expect(planVideoSegments(240)).toBeNull();
});
test("longer videos are split into equal sections of about three minutes", () => {
  expect(planVideoSegments(771)).toEqual([0, 154, 308, 463, 617].map((startSeconds, i, all) => ({ startSeconds, endSeconds: all[i + 1] ?? 771 })));
  expect(planVideoSegments(1307)?.length).toBe(8);
});
