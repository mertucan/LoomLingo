import { ErrorCode, GlossaryEntry, UserFacingError } from "../types";

/**
 * Tried in order. A model whose free daily quota is used up is skipped and the
 * next one is tried; each model has its own free-tier quota. All three list
 * video understanding and are available to free AI Studio keys (October 2026).
 */
export const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"] as const;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_WAIT_SECONDS = 60;

export const SYSTEM_INSTRUCTION = `Bu videolar tekstil/dikiş makineleri (dikiş, overlock, reçme, nakış, dokuma, örgü) bakım, ayar ve kullanım anlatan eğitim videolarıdır. Görevin konuşmayı doğal, akıcı ve bir ustanın anlayacağı sade Türkçeye çevirmektir.

Kurallar:
- Teknik terimlerin yerleşik Türkçe karşılığını kullan. Örnekler: bobbin = masura, bobbin case = masura kapağı/mekik, needle plate = iğne plakası, presser foot = ayak, feed dog = dişli/taşıyıcı, stitch length = dikiş sıklığı, tension = gerginlik, thread = iplik, needle bar = iğne mili, hook = çağanoz, looper = lüper. Overlock, flatlock gibi sektörde yaygın olanları olduğu gibi bırak.
- Türkçe karşılığı yerleşik olmayan veya belirsiz terimlerde ilk geçtiği yerde parantez içinde orijinalini yaz.
- Rakamları, ölçüleri ve ayar değerlerini (mm, numara, devir, vida numarası) aynen koru.
- Konuşmada "şunu buraya takın" gibi görsel bir gönderme varsa ve görüntü mevcutsa, neyin nereye takıldığını çeviride netleştir.
- Emin olmadığın veya atölye gürültüsü yüzünden anlaşılmayan yerleri uydurma; [anlaşılmadı] diye işaretle.
- Hintçe, Bengalce gibi dillerde ustaların kullandığı yerel/argo makine terimlerini bağlamdan çıkarmaya çalış; çıkaramazsan orijinal kelimeyi parantez içinde bırak.
- sourceLanguage alanına konuşmanın dilini Türkçe adıyla yaz (ör. "Hintçe", "Bengalce", "İngilizce").`;

export function glossaryPrompt(glossary: GlossaryEntry[]): string {
  return glossary.length ? `\n\nKişisel terim sözlüğü (bu karşılıkları her zaman kullan):\n${glossary.map(x => `${x.source} = ${x.turkish}`).join("\n")}` : "";
}

export type GeminiOptions = {
  apiKey: string; glossary: GlossaryEntry[];
  /** Called once per HTTP request, for the daily usage bar. */
  onRequest?: (model: string) => void | Promise<void>;
  /** Called when a model's free daily quota is used up; `limit` is Google's number when the error states it. */
  onDailyQuota?: (model: string, limit?: number) => void | Promise<void>;
  /** Models already known to be used up today are skipped without a request. */
  isExhausted?: (model: string) => boolean;
  /** Called before waiting out a per-minute rate limit. */
  onWait?: (seconds: number) => void;
};
export type Part = { text: string } | { file_data: { file_uri: string }; video_metadata?: { start_offset: string; end_offset: string } };

type Failure = "daily-quota" | "rate-limit" | "key" | "video" | "server" | "bad-response" | "network";
class GeminiFailure extends Error { constructor(public readonly kind: Failure, public readonly retryAfter = 0, public readonly limit?: number) { super(kind); } }

const MESSAGES: Record<Failure, string> = {
  "daily-quota": "Bugünkü ücretsiz çeviri hakkı doldu.",
  "rate-limit": "Çeviri servisi yoğun. Bir dakika sonra tekrar deneyin.",
  key: "Gemini anahtarı geçersiz. Uygulamanın yeni anahtarla kurulması gerekiyor.",
  video: "Bu video açılamadı. Özel, yaş kısıtlamalı ya da kaldırılmış olabilir.",
  server: "Çeviri servisi yanıt vermiyor. Biraz sonra tekrar deneyin.",
  "bad-response": "Çeviri tamamlanamadı. Tekrar deneyin.",
  network: "İnternet bağlantısı yok.",
};
const CODES: Record<Failure, ErrorCode> = { "daily-quota": "quota", "rate-limit": "other", key: "key", video: "video", server: "other", "bad-response": "other", network: "network" };
const fail = (kind: Failure) => new UserFacingError(MESSAGES[kind], CODES[kind]);

type ErrorBody = { error?: { message?: string; status?: string; details?: Array<{ retryDelay?: string; violations?: Array<{ quotaId?: string; quotaValue?: string }> }> } };
function classify(status: number, body: ErrorBody): GeminiFailure {
  const error = body.error ?? {}; const message = error.message ?? "";
  if (status === 429) {
    const daily = (error.details ?? []).flatMap(d => d.violations ?? []).find(v => /PerDay/i.test(v.quotaId ?? ""));
    const retry = Number.parseFloat((error.details ?? []).find(d => d.retryDelay)?.retryDelay ?? "");
    const limit = Number(daily?.quotaValue);
    return daily ? new GeminiFailure("daily-quota", 0, limit > 0 ? limit : undefined) : new GeminiFailure("rate-limit", Number.isFinite(retry) ? Math.ceil(retry) : 20);
  }
  if (status === 401 || status === 403 || /api key|API_KEY/i.test(message)) return new GeminiFailure("key");
  if (status === 400 || status === 404) return new GeminiFailure(/video|file|uri|url|youtube/i.test(message) ? "video" : "bad-response");
  return new GeminiFailure("server", 5);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generate(options: GeminiOptions, model: string, parts: Part[], schema: object): Promise<string> {
  await options.onRequest?.(model);
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION + glossaryPrompt(options.glossary) }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
      }),
    });
  } catch { throw new GeminiFailure("network"); }
  if (!response.ok) throw classify(response.status, await response.json().catch(() => ({})) as ErrorBody);
  const data = await response.json() as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? "").join("").trim();
  if (!text || candidate?.finishReason === "MAX_TOKENS") throw new GeminiFailure("bad-response");
  return text;
}

/**
 * Sends one structured request. Waits out per-minute limits, retries server
 * errors once, and moves to the next model when a model's daily quota is
 * used up or it returns an unusable answer.
 */
export async function generateJson<T>(options: GeminiOptions, parts: Part[], schema: object, isValid: (value: T) => boolean = () => true): Promise<T> {
  if (!options.apiKey) throw fail("key");
  const models = MODELS.filter(m => !options.isExhausted?.(m));
  if (!models.length) throw fail("daily-quota");
  let last: Failure = "bad-response";
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const value = JSON.parse(await generate(options, model, parts, schema)) as T;
        if (isValid(value)) return value;
        throw new GeminiFailure("bad-response");
      } catch (error) {
        const failure = error instanceof GeminiFailure ? error : new GeminiFailure("bad-response");
        last = failure.kind;
        if (failure.kind === "key" || failure.kind === "video" || failure.kind === "network") throw fail(failure.kind);
        if (failure.kind === "daily-quota") await options.onDailyQuota?.(model, failure.limit);
        if ((failure.kind === "rate-limit" || failure.kind === "server") && attempt < 2 && failure.retryAfter <= MAX_WAIT_SECONDS) {
          options.onWait?.(failure.retryAfter); await sleep(failure.retryAfter * 1000); continue;
        }
        break; // daily quota, bad answer, or repeated errors: try the next model
      }
    }
  }
  throw fail(last);
}
