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

function prompt(transcript: CaptionTranscript, lines: Array<{ i: number; cue: Cue }>): string {
  return `Aşağıdaki altyazı satırlarını Türkçeye çevir. Kaynak dil kodu: ${transcript.languageCode}${transcript.automatic ? " (otomatik oluşturulmuş altyazı; noktalama ve yazım hataları olabilir, anlamı bağlamdan düzelt)" : ""}.
Her satır için aynı "i" numarasıyla:
- turkish: doğal ve eksiksiz Türkçe çeviri. Cümleler satırlara bölünmüş olabilir; her satırı kendi zamanına uyacak, okununca anlaşılır bir Türkçe parça olarak çevir. Satırları birleştirme veya atlama.
- spoken: yalnızca turkish metni "max" karakterden uzunsa doldur; aynı anlamı veren, sesli okunacak, en fazla "max" karakterlik kısa Türkçe sürüm. Teknik terimleri ve sayıları koru. Kısaysa boş bırak.

${JSON.stringify(lines.map(({ i, cue }) => ({ i, max: spokenBudget(cue.end - cue.start), text: cue.original })))}`;
}

/**
 * Gemini sometimes leaves out a line of a batch (it folds the words into a
 * neighbouring line). Those lines are asked for once more; a line still
 * missing is merged into the line before it, so the subtitles show no gap
 * and no false "[anlaşılmadı]".
 */
async function translateBatch(options: GeminiOptions, transcript: CaptionTranscript, batch: Cue[]): Promise<{ sourceLanguage: string; cues: Array<Cue & { missing?: boolean }> }> {
  const lines = batch.map((cue, i) => ({ i, cue }));
  const valid = (value: BatchAnswer) => Array.isArray(value.items) && value.items.length > 0;
  const answer = await generateJson<BatchAnswer>(options, [{ text: prompt(transcript, lines) }], SCHEMA, valid);
  const found = new Map(answer.items.filter(item => item.turkish?.trim()).map(item => [item.i, item]));
  const missing = lines.filter(line => !found.has(line.i));
  if (missing.length) {
    const retry = await generateJson<BatchAnswer>(options, [{ text: prompt(transcript, missing) }], SCHEMA, valid).catch(() => null);
    for (const item of retry?.items ?? []) if (item.turkish?.trim() && missing.some(m => m.i === item.i)) found.set(item.i, item);
  }
  return {
    sourceLanguage: answer.sourceLanguage,
    cues: batch.map((cue, i) => { const item = found.get(i); return item ? { ...cue, turkish: item.turkish.trim(), spoken: item.spoken?.trim() || undefined } : { ...cue, missing: true }; }),
  };
}

/** Merges lines that have no translation into the previous line (or the next one at the start). */
export function mergeUntranslated(cues: Array<Cue & { missing?: boolean }>): Cue[] {
  const out: Cue[] = []; const leading: Cue[] = [];
  for (const { missing, ...cue } of cues) {
    const previous = out.at(-1);
    if (!missing) {
      const first = leading[0];
      out.push(first ? { ...cue, start: first.start, original: [...leading.map(l => l.original), cue.original].join(" ") } : cue);
      leading.length = 0;
    } else if (previous) { previous.end = cue.end; previous.original = `${previous.original} ${cue.original}`; }
    else leading.push(cue);
  }
  return out;
}

/** Translates caption cues batch by batch, keeping their timing. */
export async function translateCaptions(options: GeminiOptions, transcript: CaptionTranscript, onProgress: (message: string) => void): Promise<{ sourceLanguage: string; cues: Cue[] }> {
  if (isTurkish(transcript.languageCode)) return { sourceLanguage: "Türkçe", cues: transcript.cues.map(c => ({ ...c, turkish: c.original })) };
  const batches = batchByLength(transcript.cues);
  const cues: Array<Cue & { missing?: boolean }> = []; let detected = languageName(transcript.languageCode);
  for (const [index, batch] of batches.entries()) {
    onProgress(batches.length > 1 ? `Altyazı Türkçeye çevriliyor… (Bölüm ${index + 1}/${batches.length})` : "Altyazı Türkçeye çevriliyor…");
    const answer = await translateBatch(options, transcript, batch);
    cues.push(...answer.cues); detected ??= answer.sourceLanguage;
  }
  return { sourceLanguage: detected ?? transcript.languageCode, cues: mergeUntranslated(cues) };
}
