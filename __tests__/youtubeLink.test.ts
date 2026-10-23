import { parseYoutubeLink } from "../utils/youtubeLink";
test.each([
  "https://youtu.be/dQw4w9WgXcQ?t=4",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ&si=x",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
  "https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=120s",
  "youtube.com/watch?v=dQw4w9WgXcQ",
  "Bu videoyu izle: https://youtu.be/dQw4w9WgXcQ?si=abc",
])("parses %s", (link: string) => {
  expect(parseYoutubeLink(link)).toEqual({ videoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
});
test.each(["https://example.com/a", "https://www.youtube.com/watch?v=short", "merhaba", ""])("rejects %p", (link: string) => expect(parseYoutubeLink(link)).toBeNull());
