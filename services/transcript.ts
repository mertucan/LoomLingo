import { Cue, UserFacingError } from "../types";
import { CaptionLine, groupCaptionLines } from "../utils/cues";

/**
 * Everything that talks to YouTube directly lives in this file, so a YouTube
 * change only needs a fix here. Gemini's video input remains the fallback.
 *
 * Method (checked October 2026): the official YouTube Data API only lets a
 * video's owner download captions, and the old public
 * `api/timedtext?type=list` endpoint now returns nothing. The caption URLs on
 * the watch web page also return empty bodies without a proof-of-origin
 * token. The Innertube `player` endpoint used by YouTube's own Android app
 * still returns the caption track list, title and length, and its caption URLs
 * can be downloaded directly. If this breaks, update CLIENT first (a newer
 * YouTube app version string), then the field names in `getVideoInfo`.
 */
const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, hl: "en", gl: "US" };
const USER_AGENT = `com.google.android.youtube/${CLIENT.clientVersion} (Linux; U; Android 14) gzip`;

export type CaptionTrack = { baseUrl: string; languageCode: string; automatic: boolean };
export type VideoInfo = {
  title: string | null; lengthSeconds: number | null;
  /** "unavailable": removed or wrong ID. "restricted": private, age-restricted or sign-in required. */
  status: "ok" | "unavailable" | "restricted" | "unknown";
  captionTracks: CaptionTrack[];
};
export type CaptionTranscript = { languageCode: string; automatic: boolean; cues: Cue[] };

type PlayerResponse = {
  playabilityStatus?: { status?: string };
  videoDetails?: { title?: string; lengthSeconds?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> } };
};

async function request(url: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(url, init); }
  catch { throw new UserFacingError("İnternet bağlantısı yok.", "network"); }
}

/** Public metadata from oEmbed; used when the player endpoint gives no title. */
async function getOEmbedTitle(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`);
    return response.ok ? ((await response.json()) as { title?: string }).title ?? null : null;
  } catch { return null; }
}

/** Never throws for YouTube-side problems; only for a missing internet connection. */
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  let data: PlayerResponse = {};
  const response = await request(PLAYER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT, "x-youtube-client-name": "3", "x-youtube-client-version": CLIENT.clientVersion },
    body: JSON.stringify({ context: { client: CLIENT }, videoId, contentCheckOk: true, racyCheckOk: true }),
  });
  try { if (response.ok) data = await response.json() as PlayerResponse; } catch { /* format changed: treated as unknown */ }
  const playability = data.playabilityStatus?.status;
  const status: VideoInfo["status"] = playability === "OK" ? "ok" : playability === "ERROR" ? "unavailable" : playability === "LOGIN_REQUIRED" || playability === "UNPLAYABLE" ? "restricted" : "unknown";
  const length = Number(data.videoDetails?.lengthSeconds);
  const captionTracks = (data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [])
    .filter((t): t is { baseUrl: string; languageCode: string; kind?: string } => !!t.baseUrl && !!t.languageCode)
    .map(t => ({ baseUrl: t.baseUrl, languageCode: t.languageCode, automatic: t.kind === "asr" }));
  return { title: data.videoDetails?.title ?? await getOEmbedTitle(videoId), lengthSeconds: length > 0 ? length : null, status, captionTracks };
}

/**
 * Track preference: a human Turkish track (no translation needed), then a
 * human track in the spoken language (the automatic track's language tells
 * us which one that is), then any human track, then the automatic track.
 * YouTube's own machine translation (`tlang=tr`) is deliberately not used:
 * it is weak on textile terms and Gemini gets the glossary.
 */
export function chooseCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const base = (code: string) => code.toLowerCase().split("-")[0];
  const manual = tracks.filter(t => !t.automatic); const automatic = tracks.find(t => t.automatic);
  return manual.find(t => base(t.languageCode) === "tr")
    ?? (automatic && manual.find(t => base(t.languageCode) === base(automatic.languageCode)))
    ?? manual[0] ?? automatic ?? null;
}

/** Returns null when the video has no usable caption track. */
export async function getCaptionTranscript(info: VideoInfo): Promise<CaptionTranscript | null> {
  const track = chooseCaptionTrack(info.captionTracks);
  if (!track) return null;
  const url = `${track.baseUrl.replace(/&fmt=[^&]*/g, "")}&fmt=json3`;
  const response = await request(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const body = await response.text();
  if (!body.trim()) return null;
  let data: { events?: Array<{ tStartMs?: number; dDurationMs?: number; aAppend?: number; segs?: Array<{ utf8?: string }> }> };
  try { data = JSON.parse(body) as typeof data; } catch { return null; }
  const lines: CaptionLine[] = (data.events ?? [])
    .filter(e => e.segs && !e.aAppend)
    .map(e => ({ startMs: e.tStartMs ?? 0, durationMs: e.dDurationMs ?? 0, text: (e.segs ?? []).map(s => s.utf8 ?? "").join("") }));
  const cues = groupCaptionLines(lines);
  return cues.length ? { languageCode: track.languageCode, automatic: track.automatic, cues } : null;
}

// ---------- Search (YouTube's own web search endpoint, also unofficial) ----------

const SEARCH_URL = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
const WEB_CLIENT = { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "IN" };
export type SearchResult = { videoId: string; title: string; channel: string; lengthText: string; lengthSeconds: number };

const toSeconds = (text: string) => text.split(":").map(Number).reduce((total, part) => total * 60 + (Number.isFinite(part) ? part : 0), 0);
type Runs = { runs?: Array<{ text?: string }>; simpleText?: string };
const textOf = (value?: Runs) => value?.simpleText ?? value?.runs?.map(r => r.text ?? "").join("") ?? "";

/** Collects normal videos (no live streams, no Shorts under a minute) from a search response, in page order. */
export function parseSearchResults(data: unknown): SearchResult[] {
  const results: SearchResult[] = []; const seen = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const renderer = (node as { videoRenderer?: { videoId?: string; title?: Runs; ownerText?: Runs; lengthText?: Runs } }).videoRenderer;
    if (renderer?.videoId && !seen.has(renderer.videoId)) {
      const lengthText = textOf(renderer.lengthText);
      if (lengthText && toSeconds(lengthText) >= 60) {
        seen.add(renderer.videoId);
        results.push({ videoId: renderer.videoId, title: textOf(renderer.title), channel: textOf(renderer.ownerText), lengthText, lengthSeconds: toSeconds(lengthText) });
      }
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(data);
  return results;
}

export async function searchYoutube(query: string): Promise<SearchResult[]> {
  const response = await request(SEARCH_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: { client: WEB_CLIENT }, query }) });
  if (!response.ok) return [];
  try { return parseSearchResults(await response.json()); } catch { return []; }
}
