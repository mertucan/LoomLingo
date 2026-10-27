/** Keeps sentences together where possible, never exceeds max characters. */
export function splitTextIntoChunks(text: string, maxChars = 7000): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = (clean.match(/[^.!?。！？।]+[.!?。！？।]*|.+$/g) ?? [clean]).map(sentence => sentence.trim());
  const chunks: string[] = []; let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) { chunks.push(current.trim()); current = ""; }
      for (let i = 0; i < sentence.length; i += maxChars) chunks.push(sentence.slice(i, i + maxChars).trim());
    } else if (`${current} ${sentence}`.trim().length > maxChars && current) {
      chunks.push(current.trim()); current = sentence;
    } else current = `${current} ${sentence}`.trim();
  }
  if (current) chunks.push(current.trim()); return chunks;
}

/** Groups items into translation requests by their `original` text length, without splitting an item. */
export function batchByLength<T extends { original: string }>(items: T[], maxChars = 6000): T[][] {
  const batches: T[][] = []; let current: T[] = []; let size = 0;
  for (const item of items) {
    if (current.length && size + item.original.length > maxChars) { batches.push(current); current = []; size = 0; }
    current.push(item); size += item.original.length;
  }
  if (current.length) batches.push(current); return batches;
}

export type VideoSegment = { startSeconds: number; endSeconds: number };
/**
 * The Gemini video path is split into short, equal sections. Asked for a long
 * stretch at once, Gemini summarises. Measured on a 13-minute Hindi video
 * against its caption track: one request gave about half the text, 5-minute
 * sections 65-85 %, 3-minute sections about 95 %. Equal sizes avoid a tiny
 * last section.
 */
export function planVideoSegments(lengthSeconds: number | null, segmentSeconds = 180, singleRequestLimit = 240): VideoSegment[] | null {
  if (!lengthSeconds || lengthSeconds <= singleRequestLimit) return null;
  const count = Math.ceil(lengthSeconds / segmentSeconds); const size = lengthSeconds / count;
  return Array.from({ length: count }, (_, i) => ({ startSeconds: Math.round(i * size), endSeconds: i === count - 1 ? lengthSeconds : Math.round((i + 1) * size) }));
}
