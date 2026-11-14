/** All sound is synthesised with WebAudio: no audio files, no licences to track. */

// One AudioContext for the whole game. Browsers only let audio start from a click or key press,
// and a context created later (when a cutscene mounts after a lazy load) can stay suspended,
// which is silent. So the context is created or resumed on every user gesture and shared.
let shared: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!shared) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { shared = new AC(); } catch { return null; }
  }
  if (shared.state === "suspended") void shared.resume().catch(() => { /* waits for the next gesture */ });
  return shared;
}
if (typeof window !== "undefined") {
  const unlock = () => { audioContext(); };
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { capture: true, passive: true });
}

/** The player's sound choice, shared by every cutscene and the descent, and remembered. */
const SOUND_KEY = "analog-atlas-sound";
export function soundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* not remembered */ }
}

export class CutsceneAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private rumbleGain!: GainNode;
  private roarGain!: GainNode;
  private windGain!: GainNode;
  private noise!: AudioBuffer;
  muted = false;

  private sources: AudioScheduledSourceNode[] = [];

  /** Starts this player's sound on the shared context (unlocked by any earlier click or key). */
  start() {
    if (this.ctx) return;
    const ctx = audioContext();
    if (!ctx) return;
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.rumbleGain = this.loop(140, "lowpass");
    // The rumble is below what laptop and phone speakers can play, so the engine also gets a roar
    // in the range they do reproduce.
    this.roarGain = this.loop(750, "bandpass", 0.6);
    this.windGain = this.loop(500, "bandpass");
  }

  private loop(freq: number, type: BiquadFilterType, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master); src.start();
    this.sources.push(src);
    return g;
  }

  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.value = m ? 0 : 0.8; }
  setThrust(v: number) {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => { /* next gesture */ });
    this.rumbleGain.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.08);
    this.roarGain.gain.setTargetAtTime(v * 0.55, this.ctx.currentTime, 0.08);
  }
  setWind(v: number) { if (this.ctx) this.windGain.gain.setTargetAtTime(v * 0.22, this.ctx.currentTime, 0.4); }

  /** A rising rush of air: for a scene change or a fast pass. */
  whoosh(seconds = 1.6, level = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.8;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(1600, t + seconds * 0.7); f.frequency.exponentialRampToValueAtTime(500, t + seconds);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + seconds * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + seconds + 0.05);
  }

  explosion(power = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = "lowpass";
    f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(60, t + 2.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.4 * power, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 2.7);
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    const og = ctx.createGain(); og.gain.setValueAtTime(1.2 * power, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 1.4);
  }

  /** A latch closing: two sharp ticks over a short metallic knock, in a range small speakers play. */
  clunk() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [at, level] of [[0, 0.8], [0.11, 0.5]]) {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(level, t + at); g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.05);
      src.connect(f).connect(g).connect(this.master); src.start(t + at, Math.random()); src.stop(t + at + 0.07);
    }
    const o = ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.16);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.25);
  }

  thud() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.32);
  }

  beep(freq = 880) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.25);
  }

  /** Silences this player. The shared context stays open for the next scene. */
  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.05);
    const master = this.master, sources = this.sources;
    setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } }); master.disconnect(); }, 300);
    this.sources = []; this.ctx = null;
  }
}
