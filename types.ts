export type TimestampedParagraph = { startSeconds?: number; original: string; turkish: string };
/** One subtitle line. `spoken` is a shorter version for the Turkish voice when `turkish` would not fit its time. */
export type Cue = { start: number; end: number; original: string; turkish: string; spoken?: string };
/** One step of a how-to video, for the "Adımlar" list. */
export type Step = { start: number; title: string; detail: string };
export type TranslationResult = {
  videoId: string; url: string; title: string; sourceLanguage: string;
  paragraphs: TimestampedParagraph[]; createdAt: string; method: "captions" | "gemini-video";
  /** Missing on results saved before subtitles/dubbing existed; those need a new translation to be watched. */
  cues?: Cue[]; lengthSeconds?: number | null;
  /** Made on first use of "Adımlar" and kept with the video. */
  steps?: Step[];
};
export type GlossaryEntry = { id: string; source: string; turkish: string };
export type VoiceId = "device" | "piper-fahrettin" | "piper-fettah" | "piper-dfki";
export type Settings = {
  fontScale: number; theme: "light" | "dark"; showTimestamps: boolean; glossary: GlossaryEntry[];
  voice: VoiceId; speechRate: number; dubbing: boolean;
};
export type ErrorCode = "quota" | "key" | "network" | "video" | "other";
export class UserFacingError extends Error { constructor(public readonly userMessage: string, public readonly code: ErrorCode = "other") { super(userMessage); } }
