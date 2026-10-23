import { TranslationResult, UserFacingError } from "../types";
import { captionDensity, cuesToParagraphs } from "../utils/cues";
import { ParsedYoutubeLink } from "../utils/youtubeLink";
import { getCached, saveCached } from "./cache";
import { GeminiOptions } from "./gemini";
import { translateYoutubeVideo, videoRequestCount } from "./geminiVideo";
import { getQuotaStatus, isExhaustedToday, recordDailyQuota, recordRequest, recordVideo } from "./quota";
import { getApiKey, getSettings } from "./settings";
import { getCaptionTranscript, getVideoInfo } from "./transcript";
import { captionRequestCount, translateCaptions } from "./translate";

/** Caption tracks with less speech than this (characters per minute) are treated as unusable. */
const MIN_CAPTION_DENSITY = 60;

export type PipelineCallbacks = {
  onProgress: (message: string) => void;
  /** Asked before a translation that may not fit in today's remaining free quota. */
  confirm: (title: string, message: string) => Promise<boolean>;
};

const minutes = (seconds: number | null) => seconds ? `${Math.max(1, Math.round(seconds / 60))} dakikalık` : "Bu";

/** Cache first, then captions + Gemini text translation, then Gemini video input. */
export async function translateVideo(link: ParsedYoutubeLink, { onProgress, confirm }: PipelineCallbacks): Promise<TranslationResult | null> {
  onProgress("Daha önce çevrilmiş mi diye bakılıyor…");
  const saved = await getCached(link.videoId);
  if (saved?.cues) return saved;

  const apiKey = await getApiKey();
  if (!apiKey) throw new UserFacingError("Gemini API anahtarı girilmemiş. Ayarlar bölümünden anahtarı girin.", "key");
  const quota = await getQuotaStatus();
  if (quota.level === "empty") throw new UserFacingError(`Bugünkü ücretsiz çeviri hakkı doldu. ${quota.resetText} yenilenir. Daha önce çevrilen videoları Geçmiş'ten izleyebilirsiniz.`, "quota");
  const settings = await getSettings();
  const options: GeminiOptions = {
    apiKey, glossary: settings.glossary, onRequest: recordRequest, onDailyQuota: recordDailyQuota, isExhausted: isExhaustedToday,
    onWait: seconds => onProgress(`Çeviri servisi yoğun, ${seconds} saniye bekleniyor…`),
  };

  onProgress("Video bilgileri alınıyor…");
  const info = await getVideoInfo(link.videoId);
  if (info.status === "unavailable") throw new UserFacingError("Bu video bulunamadı. Silinmiş ya da link yanlış olabilir.", "video");
  const base = { videoId: link.videoId, url: link.canonicalUrl, title: info.title ?? "YouTube videosu", createdAt: new Date().toISOString(), lengthSeconds: info.lengthSeconds };

  onProgress("Altyazı aranıyor…");
  const captions = await getCaptionTranscript(info).catch(error => { if (error instanceof UserFacingError) throw error; return null; });
  const useCaptions = !!captions && captionDensity(captions.cues, info.lengthSeconds) >= MIN_CAPTION_DENSITY;
  const requests = useCaptions && captions ? captionRequestCount(captions) : videoRequestCount(info.lengthSeconds);
  // Expect about two requests per video; warn when this one alone may need most of what is left.
  if (requests > Math.max(2, quota.videosLeft * 2) || (info.lengthSeconds ?? 0) > 3600) {
    const ok = await confirm("Uzun video", `${minutes(info.lengthSeconds)} bir video. Bugünkü ücretsiz çeviri hakkının büyük kısmını kullanabilir ve yarıda kalabilir. Yine de çevrilsin mi?`);
    if (!ok) return null;
  }

  const translated = useCaptions && captions
    ? { ...await translateCaptions(options, captions, onProgress), method: "captions" as const }
    : { ...await translateYoutubeVideo(options, link.canonicalUrl, info.lengthSeconds, onProgress), method: "gemini-video" as const };
  const result: TranslationResult = { ...base, ...translated, paragraphs: cuesToParagraphs(translated.cues) };
  await saveCached(result); await recordVideo(info.lengthSeconds);
  return result;
}
