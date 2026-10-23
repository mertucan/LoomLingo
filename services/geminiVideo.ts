import { Cue, UserFacingError } from "../types";
import { normalizeCues, parseTimestamp, splitLongCues } from "../utils/cues";
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
type VideoCue = Omit<Cue, "start" | "end"> & { start: string; end: string };
type VideoAnswer = { sourceLanguage: string; cues: VideoCue[] };
const SCHEMA = {
  type: "object",
  properties: {
    sourceLanguage: { type: "string" },
    cues: {
      type: "array",
      items: {
        type: "object",
        properties: { start: { type: "string" }, end: { type: "string" }, original: { type: "string" }, turkish: { type: "string" }, spoken: { type: "string" } },
        required: ["start", "end", "original", "turkish"],
      },
    },
  },
  required: ["sourceLanguage", "cues"],
};
const PROMPT = `Videodaki konuşmayı dinle, gerektiğinde görüntüyü de incele ve altyazı satırları oluştur. Her satır tek bir cümle ya da cümle parçası olsun ve en fazla 8 saniye sürsün; uzun cümleleri böl. Her satır için:
- start, end: satırın konuşulduğu zaman aralığı, videonun başından itibaren MM:SS biçiminde (ör. "01:05" = 1 dakika 5 saniye; bir saati aşan videoda H:MM:SS). Zamanları konuşmaya olabildiğince tam denk getir.
- original: konuşmanın orijinal dilindeki yazımı.
- turkish: doğal ve eksiksiz Türkçe çevirisi.
- spoken: turkish metni satırın süresinde rahatça okunamayacak kadar uzunsa (saniye başına 14 karakterden fazla) doldur; aynı anlamı veren, sesli okunacak kısa Türkçe sürüm. Teknik terimleri ve sayıları koru. Kısaysa boş bırak.
Konuşma yoksa cues boş olsun.`;

const mmss = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** Number of Gemini requests the video path will take (for the usage warning). */
export const videoRequestCount = (lengthSeconds: number | null) => planVideoSegments(lengthSeconds)?.length ?? 1;

export async function translateYoutubeVideo(options: GeminiOptions, url: string, lengthSeconds: number | null, onProgress: (message: string) => void): Promise<{ sourceLanguage: string; cues: Cue[] }> {
  const segments = planVideoSegments(lengthSeconds) ?? [null];
  const valid = (value: VideoAnswer) => Array.isArray(value.cues);
  const cues: Cue[] = []; let sourceLanguage = "";
  for (const [index, segment] of segments.entries()) {
    onProgress(segments.length > 1 ? `Bölüm ${index + 1}/${segments.length} çevriliyor…` : "Video dinleniyor ve Türkçeye çevriliyor… Bu birkaç dakika sürebilir.");
    const video: Part = { file_data: { file_uri: url }, ...(segment ? { video_metadata: { start_offset: `${segment.startSeconds}s`, end_offset: `${segment.endSeconds}s` } } : {}) };
    const text = segment ? `${PROMPT}\nYalnızca ${mmss(segment.startSeconds)} ile ${mmss(segment.endSeconds)} arasını işle; zamanlar yine videonun başından itibaren olsun.` : PROMPT;
    const answer = await generateJson<VideoAnswer>(options, [video, { text }], SCHEMA, valid);
    cues.push(...answer.cues.map(c => ({ ...c, start: parseTimestamp(c.start), end: parseTimestamp(c.end), spoken: c.spoken?.trim() || undefined }))
      .filter(c => Number.isFinite(c.start) && (!lengthSeconds || c.start < lengthSeconds + 2)));
    sourceLanguage ||= answer.sourceLanguage;
  }
  if (!cues.length) throw new UserFacingError("Bu videoda çevrilecek bir konuşma bulunamadı.", "video");
  return { sourceLanguage, cues: splitLongCues(normalizeCues(cues, lengthSeconds)) };
}
