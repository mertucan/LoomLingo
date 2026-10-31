import { Cue } from "../types";
import { findCueIndex, planSpeech, SpeechPlan } from "../utils/cues";
import { DubVoice } from "./voices";

export type VideoControls = { pause: () => void; resume: () => void };
/** What the screen shows: the cue on screen and whether the video is waiting for the voice. */
export type DubView = { index: number; text: string; waiting: "voice" | "preparing" | null };

const SEEK_JUMP_SECONDS = 2.5;
const PREFETCH = 3;
/** The voice may run this far behind the picture before the video waits for it. */
const MAX_LAG_SECONDS = 1.5;
/** After this many sentences in a row fail, the voice is treated as broken. */
const FAILURES_BEFORE_GIVING_UP = 2;

/**
 * Keeps the Turkish voice in step with the video ("elastic sync").
 * - When a cue starts, its Turkish sentence is spoken.
 * - If the previous sentence is still being spoken, the next one waits; only
 *   when the voice falls more than MAX_LAG_SECONDS behind is the video paused
 *   until it catches up, so speech never drifts away from the picture.
 * - Cues with nothing to say ("[Müzik]") are shown but not spoken.
 * - If the voice keeps failing, `onVoiceFailed` is called and the controller
 *   continues with subtitles only.
 * - If a natural-voice clip is not generated yet, the video also waits.
 * The screen calls `tick` with the player's time about four times a second.
 */
export class DubController {
  private readonly plans: SpeechPlan[];
  private spoken = -1; private speaking: number | null = null; private pending: number | null = null;
  private held: DubView["waiting"] = null; private lastTime = -1; private lastIndex = -1; private run = 0;
  private pendingSince = 0; private failures = 0;

  constructor(private readonly cues: Cue[], private readonly voice: DubVoice, private readonly video: VideoControls,
    private readonly onView: (view: DubView) => void, private enabled: boolean, baseRate: number,
    private readonly onVoiceFailed?: () => void) {
    this.plans = cues.map((cue, i) => planSpeech(cue, cues[i + 1]?.start, baseRate, voice.charsPerSecond));
  }

  plan(index: number): SpeechPlan | undefined { return this.plans[index]; }
  /** Natural voices: generate every sentence in the background so playback rarely waits. */
  prepareAll(onProgress: (ready: number, total: number) => void): boolean {
    if (!this.voice.prepareAll) return false;
    this.voice.prepareAll(this.plans.map((plan, i) => ({ key: String(i), text: plan.text, rate: plan.rate })).filter(item => item.text), onProgress);
    return true;
  }
  get waiting(): DubView["waiting"] { return this.held; }

  tick(time: number): void {
    const index = findCueIndex(this.cues, time);
    if (this.lastTime >= 0 && !this.held && Math.abs(time - this.lastTime) > SEEK_JUMP_SECONDS) this.reset(index, time);
    this.lastTime = time; this.lastIndex = index;
    if (!this.enabled) { this.emit(index); return; }
    for (let i = index + 1; i <= index + PREFETCH && i < this.cues.length; i++) this.prefetch(i);
    const cue = this.cues[index];
    if (cue && index > this.spoken && time < cue.end + 1) {
      if (!this.plans[index]?.text) this.spoken = index; // nothing to say
      else if (this.speaking !== null) { this.pending = index; this.spoken = index; this.pendingSince = time; }
      else void this.speak(index);
    }
    if (this.pending !== null && this.speaking !== null && !this.held && time - this.pendingSince > MAX_LAG_SECONDS) this.hold("voice");
    this.emit(this.speaking ?? index);
  }

  /** The user pressed pause: stop speaking; the current sentence is repeated on play. */
  userPaused(): void { this.cancel(); this.spoken = this.lastIndex - 1; this.emit(this.lastIndex); }
  setEnabled(enabled: boolean): void {
    this.enabled = enabled; this.cancel(); this.spoken = this.lastIndex - 1;
    this.emit(this.lastIndex);
  }
  dispose(): void { this.run++; this.voice.stop(); }

  private reset(index: number, time: number): void {
    this.cancel();
    // After a jump, speak the cue we landed in only if we are near its start.
    const cue = this.cues[index];
    this.spoken = cue && time - cue.start < 1.5 ? index - 1 : index;
  }
  private cancel(): void {
    this.run++; this.voice.stop(); this.speaking = null; this.pending = null;
    if (this.held) { this.held = null; this.video.resume(); }
  }
  private prefetch(i: number): void {
    const plan = this.plans[i];
    if (plan?.text && !this.voice.isReady(String(i))) this.voice.prepare(String(i), plan.text, plan.rate).catch(() => undefined);
  }
  private hold(reason: NonNullable<DubView["waiting"]>): void { if (!this.held) this.video.pause(); this.held = reason; }
  private release(): void { if (this.held) { this.held = null; this.video.resume(); } }

  private async speak(index: number): Promise<void> {
    const run = this.run; const plan = this.plans[index];
    if (!plan) return;
    this.speaking = index; this.spoken = Math.max(this.spoken, index); this.pending = null;
    if (!this.voice.isReady(String(index))) this.hold("preparing");
    this.emit(index);
    let ok = true;
    try {
      const clip = await this.voice.prepare(String(index), plan.text, plan.rate);
      if (run !== this.run) return;
      this.release(); this.emit(index);
      await this.voice.play(clip);
    } catch { ok = false; }
    if (run !== this.run) return;
    this.failures = ok ? 0 : this.failures + 1;
    if (this.failures >= FAILURES_BEFORE_GIVING_UP) { this.giveUpVoice(); return; }
    this.speaking = null;
    const next = this.pending;
    if (next !== null) void this.speak(next); else { this.release(); this.emit(this.lastIndex); }
  }

  /** The voice is not working: continue with subtitles only and let the screen tell the user. */
  private giveUpVoice(): void {
    this.cancel(); this.enabled = false; this.failures = 0;
    this.emit(this.lastIndex);
    this.onVoiceFailed?.();
  }

  private emit(index: number): void {
    const cue = this.cues[index];
    const text = !cue ? "" : this.enabled ? this.plans[index]?.text || cue.turkish : cue.turkish;
    this.onView({ index, text, waiting: this.held });
  }
}
