import { Step, TranslationResult } from "../types";
import { parseTimestamp, transcriptForPrompt } from "../utils/cues";
import { GeminiOptions, generateJson, Part } from "./gemini";

/**
 * "Adımlar" and "Soru sor" work from the translation the app already has, so
 * they cost one small text request each and never re-process the video.
 */
type RawStep = { start: string; title: string; detail: string };
const STEPS_SCHEMA = {
  type: "object",
  properties: { steps: { type: "array", items: { type: "object", properties: { start: { type: "string" }, title: { type: "string" }, detail: { type: "string" } }, required: ["start", "title", "detail"] } } },
  required: ["steps"],
};
const MAX_STEPS = 15;

/** Sorted steps with valid times inside the video; empty ones dropped. */
export function normalizeSteps(steps: RawStep[], lengthSeconds?: number | null): Step[] {
  return steps
    .map(s => ({ start: parseTimestamp(s.start), title: s.title?.trim() ?? "", detail: s.detail?.trim() ?? "" }))
    .filter(s => Number.isFinite(s.start) && s.title && (!lengthSeconds || s.start <= lengthSeconds))
    .map(s => ({ ...s, start: Math.max(0, s.start) }))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_STEPS);
}

export async function makeSteps(options: GeminiOptions, result: TranslationResult): Promise<Step[]> {
  const prompt = `Aşağıda "${result.title}" videosundaki konuşmanın zaman damgalı Türkçe çevirisi var. Videoda gösterilen işi, makine başında takip edilebilecek sırayla kısa adımlara böl.
- start: adımın videoda başladığı zaman, metindeki gibi d:ss biçiminde.
- title: en fazla 8 kelimelik, emir kipinde kısa cümle (ör. "Masurayı masura kapağına takın").
- detail: 1-2 cümlelik açıklama. Ölçüleri, numaraları ve ayar değerlerini aynen koru.
- Selamlaşma, abone olun çağrısı gibi işle ilgisiz kısımları adım yapma. En fazla ${MAX_STEPS} adım.
- Videoda adım adım bir iş anlatılmıyorsa konuyu özetleyen 3-6 madde ver.

${transcriptForPrompt(result.cues ?? [])}`;
  const answer = await generateJson<{ steps: RawStep[] }>(options, [{ text: prompt }], STEPS_SCHEMA, v => Array.isArray(v.steps) && v.steps.length > 0);
  return normalizeSteps(answer.steps, result.lengthSeconds);
}

export type Answer = { question: string; answer: string; time: number | null };
export type Question = { text: string } | { audioBase64: string; mimeType: string };
const ANSWER_SCHEMA = {
  type: "object",
  properties: { question: { type: "string" }, answer: { type: "string" }, time: { type: "string" } },
  required: ["question", "answer"],
};

/** Answers a spoken or typed question about the video from its translation. */
export async function askAboutVideo(options: GeminiOptions, result: TranslationResult, question: Question): Promise<Answer> {
  const spoken = "audioBase64" in question;
  const prompt = `Bir usta, izlediği "${result.title}" videosu hakkında soru soruyor. ${spoken ? "Sorusu ekteki ses kaydında; ne sorduğunu question alanına Türkçe yaz." : `Sorusu: "${question.text}". Bunu question alanına aynen yaz.`}
Cevabı videodaki anlatıma dayanarak ver:
- answer: sade ve kısa (en fazla 4 cümle), sesli okunacak Türkçe. Ölçü, numara ve ayar değerlerini aynen ver.
- Cevap videoda yoksa bunu açıkça söyle; genel bilgin varsa "Videoda geçmiyor ama genel olarak…" diye başlayarak kısaca ekle.
- time: cevabın videoda geçtiği an, d:ss biçiminde. Cevap videoda geçmiyorsa boş bırak.
- Ses kaydı boş ya da anlaşılmıyorsa question alanına "anlaşılmadı" yaz ve answer'da sorusunu tekrar sormasını rica et.

Videonun metni:
${transcriptForPrompt(result.cues ?? [])}`;
  const parts: Part[] = spoken ? [{ inline_data: { mime_type: question.mimeType, data: question.audioBase64 } }, { text: prompt }] : [{ text: prompt }];
  const answer = await generateJson<{ question: string; answer: string; time?: string }>(options, parts, ANSWER_SCHEMA, v => !!v.answer?.trim());
  const time = answer.time ? parseTimestamp(answer.time) : Number.NaN;
  return { question: answer.question?.trim() || "", answer: answer.answer.trim(), time: Number.isFinite(time) && (!result.lengthSeconds || time <= result.lengthSeconds) ? time : null };
}
