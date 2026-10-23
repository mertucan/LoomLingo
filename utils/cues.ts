import { Cue, TimestampedParagraph } from "../types";

export type CaptionLine = { startMs: number; durationMs: number; text: string };
const SENTENCE_END = /[.!?。！？।]["')\]]*$/;

/**
 * Caption tracks arrive as short screen lines (2-4 s). Join them into
 * subtitle cues of about one sentence: break after a finished sentence, at a
 * pause, or at the length/duration limit (auto captions often have no
 * punctuation at all).
 */
export function groupCaptionLines(lines: CaptionLine[], { minChars = 40, maxChars = 160, maxMs = 9000, pauseMs = 1200 } = {}): Cue[] {
  const cues: Cue[] = [];
  let text = ""; let start = 0; let end = 0;
  const flush = () => { if (text) cues.push({ start: start / 1000, end: end / 1000, original: text, turkish: "" }); text = ""; };
  for (const line of lines) {
    const clean = line.text.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (text && (line.startMs - end > pauseMs || text.length + clean.length + 1 > maxChars || line.startMs + line.durationMs - start > maxMs)) flush();
    if (!text) start = line.startMs;
    text = text ? `${text} ${clean}` : clean;
    end = line.startMs + line.durationMs;
    if (text.length >= minChars && SENTENCE_END.test(text)) flush();
  }
  flush(); return normalizeCues(cues);
}

/** Sorts cues, drops empty ones, and makes sure each ends after it starts and before the next one starts. */
export function normalizeCues(cues: Cue[], lengthSeconds?: number | null): Cue[] {
  const sorted = cues.filter(c => c.original.trim() || c.turkish.trim()).map(c => ({ ...c, start: Math.max(0, Number(c.start) || 0), end: Number(c.end) || 0 })).sort((a, b) => a.start - b.start);
  return sorted.map((cue, i) => {
    const next = sorted[i + 1]?.start ?? (lengthSeconds ?? Infinity);
    const end = cue.end > cue.start ? Math.min(cue.end, next) : Math.min(cue.start + 4, next);
    return { ...cue, end: end > cue.start ? end : cue.start + 0.5 };
  });
}

/**
 * Parses "MM:SS", "H:MM:SS" or "MM:SS.s" into seconds. Gemini gives reliable
 * video timestamps in this form; asked for plain seconds it sometimes writes
 * 5:26 as 526.
 */
export function parseTimestamp(value: string | number): number {
  if (typeof value === "number") return value;
  const parts = value.trim().split(":").map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n))) return Number.NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * Splits cues that are too long for the subtitle box at Turkish sentence
 * boundaries, sharing the time by text length. The original text stays on
 * the first piece so the reading view is not duplicated.
 */
/** Word-wraps text into pieces of at most maxChars, ending a piece at a sentence end once it is half full. */
export function subtitlePieces(text: string, maxChars: number): string[] {
  const pieces: string[] = []; let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + word.length + 1 > maxChars) { pieces.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
    if (current.length >= maxChars / 2 && SENTENCE_END.test(current)) { pieces.push(current); current = ""; }
  }
  if (current) pieces.push(current); return pieces;
}

export function splitLongCues(cues: Cue[], maxSeconds = 9, maxChars = 120): Cue[] {
  return cues.flatMap(cue => {
    if (cue.end - cue.start <= maxSeconds && cue.turkish.length <= maxChars) return [cue];
    const pieces = subtitlePieces(cue.turkish, maxChars);
    if (pieces.length < 2) return [cue];
    const total = pieces.reduce((sum, p) => sum + p.length, 0); let start = cue.start;
    return pieces.map((turkish, i) => {
      const end = i === pieces.length - 1 ? cue.end : start + (cue.end - cue.start) * turkish.length / total;
      const piece: Cue = { start, end, original: i === 0 ? cue.original : "", turkish };
      start = end; return piece;
    });
  });
}

/** Reading-screen paragraphs built from cues. */
export function cuesToParagraphs(cues: Cue[], maxChars = 450): TimestampedParagraph[] {
  const paragraphs: TimestampedParagraph[] = [];
  let current: TimestampedParagraph | null = null;
  for (const cue of cues) {
    if (!current || current.turkish.length + cue.turkish.length > maxChars) {
      current = { startSeconds: Math.floor(cue.start), original: cue.original, turkish: cue.turkish }; paragraphs.push(current);
    } else { current.original += ` ${cue.original}`; current.turkish += ` ${cue.turkish}`; }
  }
  return paragraphs;
}

/** Index of the cue on screen at `time`: the last cue that has started, or -1 before the first one. */
export function findCueIndex(cues: Cue[], time: number): number {
  let low = 0; let high = cues.length - 1; let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((cues[mid]?.start ?? Infinity) <= time) { found = mid; low = mid + 1; } else high = mid - 1;
  }
  return found;
}

/** Characters of speech per minute; very low values mean an unusable caption track. */
export function captionDensity(cues: Cue[], lengthSeconds: number | null): number {
  const chars = cues.reduce((sum, c) => sum + c.original.length, 0);
  const minutes = Math.max(1, (lengthSeconds ?? cues.at(-1)?.end ?? 0) / 60);
  return chars / minutes;
}

export type SpeechPlan = { text: string; rate: number };
export const MAX_SPEECH_RATE = 1.25;
/**
 * Picks the text and speed for one cue. The voice may use the time until the
 * next cue starts. If the full translation would not fit, the short `spoken`
 * version is used, then the speed is raised up to MAX_SPEECH_RATE. Anything
 * still too long is handled by briefly pausing the video.
 * `charsPerSecond` is the voice's speed at rate 1.0.
 */
export function planSpeech(cue: Cue, nextStart: number | undefined, baseRate: number, charsPerSecond: number): SpeechPlan {
  const slot = Math.max(0.8, (nextStart ?? cue.end + 1.5) - cue.start);
  const fits = (text: string) => text.length / (charsPerSecond * baseRate) <= slot;
  const text = !fits(cue.turkish) && cue.spoken?.trim() ? cue.spoken.trim() : cue.turkish;
  const needed = text.length / (charsPerSecond * slot);
  return { text, rate: Math.round(Math.min(Math.max(baseRate, needed), Math.max(baseRate, MAX_SPEECH_RATE)) * 100) / 100 };
}

/** Rough character budget for the short spoken version of a cue. */
export const spokenBudget = (seconds: number) => Math.max(12, Math.floor(seconds * 14));
