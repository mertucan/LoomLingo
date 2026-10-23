import { Cue } from "../types";
import { spokenBudget } from "../utils/cues";
import { isTurkish, languageName } from "../utils/languages";
import { batchByLength } from "../utils/textChunks";
import { GeminiOptions, generateJson } from "./gemini";
import { CaptionTranscript } from "./transcript";

type BatchAnswer = { sourceLanguage: string; items: Array<{ i: number; turkish: string; spoken?: string }> };
const SCHEMA = {
  type: "object",
  properties: {
    sourceLanguage: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, turkish: { type: "string" }, spoken: { type: "string" } }, required: ["i", "turkish"] } },
  },
  required: ["sourceLanguage", "items"],
};

/** Number of Gemini requests a caption translation will take (for the usage warning). */
export const captionRequestCount = (transcript: CaptionTranscript) => isTurkish(transcript.languageCode) ? 0 : batchByLength(transcript.cues).length;

/** Translates caption cues batch by batch, keeping their timing. */
export async function translateCaptions(options: GeminiOptions, transcript: CaptionTranscript, onProgress: (message: string) => void): Promise<{ sourceLanguage: string; cues: Cue[] }> {
  if (isTurkish(transcript.languageCode)) return { sourceLanguage: "Türkçe", cues: transcript.cues.map(c => ({ ...c, turkish: c.original })) };
  const batches = batchByLength(transcript.cues);
  const cues: Cue[] = []; let detected = languageName(transcript.languageCode);
  for (const [index, batch] of batches.entries()) {
    onProgress(batches.length > 1 ? `Altyazı Türkçeye çevriliyor… (Bölüm ${index + 1}/${batches.length})` : "Altyazı Türkçeye çevriliyor…");
    const prompt = `Aşağıdaki altyazı satırlarını Türkçeye çevir. Kaynak dil kodu: ${transcript.languageCode}${transcript.automatic ? " (otomatik oluşturulmuş altyazı; noktalama ve yazım hataları olabilir, anlamı bağlamdan düzelt)" : ""}.
Her satır için aynı "i" numarasıyla:
- turkish: doğal ve eksiksiz Türkçe çeviri. Cümleler satırlara bölünmüş olabilir; her satırı kendi zamanına uyacak, okununca anlaşılır bir Türkçe parça olarak çevir. Satırları birleştirme veya atlama.
- spoken: yalnızca turkish metni "max" karakterden uzunsa doldur; aynı anlamı veren, sesli okunacak, en fazla "max" karakterlik kısa Türkçe sürüm. Teknik terimleri ve sayıları koru. Kısaysa boş bırak.

${JSON.stringify(batch.map((c, i) => ({ i, max: spokenBudget(c.end - c.start), text: c.original })))}`;
    const answer = await generateJson<BatchAnswer>(options, [{ text: prompt }], SCHEMA, value => Array.isArray(value.items) && value.items.length > 0);
    const byIndex = new Map(answer.items.map(item => [item.i, item]));
    batch.forEach((c, i) => { const item = byIndex.get(i); cues.push({ ...c, turkish: item?.turkish?.trim() || "[anlaşılmadı]", spoken: item?.spoken?.trim() || undefined }); });
    detected ??= answer.sourceLanguage;
  }
  return { sourceLanguage: detected ?? transcript.languageCode, cues };
}
