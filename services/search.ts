import { UserFacingError } from "../types";
import { GeminiOptions, generateJson } from "./gemini";
import { SearchResult, searchYoutube } from "./transcript";

/**
 * "Video Ara": the user searches in Turkish. One Gemini request turns the
 * words into English and Hindi searches (most of these training videos are in
 * those languages), YouTube is searched in all three languages, and a second
 * request translates the result titles into Turkish. Two requests per search.
 */
export type FoundVideo = SearchResult & { turkishTitle: string };
const MAX_RESULTS = 15;

const QUERIES_SCHEMA = { type: "object", properties: { english: { type: "string" }, hindi: { type: "string" } }, required: ["english", "hindi"] };
const TITLES_SCHEMA = {
  type: "object",
  properties: { titles: { type: "array", items: { type: "object", properties: { i: { type: "integer" }, turkish: { type: "string" } }, required: ["i", "turkish"] } } },
  required: ["titles"],
};

/** Takes results from each list in turn, so every language is represented near the top. */
export function interleave(lists: SearchResult[][], max = MAX_RESULTS): SearchResult[] {
  const out: SearchResult[] = []; const seen = new Set<string>();
  for (let i = 0; out.length < max && lists.some(list => i < list.length); i++) {
    for (const list of lists) {
      const item = list[i];
      if (item && !seen.has(item.videoId) && out.length < max) { seen.add(item.videoId); out.push(item); }
    }
  }
  return out;
}

export async function searchInTurkish(options: GeminiOptions, query: string, onProgress: (message: string) => void): Promise<FoundVideo[]> {
  onProgress("Arama hazırlanıyor…");
  const queries = await generateJson<{ english: string; hindi: string }>(options, [{ text: `Bir usta YouTube'da tekstil/dikiş makinesi videosu arıyor. Türkçe araması: "${query}".
Bu aramanın YouTube'da en iyi sonucu verecek karşılığını yaz:
- english: İngilizce arama (ör. "overlock machine threading").
- hindi: Hintçe arama, Devanagari yazısıyla, ustaların kullandığı günlük sözcüklerle (ör. "ओवरलॉक मशीन में धागा कैसे डालें").
Makine marka ve model adlarını aynen koru.` }], QUERIES_SCHEMA, v => !!v.english?.trim());

  onProgress("YouTube'da aranıyor…");
  const lists = await Promise.all([queries.english, queries.hindi, query].filter(q => q?.trim()).map(q => searchYoutube(q.trim()).catch(() => [])));
  const found = interleave(lists);
  if (!found.length) throw new UserFacingError("Bu arama için video bulunamadı. Başka kelimelerle deneyin.", "video");

  onProgress("Başlıklar Türkçeye çevriliyor…");
  try {
    const answer = await generateJson<{ titles: Array<{ i: number; turkish: string }> }>(options, [{ text: `Aşağıdaki YouTube video başlıklarını kısa ve anlaşılır Türkçeye çevir. Emoji, büyük harf bağırmaları ve "#etiket"leri atla; makine adlarını ve numaraları koru. Her başlık için aynı "i" numarasıyla döndür.

${JSON.stringify(found.map((r, i) => ({ i, title: r.title })))}` }], TITLES_SCHEMA, v => Array.isArray(v.titles));
    const byIndex = new Map(answer.titles.map(t => [t.i, t.turkish.trim()]));
    return found.map((r, i) => ({ ...r, turkishTitle: byIndex.get(i) || r.title }));
  } catch (error) {
    // The videos are still useful with their original titles (e.g. when the day's quota ran out just now).
    if (error instanceof UserFacingError && error.code === "network") throw error;
    return found.map(r => ({ ...r, turkishTitle: r.title }));
  }
}
