import { Cue } from "../types";
import { findCueIndex, planSpeech, SpeechPlan } from "../utils/cues";
import { DubVoice } from "./voices";

export type VideoControls = { pause: () => void; resume: () => void };
/** What the screen shows: the cue on screen and whether the video is waiting for the voice. */
export type DubView = { index: number; text: string; waiting: "voice" | "preparing" | null };

const SEEK_JUMP_SECONDS = 2.5;
const PREFETCH = 3;

/**
 * Keeps the Turkish voice in step with the video ("elastic sync").
 * - When a cue starts, its Turkish sentence is spoken.
 * - If the previous sentence is still being spoken, the video is paused until
 *   it ends, so speech never drifts away from the picture.
 * - If a natural-voice clip is not generated yet, the video also waits.
 * The screen calls `tick` with the player's time about four times a second.
 */
export class DubController {
  private readonly plans: SpeechPlan[];
  private spoken = -1; private speaking: number | null = null; private pending: number | null = null;
  private held: DubView["waiting"] = null; private lastTime = -1; private lastIndex = -1; private run = 0;

  constructor(private readonly cues: Cue[], private readonly voice: DubVoice, private readonly video: VideoControls,
    private readonly onView: (view: DubView) => void, private enabled: boolean, baseRate: number) {
    this.plans = cues.map((cue, i) => planSpeech(cue, cues[i + 1]?.start, baseRate, voice.charsPerSecond));
  }

  plan(index: number): SpeechPlan | undefined { return this.plans[index]; }
  get waiting(): DubView["waiting"] { return this.held; }

  tick(time: number): void {
    const index = findCueIndex(this.cues, time);
    if (this.lastTime >= 0 && !this.held && Math.abs(time - this.lastTime) > SEEK_JUMP_SECONDS) this.reset(index, time);
    this.lastTime = time; this.lastIndex = index;
    if (!this.enabled) { this.emit(index); return; }
    for (let i = index + 1; i <= index + PREFETCH && i < this.cues.length; i++) this.prefetch(i);
    const cue = this.cues[index];
    if (cue && index > this.spoken && time < cue.end + 1) {
      if (this.speaking !== null) { this.pending = index; this.spoken = index; this.hold("voice"); }
      else void this.speak(index);
    }
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
    if (plan && !this.voice.isReady(String(i))) this.voice.prepare(String(i), plan.text, plan.rate).catch(() => undefined);
  }
  private hold(reason: NonNullable<DubView["waiting"]>): void { if (!this.held) this.video.pause(); this.held = reason; }
  private release(): void { if (this.held) { this.held = null; this.video.resume(); } }

  private async speak(index: number): Promise<void> {
    const run = this.run; const plan = this.plans[index];
    if (!plan) return;
    this.speaking = index; this.spoken = Math.max(this.spoken, index); this.pending = null;
    if (!this.voice.isReady(String(index))) this.hold("preparing");
    this.emit(index);
    let clip = null;
    try { clip = await this.voice.prepare(String(index), plan.text, plan.rate); } catch { /* skip this sentence */ }
    if (run !== this.run) return;
    this.release(); this.emit(index);
    if (clip) await this.voice.play(clip);
    if (run !== this.run) return;
    this.speaking = null;
    const next = this.pending;
    if (next !== null) void this.speak(next); else { this.release(); this.emit(this.lastIndex); }
  }

  private emit(index: number): void {
    const cue = this.cues[index];
    const text = !cue ? "" : this.enabled ? this.plans[index]?.text ?? cue.turkish : cue.turkish;
    this.onView({ index, text, waiting: this.held });
  }
}
