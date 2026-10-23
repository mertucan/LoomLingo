import { TranslationResult, UserFacingError } from "../types";
import { captionDensity } from "../utils/captions";
import { ParsedYoutubeLink } from "../utils/youtubeLink";
import { getCached, saveCached } from "./cache";
import { GeminiOptions } from "./gemini";
import { translateYoutubeVideo } from "./geminiVideo";
import { getApiKey, getSettings } from "./settings";
import { getCaptionTranscript, getVideoInfo } from "./transcript";
import { translateCaptions } from "./translate";
import { incrementUsage } from "./usage";

/** Caption tracks with less speech than this (characters per minute) are treated as unusable. */
const MIN_CAPTION_DENSITY = 60;

/** Cache first, then captions + Gemini text translation, then Gemini video input. */
export async function translateVideo(link: ParsedYoutubeLink, onProgress: (message: string) => void): Promise<TranslationResult> {
  onProgress("Daha önce çevrilmiş mi diye bakılıyor…");
  const saved = await getCached(link.videoId);
  if (saved) return saved;

  const apiKey = await getApiKey();
  if (!apiKey) throw new UserFacingError("Gemini API anahtarı girilmemiş. Ayarlar bölümünden anahtarı girin.");
  const settings = await getSettings();
  const options: GeminiOptions = {
    apiKey, glossary: settings.glossary, onRequest: () => incrementUsage().then(() => undefined),
    onWait: seconds => onProgress(`Çeviri servisi yoğun, ${seconds} saniye bekleniyor…`),
  };

  onProgress("Video bilgileri alınıyor…");
  const info = await getVideoInfo(link.videoId);
  if (info.status === "unavailable") throw new UserFacingError("Bu video bulunamadı. Silinmiş ya da link yanlış olabilir.");
  const base = { videoId: link.videoId, url: link.canonicalUrl, title: info.title ?? "YouTube videosu", createdAt: new Date().toISOString() };

  onProgress("Altyazı aranıyor…");
  const captions = await getCaptionTranscript(info).catch(error => { if (error instanceof UserFacingError) throw error; return null; });
  if (captions && captionDensity(captions.paragraphs, info.lengthSeconds) >= MIN_CAPTION_DENSITY) {
    const translated = await translateCaptions(options, captions, onProgress);
    const result: TranslationResult = { ...base, ...translated, method: "captions" };
    await saveCached(result); return result;
  }

  const translated = await translateYoutubeVideo(options, link.canonicalUrl, info.lengthSeconds, onProgress);
  const result: TranslationResult = { ...base, ...translated, method: "gemini-video" };
  await saveCached(result); return result;
}
