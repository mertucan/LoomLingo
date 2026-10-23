import { TimestampedParagraph } from "../types";

export type CaptionLine = { startMs: number; durationMs: number; text: string };
const SENTENCE_END = /[.!?。！？।]["')\]]*$/;

/**
 * Caption tracks arrive as many short screen lines. Join them into readable
 * paragraphs: break after a finished sentence once a paragraph is long enough,
 * at a long pause, or when it reaches the hard limit (auto captions often have
 * no punctuation at all).
 */
export function groupCaptionLines(lines: CaptionLine[], minChars = 220, maxChars = 450, pauseMs = 4000): TimestampedParagraph[] {
  const paragraphs: TimestampedParagraph[] = [];
  let text = ""; let start = 0; let lastEnd = 0;
  const flush = () => { if (text) paragraphs.push({ startSeconds: Math.floor(start / 1000), original: text, turkish: "" }); text = ""; };
  for (const line of lines) {
    const clean = line.text.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (text && line.startMs - lastEnd > pauseMs) flush();
    if (text && text.length + clean.length + 1 > maxChars) flush();
    if (!text) start = line.startMs;
    text = text ? `${text} ${clean}` : clean;
    lastEnd = line.startMs + line.durationMs;
    if (text.length >= minChars && SENTENCE_END.test(text)) flush();
  }
  flush(); return paragraphs;
}

/** Characters of speech per minute; very low values mean an unusable track. */
export function captionDensity(paragraphs: TimestampedParagraph[], lengthSeconds: number | null): number {
  const chars = paragraphs.reduce((sum, p) => sum + p.original.length, 0);
  const lastStart = paragraphs.at(-1)?.startSeconds ?? 0;
  const minutes = Math.max(1, (lengthSeconds ?? lastStart) / 60);
  return chars / minutes;
}
