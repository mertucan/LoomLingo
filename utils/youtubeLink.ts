export type ParsedYoutubeLink = { videoId: string; canonicalUrl: string };
const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYoutubeLink(input: string): ParsedYoutubeLink | null {
  const candidate = input.trim().match(/https?:\/\/[^\s]+/)?.[0] ?? input.trim();
  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let videoId: string | null = null;
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      videoId = url.pathname === "/watch" ? url.searchParams.get("v") :
        (/^\/(?:shorts|live|embed)\/([^/?]+)/.exec(url.pathname)?.[1] ?? null);
    }
    return videoId && ID.test(videoId) ? { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` } : null;
  } catch { return null; }
}
