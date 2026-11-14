/** All sound is synthesised with WebAudio: no audio files, no licences to track. */
export class CutsceneAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private rumbleGain!: GainNode;
  private windGain!: GainNode;
  private noise!: AudioBuffer;
  muted = false;

  /** Must run after a user gesture (the click that starts the cutscene is enough). */
  start() {
    if (this.ctx || typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.rumbleGain = this.loop(140, "lowpass");
    this.windGain = this.loop(500, "bandpass");
    void ctx.resume();
  }

  private loop(freq: number, type: BiquadFilterType) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master); src.start();
    return g;
  }

  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.value = m ? 0 : 0.8; }
  setThrust(v: number) { if (this.ctx) this.rumbleGain.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.08); }
  setWind(v: number) { if (this.ctx) this.windGain.gain.setTargetAtTime(v * 0.12, this.ctx.currentTime, 0.4); }

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

  stop() { if (this.ctx) { void this.ctx.close(); this.ctx = null; } }
}
