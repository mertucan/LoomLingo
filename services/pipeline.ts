import { TranslationResult, UserFacingError } from "../types";
import { captionDensity, cuesToParagraphs } from "../utils/cues";
import { resetText } from "../utils/quota";
import { ParsedYoutubeLink } from "../utils/youtubeLink";
import { getCached, saveCached } from "./cache";
import { GeminiOptions } from "./gemini";
import { translateYoutubeVideo } from "./geminiVideo";
import { isExhaustedToday, quotaUsedUpUntil, recordDailyQuota } from "./quota";
import { getApiKey, getSettings } from "./settings";
import { getCaptionTranscript, getVideoInfo } from "./transcript";
import { translateCaptions } from "./translate";

/** Caption tracks with less speech than this (characters per minute) are treated as unusable. */
const MIN_CAPTION_DENSITY = 60;

export type PipelineCallbacks = {
  onProgress: (message: string) => void;
  /** Asked before translating a video longer than an hour. */
  confirm: (title: string, message: string) => Promise<boolean>;
};

/** Cache first, then captions + Gemini text translation, then Gemini video input. */
export async function translateVideo(link: ParsedYoutubeLink, { onProgress, confirm }: PipelineCallbacks): Promise<TranslationResult | null> {
  onProgress("Daha önce çevrilmiş mi diye bakılıyor…");
  const saved = await getCached(link.videoId);
  if (saved?.cues) return saved;

  const apiKey = getApiKey();
  if (!apiKey) throw new UserFacingError("Uygulamada Gemini anahtarı yok. Uygulamanın yeniden kurulması gerekiyor.", "key");
  const usedUpUntil = await quotaUsedUpUntil();
  if (usedUpUntil) throw new UserFacingError(`Bugünkü ücretsiz çeviri hakkı doldu. ${usedUpUntil} yenilenir. Çevrilmiş videoları Geçmiş'ten izleyebilirsiniz.`, "quota");
  const settings = await getSettings();
  const options: GeminiOptions = {
    apiKey, glossary: settings.glossary, onDailyQuota: recordDailyQuota, isExhausted: isExhaustedToday,
    onWait: seconds => onProgress(`Çeviri servisi yoğun, ${seconds} saniye bekleniyor…`),
  };

  onProgress("Video bilgileri alınıyor…");
  const info = await getVideoInfo(link.videoId);
  if (info.status === "unavailable") throw new UserFacingError("Bu video bulunamadı. Silinmiş ya da link yanlış olabilir.", "video");
  const base = { videoId: link.videoId, url: link.canonicalUrl, title: info.title ?? "YouTube videosu", createdAt: new Date().toISOString(), lengthSeconds: info.lengthSeconds };

  onProgress("Altyazı aranıyor…");
  const captions = await getCaptionTranscript(info).catch(error => { if (error instanceof UserFacingError) throw error; return null; });
  const useCaptions = !!captions && captionDensity(captions.cues, info.lengthSeconds) >= MIN_CAPTION_DENSITY;
  if ((info.lengthSeconds ?? 0) > 3600) {
    const ok = await confirm("Uzun video", `${Math.round((info.lengthSeconds ?? 0) / 60)} dakikalık bir video. Çevirisi uzun sürer ve günlük hakkın çoğunu kullanabilir. Çevrilsin mi?`);
    if (!ok) return null;
  }

  try {
    const translated = useCaptions && captions
      ? { ...await translateCaptions(options, captions, onProgress), method: "captions" as const }
      : { ...await translateYoutubeVideo(options, link.canonicalUrl, info.lengthSeconds, onProgress), method: "gemini-video" as const };
    const result: TranslationResult = { ...base, ...translated, paragraphs: cuesToParagraphs(translated.cues) };
    await saveCached(result);
    return result;
  } catch (error) {
    if (error instanceof UserFacingError && error.code === "quota") throw new UserFacingError(`${error.userMessage} ${resetText()} yenilenir.`, "quota");
    throw error;
  }
}
