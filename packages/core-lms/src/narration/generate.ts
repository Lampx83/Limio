import { createHash } from "node:crypto";
import { encodeMp3Async, parseWav, PcmTimeline } from "./audio";
import {
  countChunks,
  planNarration,
  type LectureScript,
  type NarrationKind,
  type PlannedUnit,
  type PodcastScript,
  type VoiceRole,
} from "./script";

/**
 * Tạo tệp âm thanh cho một lời giảng / podcast: đọc từng đoạn chữ qua bộ đọc, ghép lại kèm khoảng lặng, ghi mốc thời gian
 * từng mục (hay từng lượt), mã hoá một tệp MP3.
 *
 * Bộ đọc và bộ nhớ đệm đi vào qua `deps` nên toàn bộ luồng kiểm thử được bằng bộ đọc giả, không cần khoá NEU. Bộ nhớ đệm
 * giữ WAV của từng đoạn theo (giọng, chữ): tạo lại sau khi lỗi giữa chừng chỉ gọi bộ đọc cho phần còn thiếu.
 */

export interface LectureSegmentTime {
  anchor: string;
  startSec: number;
  endSec: number;
}
export interface PodcastTurnTime {
  index: number;
  startSec: number;
  endSec: number;
}
export type SegmentTimes = LectureSegmentTime[] | PodcastTurnTime[];

export interface GenerateDeps {
  /** Đọc một đoạn chữ (≤ TTS_MAX_CHARS) bằng giọng `voice`; trả tệp WAV. */
  synthesize(text: string, voice: string): Promise<Buffer>;
  cache?: {
    get(key: string): Promise<Buffer | null>;
    put(key: string, wav: Buffer): Promise<void>;
  };
  /** Gọi sau mỗi đoạn với phần trăm 0–95 (5% cuối dành cho mã hoá). */
  onProgress?(pct: number): Promise<void> | void;
  /** Trả true để dừng giữa chừng (vd việc bị thay bằng lần tạo mới). */
  shouldAbort?(): Promise<boolean> | boolean;
  sleep?(ms: number): Promise<void>;
}

export interface GenerateResult {
  mp3: Buffer;
  durationSec: number;
  segments: SegmentTimes;
  chunks: number;
  /** Số đoạn lấy từ bộ nhớ đệm thay vì gọi bộ đọc. */
  reused: number;
}

export class NarrationGenerationError extends Error {
  constructor(
    public readonly code: "tts_failed" | "aborted" | "no_text",
    public readonly unitId?: string,
    public readonly chunkIndex?: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
const round2 = (n: number) => Math.round(n * 100) / 100;

export const chunkCacheKey = (voice: string, text: string): string =>
  createHash("sha256").update(`${voice}\n${text}`).digest("hex").slice(0, 32);

export async function generateNarrationAudio(
  kind: NarrationKind,
  script: LectureScript | PodcastScript,
  voices: Partial<Record<VoiceRole, string>>,
  deps: GenerateDeps,
): Promise<GenerateResult> {
  const units = planNarration(kind, script);
  const total = countChunks(units);
  if (total === 0) throw new NarrationGenerationError("no_text");

  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeline = new PcmTimeline();
  const times: Array<{ unit: PlannedUnit; startSec: number; endSec: number }> = [];
  let done = 0;
  let reused = 0;

  for (const unit of units) {
    const voice = voices[unit.role];
    if (!voice) throw new NarrationGenerationError("tts_failed", unit.id, undefined, `thiếu giọng cho vai ${unit.role}`);
    const startSec = timeline.seconds;

    for (const [ci, text] of unit.chunks.entries()) {
      if (await deps.shouldAbort?.()) throw new NarrationGenerationError("aborted", unit.id, ci);
      const key = chunkCacheKey(voice, text);
      let wav = (await deps.cache?.get(key)) ?? null;
      if (wav) {
        reused++;
      } else {
        wav = await synthesizeWithRetry(deps, text, voice, unit.id, ci, sleep);
        await deps.cache?.put(key, wav);
      }
      timeline.addPcm(parseWav(wav));
      done++;
      await deps.onProgress?.(Math.min(95, Math.floor((done / total) * 95)));
    }

    times.push({ unit, startSec: round2(startSec), endSec: round2(timeline.seconds) });
    timeline.addSilence(unit.pauseAfterSec);
  }

  const pcm = timeline.toPcm();
  const segments: SegmentTimes =
    kind === "lecture"
      ? times.map((t) => ({ anchor: t.unit.id, startSec: t.startSec, endSec: t.endSec }))
      : times.map((t) => ({ index: Number(t.unit.id), startSec: t.startSec, endSec: t.endSec }));

  return {
    mp3: await encodeMp3Async(pcm),
    durationSec: round2(pcm.samples.length / pcm.sampleRate),
    segments,
    chunks: total,
    reused,
  };
}

async function synthesizeWithRetry(
  deps: GenerateDeps,
  text: string,
  voice: string,
  unitId: string,
  chunkIndex: number,
  sleep: (ms: number) => Promise<void>,
): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await deps.synthesize(text, voice);
    } catch (e) {
      lastError = e;
      const wait = RETRY_DELAYS_MS[attempt];
      if (wait !== undefined) await sleep(wait);
    }
  }
  throw new NarrationGenerationError(
    "tts_failed",
    unitId,
    chunkIndex,
    `bộ đọc lỗi ở đoạn ${unitId} (phần ${chunkIndex + 1}): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
