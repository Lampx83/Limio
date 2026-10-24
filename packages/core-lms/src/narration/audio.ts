import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Ghép và mã hoá âm thanh thuần Node — không cần ffmpeg. NEU TTS trả WAV 48 kHz mono 16-bit (mỗi lần gọi một tệp WAV
 * đủ header); ta bóc phần dữ liệu PCM, nối các đoạn cùng chen khoảng lặng, rồi mã hoá một tệp MP3 mono cho học viên nghe.
 */

export interface Pcm {
  sampleRate: number;
  /** Mẫu 16-bit có dấu, mono. */
  samples: Int16Array;
}

export class AudioError extends Error {
  constructor(
    public readonly code: "bad_wav" | "unsupported_wav" | "sample_rate_mismatch",
    message?: string,
  ) {
    super(message ?? code);
  }
}

/** Đọc một tệp WAV PCM 16-bit; kênh stereo được trộn xuống mono. */
export function parseWav(buf: Buffer): Pcm {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new AudioError("bad_wav", "không phải tệp WAV");
  }
  let pos = 12;
  let fmt: { channels: number; sampleRate: number; bits: number; format: number } | null = null;
  let data: Buffer | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const start = pos + 8;
    // Một số bộ đọc ghi 0xFFFFFFFF hoặc 0 cho `data` khi truyền phát: lấy hết phần còn lại.
    if (id === "data" && (size === 0xffffffff || size === 0 || start + size > buf.length)) size = buf.length - start;
    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(start),
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        bits: buf.readUInt16LE(start + 14),
      };
    } else if (id === "data") {
      data = buf.subarray(start, start + size);
      break;
    }
    pos = start + size + (size % 2);
  }
  if (!fmt || !data) throw new AudioError("bad_wav", "thiếu khối fmt hoặc data");
  if (fmt.format !== 1 || fmt.bits !== 16 || fmt.channels < 1 || fmt.channels > 2) {
    throw new AudioError("unsupported_wav", `format=${fmt.format} bits=${fmt.bits} channels=${fmt.channels}`);
  }
  const frames = Math.floor(data.length / (2 * fmt.channels));
  const samples = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    if (fmt.channels === 1) samples[i] = data.readInt16LE(i * 2);
    else samples[i] = Math.round((data.readInt16LE(i * 4) + data.readInt16LE(i * 4 + 2)) / 2);
  }
  return { sampleRate: fmt.sampleRate, samples };
}

/** Tạo WAV mono 16-bit từ mẫu PCM (dùng cho bộ đọc giả và kiểm thử). */
export function encodeWav({ sampleRate, samples }: Pcm): Buffer {
  const dataBytes = samples.length * 2;
  const out = Buffer.alloc(44 + dataBytes);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(36 + dataBytes, 4);
  out.write("WAVEfmt ", 8, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(samples[i]!, 44 + i * 2);
  return out;
}

export const durationOf = (pcm: Pcm): number => pcm.samples.length / pcm.sampleRate;

/**
 * Nối các đoạn PCM thành một dòng liên tục. Mọi đoạn phải cùng tần số lấy mẫu — lệch nghĩa là bộ đọc đổi cấu hình giữa
 * chừng, và nối thẳng sẽ ra giọng méo; thà báo lỗi để tạo lại.
 */
export class PcmTimeline {
  private parts: Int16Array[] = [];
  private length = 0;
  private rate: number | null = null;

  constructor(rate?: number) {
    this.rate = rate ?? null;
  }

  get sampleRate(): number {
    if (this.rate === null) throw new AudioError("bad_wav", "chưa có đoạn nào");
    return this.rate;
  }

  /** Thời điểm hiện tại (giây) — nơi đoạn kế tiếp sẽ bắt đầu. */
  get seconds(): number {
    return this.rate ? this.length / this.rate : 0;
  }

  addPcm(pcm: Pcm): void {
    if (this.rate === null) this.rate = pcm.sampleRate;
    else if (pcm.sampleRate !== this.rate) {
      throw new AudioError("sample_rate_mismatch", `${pcm.sampleRate} Hz khác ${this.rate} Hz`);
    }
    this.parts.push(pcm.samples);
    this.length += pcm.samples.length;
  }

  addSilence(sec: number): void {
    if (sec <= 0 || this.rate === null) return;
    const n = Math.round(sec * this.rate);
    this.parts.push(new Int16Array(n));
    this.length += n;
  }

  toPcm(): Pcm {
    const samples = new Int16Array(this.length);
    let at = 0;
    for (const p of this.parts) {
      samples.set(p, at);
      at += p.length;
    }
    return { sampleRate: this.sampleRate, samples };
  }
}

/**
 * MP3 mono 64 kbps — đủ rõ cho giọng nói, ~2,6 MB mỗi 5 phút. Bản KHÔNG đồng bộ nhường luồng xử lý sau mỗi nhóm khối:
 * mã hoá bài 25 phút mất cỡ 19 giây, nếu chạy liền thì bản web đang tạo giọng không trả lời được yêu cầu nào khác.
 */
export async function encodeMp3Async(pcm: Pcm, kbps = 64): Promise<Buffer> {
  return encodeMp3Core(pcm, kbps, () => new Promise<void>((resolve) => setImmediate(resolve)));
}

export function encodeMp3(pcm: Pcm, kbps = 64): Buffer {
  const out = encodeMp3Core(pcm, kbps, null);
  return out as Buffer;
}

function encodeMp3Core(
  { sampleRate, samples }: Pcm,
  kbps: number,
  yieldFn: (() => Promise<void>) | null,
): Buffer | Promise<Buffer> {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const out: Buffer[] = [];
  const block = 1152 * 16;
  const step = (i: number) => {
    const piece = encoder.encodeBuffer(samples.subarray(i, Math.min(i + block, samples.length)));
    if (piece.length) out.push(Buffer.from(piece));
  };
  const finish = () => {
    const tail = encoder.flush();
    if (tail.length) out.push(Buffer.from(tail));
    return Buffer.concat(out);
  };
  if (!yieldFn) {
    for (let i = 0; i < samples.length; i += block) step(i);
    return finish();
  }
  return (async () => {
    let sinceYield = 0;
    for (let i = 0; i < samples.length; i += block) {
      step(i);
      // ~12 khối/nhịp ≈ 0,3 giây âm thanh mỗi nhịp — mỗi lần chiếm luồng chỉ vài mili giây.
      if (++sinceYield >= 12) {
        sinceYield = 0;
        await yieldFn();
      }
    }
    return finish();
  })();
}
