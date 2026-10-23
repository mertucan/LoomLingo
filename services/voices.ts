import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { TurboModuleRegistry } from "react-native";
import { UserFacingError, VoiceId } from "../types";

/** A sentence ready to be played. Device speech has no file; Piper clips are WAV files. */
export type Clip = { key: string; text: string; rate: number; uri?: string };
/** The Turkish voice used for dubbing. `play` resolves when the clip has finished or was stopped. */
export interface DubVoice {
  /** Characters per second at rate 1.0, used to plan speech timing. */
  readonly charsPerSecond: number;
  isReady(key: string): boolean;
  prepare(key: string, text: string, rate: number): Promise<Clip>;
  play(clip: Clip): Promise<void>;
  stop(): void;
  dispose(): void;
}

// ---------- Phone voice (Android text-to-speech, free and offline) ----------

export function createDeviceVoice(): DubVoice {
  let finish: (() => void) | null = null;
  return {
    charsPerSecond: 14,
    isReady: () => true,
    prepare: async (key, text, rate) => ({ key, text, rate }),
    play: clip => new Promise<void>(resolve => {
      let done = false;
      const end = () => { if (!done) { done = true; finish = null; resolve(); } };
      finish = end;
      Speech.speak(clip.text, { language: "tr-TR", rate: clip.rate, onDone: end, onStopped: end, onError: end });
    }),
    stop: () => { void Speech.stop(); finish?.(); },
    dispose: () => { void Speech.stop(); finish?.(); },
  };
}

/** False when the phone has no Turkish text-to-speech voice installed. */
export async function hasTurkishDeviceVoice(): Promise<boolean> {
  try { return (await Speech.getAvailableVoicesAsync()).some(v => v.language.toLowerCase().startsWith("tr")); } catch { return true; }
}

// ---------- Natural voices (Piper via sherpa-onnx, offline, needs the APK) ----------

/**
 * Turkish Piper voices from the sherpa-onnx model releases. The int8 builds
 * (about 21 MB) are used: the fp16 builds fail to load in sherpa-onnx 1.12.
 * Measured on a PC: 16-18 characters per second at speed 1.0, generated in
 * 0.3-0.5x real time.
 */
export const PIPER_VOICES: Record<Exclude<VoiceId, "device">, { label: string; name: string; charsPerSecond: number }> = {
  "piper-fahrettin": { label: "Fahrettin", name: "fahrettin", charsPerSecond: 18 },
  "piper-fettah": { label: "Fettah", name: "fettah", charsPerSecond: 16 },
  "piper-dfki": { label: "Dfki", name: "dfki", charsPerSecond: 16 },
};
export type PiperVoiceId = keyof typeof PIPER_VOICES;
export const PIPER_SIZE_MB = 21;
const archiveName = (id: PiperVoiceId) => `vits-piper-tr_TR-${PIPER_VOICES[id].name}-medium-int8`;
const archiveUrl = (id: PiperVoiceId) => `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${archiveName(id)}.tar.bz2`;
const voiceRoot = (id: PiperVoiceId) => `${FileSystem.documentDirectory}piper/${id}/`;
/** Native libraries want plain paths, Expo APIs want file:// URIs. */
const plainPath = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ""));
const exists = async (uri: string) => (await FileSystem.getInfoAsync(uri)).exists;

/** The archive may extract with or without its top folder, so look in both places. */
async function findModelDir(id: PiperVoiceId): Promise<string | null> {
  for (const dir of [voiceRoot(id), `${voiceRoot(id)}${archiveName(id)}/`]) if (await exists(`${dir}tokens.txt`)) return dir;
  return null;
}
type SherpaTts = typeof import("react-native-sherpa-onnx/tts");
/**
 * Checked before importing: loading the package without its native modules
 * (Expo Go) shows a red error screen in development even when caught.
 */
const hasNativeSherpa = () => TurboModuleRegistry.get("SherpaOnnx") !== null && TurboModuleRegistry.get("ReactNativeFs") !== null;
async function loadSherpa(): Promise<SherpaTts | null> {
  if (!hasNativeSherpa()) return null;
  try { return await import("react-native-sherpa-onnx/tts"); } catch { return null; }
}
/** Natural voices need the native module, which exists in the APK but not in Expo Go. */
export const isPiperSupported = async () => (await loadSherpa()) !== null;
export const isPiperInstalled = async (id: PiperVoiceId) => (await findModelDir(id)) !== null;

export async function installPiperVoice(id: PiperVoiceId, onProgress: (fraction: number) => void): Promise<void> {
  const archive = `${FileSystem.cacheDirectory}${archiveName(id)}.tar.bz2`;
  try {
    await FileSystem.makeDirectoryAsync(voiceRoot(id), { intermediates: true });
    const download = FileSystem.createDownloadResumable(archiveUrl(id), archive, {}, p => {
      if (p.totalBytesExpectedToWrite > 0) onProgress(0.85 * p.totalBytesWritten / p.totalBytesExpectedToWrite);
    });
    const result = await download.downloadAsync();
    if (!result || result.status !== 200) throw new Error(`download ${result?.status}`);
    const { extractArchive } = await import("react-native-sherpa-onnx/extraction");
    const extracted = await extractArchive({ modelId: id, archivePath: plainPath(archive), format: "tar.bz2" }, plainPath(voiceRoot(id)), { onProgress: e => onProgress(0.85 + 0.15 * e.percent / 100) });
    if (!extracted.success || !(await findModelDir(id))) throw new Error("extract");
    onProgress(1);
  } catch {
    await FileSystem.deleteAsync(voiceRoot(id), { idempotent: true });
    throw new UserFacingError("Ses indirilemedi. İnternet bağlantısını (tercihen Wi-Fi) kontrol edip tekrar deneyin.", "network");
  } finally { await FileSystem.deleteAsync(archive, { idempotent: true }); }
}
export async function removePiperVoice(id: PiperVoiceId): Promise<void> { await FileSystem.deleteAsync(voiceRoot(id), { idempotent: true }); }

const hash = (text: string) => { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** Generates sentences one at a time in the background and caches the WAV files per video. */
export async function createPiperVoice(id: PiperVoiceId, videoId: string): Promise<DubVoice> {
  const sherpa = await loadSherpa(); const dir = await findModelDir(id);
  if (!sherpa || !dir) throw new UserFacingError("Doğal ses bu telefonda hazır değil. Ayarlar'dan sesi indirin ya da telefonun sesini seçin.");
  const engine = await sherpa.createTTS({ modelPath: { type: "file", path: plainPath(dir) }, modelType: "vits", numThreads: 4 });
  await setAudioModeAsync({ interruptionMode: "mixWithOthers", playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined);
  const clipDir = `${FileSystem.cacheDirectory}dub/${videoId}/${id}/`;
  await FileSystem.makeDirectoryAsync(clipDir, { intermediates: true }).catch(() => undefined);
  const clips = new Map<string, Promise<Clip>>(); const ready = new Set<string>();
  let queue: Promise<unknown> = Promise.resolve();
  let current: { stop: () => void } | null = null; let disposed = false;
  return {
    charsPerSecond: PIPER_VOICES[id].charsPerSecond,
    isReady: key => ready.has(key),
    prepare(key, text, rate) {
      const known = clips.get(key); if (known) return known;
      const uri = `${clipDir}${hash(`${key}|${text}`)}-${Math.round(rate * 100)}.wav`;
      const clip = queue.then(async (): Promise<Clip> => {
        if (disposed) throw new Error("disposed");
        if (!(await exists(uri))) await sherpa.saveAudioToFile(await engine.generateSpeech(text, { speed: rate }), plainPath(uri));
        ready.add(key); return { key, text, rate, uri };
      });
      queue = clip.catch(() => undefined); clips.set(key, clip);
      clip.catch(() => clips.delete(key));
      return clip;
    },
    play: clip => new Promise<void>(resolve => {
      if (!clip.uri) { resolve(); return; }
      const player = createAudioPlayer({ uri: clip.uri });
      let done = false;
      const end = () => { if (done) return; done = true; subscription.remove(); player.remove(); current = null; resolve(); };
      const subscription = player.addListener("playbackStatusUpdate", status => { if (status.didJustFinish) end(); });
      current = { stop: () => { player.pause(); end(); } };
      player.play();
    }),
    stop: () => current?.stop(),
    dispose: () => { disposed = true; current?.stop(); void queue.then(() => engine.destroy()).catch(() => undefined); },
  };
}

/** The voice chosen in Settings, falling back to the phone voice when the natural voice is unavailable. */
export async function createVoice(voice: VoiceId, videoId: string): Promise<{ voice: DubVoice; fellBack: boolean }> {
  if (voice === "device") return { voice: createDeviceVoice(), fellBack: false };
  try { return { voice: await createPiperVoice(voice, videoId), fellBack: false }; } catch { return { voice: createDeviceVoice(), fellBack: true }; }
}
