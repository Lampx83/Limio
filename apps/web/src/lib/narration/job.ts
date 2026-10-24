import { randomBytes } from "node:crypto";
import { prisma } from "@feedbackme/db";
import {
  NarrationGenerationError,
  attributeNarrationFile,
  claimNarrationForGeneration,
  failNarration,
  finishNarration,
  generateNarrationAudio,
  parseScript,
  setNarrationProgress,
  type NarrationKind,
  type VoiceRole,
} from "@feedbackme/core-lms";
import { storageFor } from "@/lib/storage";
import { lessonNarrationKey, narrationChunkKey } from "@/lib/storage-keys";
import { getSynthesizer, NarrationTtsNotConfiguredError } from "./tts";

/**
 * Việc tạo giọng chạy NỀN trong chính tiến trình web (đã chốt 24/10/2026: không đổi hạ tầng triển khai). Trạng thái, tiến độ
 * và lỗi nằm trong `LessonNarration`, nên bản web nào cũng đọc được; việc dở do bản web bị khởi động lại thì sau
 * GENERATION_STALE_MS có thể nhận lại, và bộ nhớ đệm từng đoạn giúp làm lại chỉ đọc phần còn thiếu.
 */

export type NarrationVoices = Partial<Record<VoiceRole, string>>;

/** Vai giọng cần có cho từng loại — để route báo thiếu ngay thay vì tạo xong nửa chừng mới lỗi. */
export function requiredRoles(kind: NarrationKind): VoiceRole[] {
  return kind === "lecture" ? ["lecturer"] : ["A", "B"];
}

export function missingVoice(kind: NarrationKind, voices: NarrationVoices): VoiceRole | null {
  return requiredRoles(kind).find((r) => !voices[r]?.trim()) ?? null;
}

function failureMessage(e: unknown): string {
  if (e instanceof NarrationGenerationError || e instanceof NarrationTtsNotConfiguredError) return e.message;
  if (e instanceof Error && e.message) return `Lỗi khi tạo giọng: ${e.message}`;
  return "Lỗi không xác định khi tạo giọng.";
}

/** Chạy một việc đã được nhận (`claimNarrationForGeneration`). Không bao giờ ném lỗi: mọi lỗi ghi vào dòng của bài. */
export async function runNarrationJob(id: string, voices: NarrationVoices): Promise<void> {
  const row = await prisma.lessonNarration.findUnique({ where: { id } });
  if (!row) return;
  const kind = row.kind as NarrationKind;
  const touchedChunks = new Set<string>();

  try {
    const synth = await getSynthesizer();
    const script = parseScript(kind, row.script);

    const result = await generateNarrationAudio(kind, script, voices, {
      synthesize: synth.synthesize,
      cache: {
        get: async (hash) => {
          const key = narrationChunkKey(id, hash);
          touchedChunks.add(key.key);
          const store = storageFor(key);
          return (await store.exists(key.key)) ? store.get(key.key) : null;
        },
        put: async (hash, wav) => {
          const key = narrationChunkKey(id, hash);
          touchedChunks.add(key.key);
          await storageFor(key).put(key.key, wav, "audio/wav");
        },
      },
      onProgress: (pct) => setNarrationProgress(id, pct),
      // Việc không còn ở trạng thái "đang tạo" (đã bị nhận lại hoặc xoá) thì dừng, không ghi đè.
      shouldAbort: async () => (await prisma.lessonNarration.findUnique({ where: { id }, select: { status: true } }))?.status !== "generating",
    });

    const filename = `${kind}-${Date.now()}-${randomBytes(8).toString("hex")}.mp3`;
    const audioKey = lessonNarrationKey(row.lessonId, filename);
    await storageFor(audioKey).put(audioKey.key, result.mp3, "audio/mpeg");

    const { previousAudioKey } = await finishNarration(id, {
      audioKey: audioKey.key,
      contentType: "audio/mpeg",
      sizeBytes: result.mp3.length,
      durationSec: result.durationSec,
      segments: result.segments,
      voices: Object.fromEntries(Object.entries(voices).filter(([, v]) => !!v)) as Record<string, string>,
      generatedHash: row.scriptHash,
    });
    await attributeNarrationFile(row.lessonId, audioKey.layer, audioKey.key);

    // Dọn: tệp cũ của lần tạo trước và các đoạn WAV tạm. Lỗi dọn không làm hỏng kết quả.
    if (previousAudioKey) {
      await storageFor({ layer: "private", key: previousAudioKey }).delete(previousAudioKey).catch(() => {});
    }
    for (const key of touchedChunks) {
      await storageFor({ layer: "tmp", key }).delete(key).catch(() => {});
    }
  } catch (e) {
    if (e instanceof NarrationGenerationError && e.code === "aborted") return;
    console.error("[narration] tạo giọng lỗi", id, e);
    await failNarration(id, failureMessage(e));
  }
}

/**
 * Bắt đầu tạo giọng cho nhiều dòng. Trả ngay; việc chạy nền LẦN LƯỢT từng dòng (không dồn dập vào NEU). Mỗi dòng chỉ được
 * nhận ngay trước khi tới lượt — nếu nhận hết từ đầu thì dòng xếp hàng lâu sẽ bị coi là đã chết (không có tiến độ).
 */
export function startNarrationJobs(ids: string[], voices: NarrationVoices): void {
  void (async () => {
    for (const id of ids) {
      const claimed = await claimNarrationForGeneration(id);
      if (!claimed) continue; // đang chạy do lần bấm khác
      await runNarrationJob(id, voices);
    }
  })().catch((e) => console.error("[narration] hàng đợi tạo giọng lỗi", e));
}
