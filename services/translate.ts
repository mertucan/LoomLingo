import { TimestampedParagraph } from "../types";
import { isTurkish, languageName } from "../utils/languages";
import { batchParagraphs } from "../utils/textChunks";
import { GeminiOptions, generateJson } from "./gemini";
import { CaptionTranscript } from "./transcript";

type BatchAnswer = { sourceLanguage: string; items: Array<{ i: number; turkish: string }> };
const SCHEMA = {
  type: "object",
  properties: {
    sourceLanguage: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, turkish: { type: "string" } }, required: ["i", "turkish"] } },
  },
  required: ["sourceLanguage", "items"],
};

/** Translates a caption transcript paragraph by paragraph, keeping timestamps. */
export async function translateCaptions(options: GeminiOptions, transcript: CaptionTranscript, onProgress: (message: string) => void): Promise<{ sourceLanguage: string; paragraphs: TimestampedParagraph[] }> {
  const knownLanguage = languageName(transcript.languageCode);
  if (isTurkish(transcript.languageCode)) return { sourceLanguage: "Türkçe", paragraphs: transcript.paragraphs.map(p => ({ ...p, turkish: p.original })) };
  const batches = batchParagraphs(transcript.paragraphs);
  const paragraphs: TimestampedParagraph[] = []; let detected = knownLanguage;
  for (const [index, batch] of batches.entries()) {
    onProgress(batches.length > 1 ? `Altyazı Türkçeye çevriliyor… (Bölüm ${index + 1}/${batches.length})` : "Altyazı Türkçeye çevriliyor…");
    const prompt = `Aşağıdaki altyazı paragraflarını Türkçeye çevir. Kaynak dil kodu: ${transcript.languageCode}${transcript.automatic ? " (otomatik oluşturulmuş altyazı; noktalama ve yazım hataları olabilir, anlamı bağlamdan düzelt)" : ""}. Her paragraf için aynı "i" numarasıyla tek bir Türkçe paragraf döndür; paragrafları birleştirme veya atlama.\n\n${JSON.stringify(batch.map((p, i) => ({ i, text: p.original })))}`;
    const answer = await generateJson<BatchAnswer>(options, [{ text: prompt }], SCHEMA, value => Array.isArray(value.items) && value.items.length > 0);
    const byIndex = new Map(answer.items.map(item => [item.i, item.turkish]));
    batch.forEach((p, i) => paragraphs.push({ ...p, turkish: byIndex.get(i)?.trim() || "[anlaşılmadı]" }));
    detected ??= answer.sourceLanguage;
  }
  return { sourceLanguage: detected ?? transcript.languageCode, paragraphs };
}
