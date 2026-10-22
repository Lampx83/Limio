/**
 * Nhạc và hiệu ứng âm thanh cho màn host gameshow (màn chiếu cả lớp).
 *
 * Tổng hợp trực tiếp bằng Web Audio — không có file nhạc nào đi kèm, nên không
 * vướng bản quyền, không tốn băng thông và nhịp có thể đổi theo diễn biến
 * (câu hỏi gấp hơn khi còn ít giây). Chỉ host phát tiếng; máy người chơi im lặng
 * vì cả lớp ngồi cùng phòng, điện thoại mỗi người một nhạc sẽ chọi nhau.
 */

export type Mood = "lobby" | "question" | "urgent" | "off";
export type Sfx = "join" | "question" | "reveal" | "fanfare";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Steps = (number | null)[];

export interface MoodSpec {
  bpm: number;
  /** 32 bước 1/16 = 2 ô nhịp; số là nốt MIDI, null là nghỉ. */
  bass: Steps;
  lead: Steps;
  leadWave: OscillatorType;
  /** 16 ký tự cho 1 ô nhịp, 'x' là có đánh. */
  kick: string;
  hat: string;
  snare: string;
}

export const STEPS_PER_PATTERN = 32;

export const MOODS: Record<Exclude<Mood, "off">, MoodSpec> = {
  // Sảnh chờ: Đô trưởng, nhịp nhún nhảy cho không khí "sắp bắt đầu".
  lobby: {
    bpm: 116,
    bass: [
      48, null, 48, null, 55, null, 48, null, 53, null, 53, null, 55, null, 59, null,
      48, null, 48, null, 55, null, 48, null, 57, null, 55, null, 53, null, 55, null,
    ],
    lead: [
      72, null, 76, null, 79, null, 76, null, 77, null, 81, null, 79, null, 76, null,
      72, null, 76, null, 79, null, 84, null, 83, null, 81, null, 79, null, 76, null,
    ],
    leadWave: "triangle",
    kick: "x...x...x...x...",
    hat: "..x...x...x...x.",
    snare: "....x.......x...",
  },
  // Đang trả lời: La thứ, ostinato đều đều kiểu "đang suy nghĩ".
  question: {
    bpm: 122,
    bass: [
      45, null, 45, 57, 45, null, 45, 57, 43, null, 43, 55, 43, null, 43, 55,
      41, null, 41, 53, 41, null, 41, 53, 40, null, 40, 52, 40, null, 40, 52,
    ],
    lead: [
      null, null, 69, null, null, 72, null, null, 76, null, null, null, 74, null, null, null,
      null, null, 72, null, null, 69, null, null, 68, null, 71, null, 76, null, null, null,
    ],
    leadWave: "triangle",
    kick: "x...x...x...x...",
    hat: "..x...x...x...x.",
    snare: "",
  },
  // Những giây cuối: nhanh hơn, bass dồn từng nốt, tiếng bíp mỗi nhịp.
  urgent: {
    bpm: 150,
    bass: [
      45, 45, 57, 45, 45, 45, 57, 45, 43, 43, 55, 43, 43, 43, 55, 43,
      41, 41, 53, 41, 41, 41, 53, 41, 40, 40, 52, 40, 40, 40, 52, 40,
    ],
    lead: Array.from({ length: STEPS_PER_PATTERN }, (_, i) =>
      i % 4 === 0 ? (i >= 24 ? 84 : 81) : null,
    ),
    leadWave: "square",
    kick: "x...x...x...x...",
    hat: "xxxxxxxxxxxxxxxx",
    snare: "....x.......x...",
  },
};

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const MUSIC_VOLUME = 0.32;
const SFX_VOLUME = 0.9;
const MIN_JOIN_GAP_S = 0.09;

const hit = (pattern: string, step: number) => pattern[step % 16] === "x";

export class GameshowSoundEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private sfxBus: GainNode;
  private noise: AudioBuffer;

  private mood: Mood = "off";
  private muted = false;
  private bus: GainNode | null = null;
  private step = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastJoinAt = 0;
  private joinCount = 0;

  constructor() {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_VOLUME;
    this.sfxBus.connect(this.master);

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  get running() {
    return this.ctx.state === "running";
  }

  onStateChange(fn: () => void): () => void {
    this.ctx.addEventListener("statechange", fn);
    return () => this.ctx.removeEventListener("statechange", fn);
  }

  /** Cần gọi trong một cử chỉ của người dùng thì trình duyệt mới cho phát tiếng. */
  async resume(): Promise<void> {
    if (this.ctx.state === "running") return;
    try {
      await this.ctx.resume();
    } catch {
      /* bị chặn: vẫn im lặng, chờ cử chỉ kế tiếp */
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx.state !== "running") return;
    try {
      await this.ctx.suspend();
    } catch {
      /* bỏ qua */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.7, t, 0.03);
  }

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    const prev = this.mood;
    this.mood = mood;
    this.fadeOutBus();
    if (mood === "off") return;
    // Giữ vị trí trong bài khi chuyển bình thường → gấp (không giật về đầu).
    const keepPosition = prev === "question" && mood === "urgent";
    if (!keepPosition) this.step = 0;
    this.nextStepAt = this.ctx.currentTime + 0.06;
    const bus = this.ctx.createGain();
    bus.gain.setValueAtTime(0, this.ctx.currentTime);
    bus.gain.linearRampToValueAtTime(MUSIC_VOLUME, this.ctx.currentTime + 0.25);
    bus.connect(this.master);
    this.bus = bus;
  }

  sfx(kind: Sfx) {
    if (this.muted) return;
    const t = this.ctx.currentTime + 0.02;
    switch (kind) {
      case "join":
        return this.playJoin(t);
      case "question":
        return this.playQuestion(t);
      case "reveal":
        return this.playReveal(t);
      case "fanfare":
        return this.playFanfare(t);
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx.close().catch(() => undefined);
  }

  // ── Nhạc nền ────────────────────────────────────────────────────────────

  private fadeOutBus() {
    const old = this.bus;
    if (!old) return;
    this.bus = null;
    const t = this.ctx.currentTime;
    old.gain.cancelScheduledValues(t);
    old.gain.setTargetAtTime(0, t, 0.06);
    setTimeout(() => old.disconnect(), 600);
  }

  private schedule() {
    if (this.mood === "off" || !this.bus || this.ctx.state !== "running" || this.muted) {
      this.nextStepAt = Math.max(this.nextStepAt, this.ctx.currentTime);
      return;
    }
    const spec = MOODS[this.mood];
    const stepDur = 60 / spec.bpm / 4;
    // Bị treo lâu (tab ẩn) thì đừng phát dồn một loạt bước bù.
    if (this.nextStepAt < this.ctx.currentTime - 0.5) this.nextStepAt = this.ctx.currentTime + 0.05;
    while (this.nextStepAt < this.ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(spec, this.step % STEPS_PER_PATTERN, this.nextStepAt, stepDur, this.bus);
      this.step++;
      this.nextStepAt += stepDur;
    }
  }

  private playStep(spec: MoodSpec, i: number, t: number, stepDur: number, bus: GainNode) {
    const bass = spec.bass[i];
    if (bass != null) this.tone(hz(bass), t, stepDur * 1.7, "triangle", 0.9, bus, 900);
    const lead = spec.lead[i];
    if (lead != null) this.tone(hz(lead), t, stepDur * (spec.leadWave === "square" ? 0.7 : 1.8), spec.leadWave, 0.34, bus, 3200);
    if (hit(spec.kick, i)) this.kick(t, bus);
    if (hit(spec.snare, i)) this.noiseBurst(t, 0.1, "bandpass", 1900, 0.5, bus);
    if (hit(spec.hat, i)) this.noiseBurst(t, 0.035, "highpass", 7500, 0.22, bus);
  }

  // ── Hiệu ứng ────────────────────────────────────────────────────────────

  /** Có người vào phòng — tiếng bong nhẹ, cao dần theo số người để nghe như đang đầy lên. */
  private playJoin(t: number) {
    if (this.mood !== "lobby") return;
    if (t - this.lastJoinAt < MIN_JOIN_GAP_S) return;
    this.lastJoinAt = t;
    const base = 660 * 2 ** (([0, 2, 4, 7, 9][this.joinCount++ % 5] ?? 0) / 12);
    this.tone(base, t, 0.16, "sine", 0.5, this.sfxBus);
    this.tone(base * 1.5, t + 0.06, 0.2, "sine", 0.35, this.sfxBus);
  }

  /** Vào câu mới — tiếng vút + "tang". */
  private playQuestion(t: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.45);
    this.tone(hz(72), t + 0.3, 0.5, "triangle", 0.5, this.sfxBus);
    this.tone(hz(79), t + 0.3, 0.5, "triangle", 0.4, this.sfxBus);
  }

  /** Lộ đáp án — chuỗi chuông đi lên. */
  private playReveal(t: number) {
    [72, 76, 79, 84].forEach((n, i) => this.tone(hz(n), t + i * 0.075, 0.9, "sine", 0.5, this.sfxBus));
    this.tone(hz(88), t + 0.3, 1, "triangle", 0.25, this.sfxBus);
  }

  /** Về đích — "ta-ta-ta TAAA" kèn đồng + chũm choẹ. */
  private playFanfare(t: number) {
    const beat = 0.16;
    const notes: [number, number, number][] = [
      [72, 0, beat],
      [72, beat, beat],
      [72, beat * 2, beat],
      [76, beat * 3, beat * 2],
      [72, beat * 5, beat],
      [76, beat * 6, beat],
    ];
    for (const [n, at, dur] of notes) this.brass(hz(n), t + at, dur * 1.2);
    const end = t + beat * 7;
    for (const n of [72, 76, 79, 84]) this.brass(hz(n), end, 1.6);
    this.noiseBurst(end, 1.4, "highpass", 5000, 0.35, this.sfxBus);
    this.kick(end, this.sfxBus);
  }

  // ── Giọng cơ bản ────────────────────────────────────────────────────────

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode,
    lowpass?: number,
  ) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node = osc.connect(f);
    }
    node.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private brass(freq: number, t: number, dur: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(3000, t + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.02);
    g.gain.setValueAtTime(0.28, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f).connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(t: number, dest: AudioNode) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private noiseBurst(
    t: number,
    dur: number,
    filter: BiquadFilterType,
    cutoff: number,
    vol: number,
    dest: AudioNode,
  ) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
