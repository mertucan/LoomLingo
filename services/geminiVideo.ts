import { TimestampedParagraph, UserFacingError } from "../types";
import { planVideoSegments } from "../utils/textChunks";
import { GeminiOptions, generateJson, Part } from "./gemini";

/**
 * Gemini "video understanding" with a YouTube URL as input (checked October
 * 2026, https://ai.google.dev/gemini-api/docs/video-understanding):
 * - Only public videos work; private and unlisted videos are rejected.
 * - Free tier: at most 8 hours of YouTube video per day in total.
 * - Gemini listens to the audio and sees about one frame per second.
 * - `video_metadata` start/end offsets process only part of a video, which is
 *   how long videos are split into sections here.
 */
type VideoAnswer = { sourceLanguage: string; paragraphs: TimestampedParagraph[] };
const SCHEMA = {
  type: "object",
  properties: {
    sourceLanguage: { type: "string" },
    paragraphs: {
      type: "array",
      items: { type: "object", properties: { startSeconds: { type: "integer" }, original: { type: "string" }, turkish: { type: "string" } }, required: ["startSeconds", "original", "turkish"] },
    },
  },
  required: ["sourceLanguage", "paragraphs"],
};
const PROMPT = `Videodaki konuşmayı dinle, gerektiğinde görüntüyü de incele. Konuşmayı 1-4 cümlelik paragraflara böl. Her paragraf için: startSeconds = paragrafın başladığı an (videonun başından itibaren saniye), original = konuşmanın orijinal dilindeki yazımı, turkish = Türkçe çevirisi. Konuşma yoksa paragraphs boş olsun.`;

export async function translateYoutubeVideo(options: GeminiOptions, url: string, lengthSeconds: number | null, onProgress: (message: string) => void): Promise<VideoAnswer> {
  const segments = planVideoSegments(lengthSeconds);
  const video = (start?: number, end?: number): Part => ({ file_data: { file_uri: url }, ...(start !== undefined && end !== undefined ? { video_metadata: { start_offset: `${start}s`, end_offset: `${end}s` } } : {}) });
  const valid = (value: VideoAnswer) => Array.isArray(value.paragraphs);
  if (!segments) {
    onProgress("Video dinleniyor ve Türkçeye çevriliyor… Bu birkaç dakika sürebilir.");
    const answer = await generateJson<VideoAnswer>(options, [video(), { text: PROMPT }], SCHEMA, valid);
    if (!answer.paragraphs.length) throw new UserFacingError("Bu videoda çevrilecek bir konuşma bulunamadı.");
    return answer;
  }
  const paragraphs: TimestampedParagraph[] = []; let sourceLanguage = "";
  for (const [index, segment] of segments.entries()) {
    onProgress(`Bölüm ${index + 1}/${segments.length} çevriliyor…`);
    const answer = await generateJson<VideoAnswer>(options, [video(segment.startSeconds, segment.endSeconds), { text: `${PROMPT}\nYalnızca ${segment.startSeconds}. saniye ile ${segment.endSeconds}. saniye arasını işle.` }], SCHEMA, valid);
    paragraphs.push(...answer.paragraphs); sourceLanguage ||= answer.sourceLanguage;
  }
  if (!paragraphs.length) throw new UserFacingError("Bu videoda çevrilecek bir konuşma bulunamadı.");
  return { sourceLanguage, paragraphs };
}
