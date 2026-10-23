export type TimestampedParagraph = { startSeconds?: number; original: string; turkish: string };
export type TranslationResult = {
  videoId: string; url: string; title: string; sourceLanguage: string;
  paragraphs: TimestampedParagraph[]; createdAt: string; method: "captions" | "gemini-video";
};
export type GlossaryEntry = { id: string; source: string; turkish: string };
export type Settings = { fontScale: number; theme: "light" | "dark"; showTimestamps: boolean; glossary: GlossaryEntry[] };
export class UserFacingError extends Error { constructor(public readonly userMessage: string) { super(userMessage); } }
