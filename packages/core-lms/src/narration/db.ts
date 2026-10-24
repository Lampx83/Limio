import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import {
  LectureScript,
  PodcastScript,
  parseScript,
  scriptHash,
  type NarrationKind,
} from "./script";
import type { SegmentTimes } from "./generate";
import { resolveCourseOwner } from "../storage/ledger";

/**
 * Lưu và đọc `LessonNarration` (docs/tieu-chi/nghe-giang-podcast.md). Trạng thái hiển thị với quản trị được SUY RA từ các
 * cột: `generating` / `failed` đọc thẳng từ `status`, còn "đã có giọng" và "giọng đã cũ" so `generatedHash` với `scriptHash`.
 */

/** Một việc tạo giọng không có tín hiệu trong chừng này thời gian thì coi là đã chết (vd bản web bị khởi động lại). */
export const GENERATION_STALE_MS = 5 * 60_000;

export type NarrationState = "script" | "generating" | "ready" | "stale" | "failed";

interface NarrationRowLike {
  status: string;
  audioKey: string | null;
  scriptHash: string;
  generatedHash: string | null;
}

export function narrationState(row: NarrationRowLike): NarrationState {
  if (row.status === "generating") return "generating";
  const hasFreshAudio = !!row.audioKey && row.generatedHash === row.scriptHash;
  if (row.status === "failed") return hasFreshAudio ? "ready" : "failed";
  if (!row.audioKey) return "script";
  return hasFreshAudio ? "ready" : "stale";
}

/** Có nên cho học viên thấy nút nghe không: chỉ khi tệp khớp đúng kịch bản hiện tại. */
export const isLearnerVisible = (row: NarrationRowLike): boolean => !!row.audioKey && row.generatedHash === row.scriptHash;

/**
 * Lưu kịch bản của một bài (nhập khoá gọi hàm này). Cùng kịch bản thì không đụng gì, nên nhập lại khoá không làm mất giọng
 * đã tạo; kịch bản đổi thì ghi đè chữ và để `generatedHash` cũ → trạng thái "giọng đã cũ".
 */
export async function saveNarrationScript(
  lessonId: string,
  kind: NarrationKind,
  rawScript: unknown,
  db: PrismaClient = prisma,
): Promise<{ id: string; created: boolean; changed: boolean }> {
  const script = parseScript(kind, rawScript);
  const hash = scriptHash(script);
  const existing = await db.lessonNarration.findUnique({ where: { lessonId_kind: { lessonId, kind } } });
  if (!existing) {
    const row = await db.lessonNarration.create({
      data: { lessonId, kind, script: script as Prisma.InputJsonValue, scriptHash: hash },
    });
    return { id: row.id, created: true, changed: true };
  }
  if (existing.scriptHash === hash) return { id: existing.id, created: false, changed: false };
  await db.lessonNarration.update({
    where: { id: existing.id },
    data: { script: script as Prisma.InputJsonValue, scriptHash: hash },
  });
  return { id: existing.id, created: false, changed: true };
}

/**
 * Nhận việc tạo giọng. Trả về dòng đã chuyển sang `generating`, hoặc null nếu việc đang chạy do một lần bấm khác
 * (còn tín hiệu trong GENERATION_STALE_MS). Gộp kiểm tra và đặt trạng thái trong một lệnh nên hai lần bấm đồng thời
 * (kể cả từ hai bản web) chỉ một lần thắng.
 */
export async function claimNarrationForGeneration(id: string, db: PrismaClient = prisma) {
  const staleBefore = new Date(Date.now() - GENERATION_STALE_MS);
  const claimed = await db.lessonNarration.updateMany({
    where: { id, OR: [{ status: { not: "generating" } }, { updatedAt: { lt: staleBefore } }] },
    data: { status: "generating", progress: 0, error: null },
  });
  if (claimed.count !== 1) return null;
  return db.lessonNarration.findUniqueOrThrow({ where: { id } });
}

export async function setNarrationProgress(id: string, progress: number, db: PrismaClient = prisma): Promise<void> {
  // updatedAt tự cập nhật theo @updatedAt → cũng là tín hiệu còn sống cho claimNarrationForGeneration.
  await db.lessonNarration.updateMany({ where: { id, status: "generating" }, data: { progress } });
}

export async function finishNarration(
  id: string,
  result: {
    audioKey: string;
    contentType: string;
    sizeBytes: number;
    durationSec: number;
    segments: SegmentTimes;
    voices: Record<string, string>;
    generatedHash: string;
  },
  db: PrismaClient = prisma,
): Promise<{ previousAudioKey: string | null }> {
  const before = await db.lessonNarration.findUniqueOrThrow({ where: { id }, select: { audioKey: true } });
  await db.lessonNarration.update({
    where: { id },
    data: {
      status: "ready",
      progress: 100,
      error: null,
      audioKey: result.audioKey,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
      durationSec: result.durationSec,
      segments: result.segments as unknown as Prisma.InputJsonValue,
      voices: result.voices as Prisma.InputJsonValue,
      generatedHash: result.generatedHash,
      generatedAt: new Date(),
    },
  });
  return { previousAudioKey: before.audioKey && before.audioKey !== result.audioKey ? before.audioKey : null };
}

/**
 * Gắn tệp giọng đọc vào đúng khoá và chủ khoá ngay khi tạo xong. Tệp do hệ thống tạo nên không có "người upload"; nếu để cho
 * bộ gom theo lô (`attributeStoredFiles`) thì dung lượng nằm vô chủ cho tới lần chạy sau.
 */
export async function attributeNarrationFile(
  lessonId: string,
  layer: string,
  key: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  if (!lesson) return;
  const courseId = lesson.module.courseId;
  const owner = await resolveCourseOwner(courseId, db);
  await db.storedFile.updateMany({
    where: { layer, key },
    data: { courseId, billedUserId: owner, attribution: "reference:lesson_narration", attributedAt: new Date() },
  });
}

export async function failNarration(id: string, message: string, db: PrismaClient = prisma): Promise<void> {
  await db.lessonNarration.updateMany({
    where: { id, status: "generating" },
    data: { status: "failed", error: message.slice(0, 1000) },
  });
}

// ── Học viên ─────────────────────────────────────────────────────────────────

export interface LectureForLearner {
  kind: "lecture";
  /** Đổi mỗi lần tạo giọng lại: khoá vị trí nghe dở và địa chỉ tệp. */
  version: number;
  durationSec: number;
  segments: Array<{ anchor: string; startSec: number; endSec: number }>;
}

export interface PodcastForLearner {
  kind: "podcast";
  version: number;
  durationSec: number;
  title: string;
  hosts: { A: string; B: string };
  turns: Array<{ index: number; speaker: "A" | "B"; speakerName: string; text: string; startSec: number; endSec: number }>;
}

export type NarrationForLearner = LectureForLearner | PodcastForLearner;

/** Các bản nghe của bài mà học viên được thấy. Không bao giờ trả khoá tệp. */
export async function getLearnerNarrations(
  lessonId: string,
  db: PrismaClient = prisma,
): Promise<{ lecture: LectureForLearner | null; podcast: PodcastForLearner | null }> {
  const rows = await db.lessonNarration.findMany({ where: { lessonId } });
  let lecture: LectureForLearner | null = null;
  let podcast: PodcastForLearner | null = null;
  for (const row of rows) {
    if (!isLearnerVisible(row) || row.durationSec == null || !row.segments) continue;
    const version = row.generatedAt ? row.generatedAt.getTime() : 0;
    if (row.kind === "lecture") {
      lecture = {
        kind: "lecture",
        version,
        durationSec: row.durationSec,
        segments: row.segments as unknown as LectureForLearner["segments"],
      };
    } else if (row.kind === "podcast") {
      const script = PodcastScript.safeParse(row.script);
      if (!script.success) continue;
      const times = row.segments as unknown as Array<{ index: number; startSec: number; endSec: number }>;
      podcast = {
        kind: "podcast",
        version,
        durationSec: row.durationSec,
        title: script.data.title,
        hosts: script.data.hosts,
        turns: script.data.turns.flatMap((t, index) => {
          const time = times.find((x) => x.index === index);
          return time
            ? [{ index, speaker: t.speaker, speakerName: script.data.hosts[t.speaker], text: t.text, startSec: time.startSec, endSec: time.endSec }]
            : [];
        }),
      };
    }
  }
  return { lecture, podcast };
}

/** Khoá tệp để tuyến phát đọc; chỉ trả khi tệp khớp kịch bản hiện tại. */
export async function getPlayableNarrationFile(
  lessonId: string,
  kind: NarrationKind,
  db: PrismaClient = prisma,
): Promise<{ audioKey: string; contentType: string; sizeBytes: number | null } | null> {
  const row = await db.lessonNarration.findUnique({ where: { lessonId_kind: { lessonId, kind } } });
  if (!row || !isLearnerVisible(row) || !row.audioKey) return null;
  return { audioKey: row.audioKey, contentType: row.contentType ?? "audio/mpeg", sizeBytes: row.sizeBytes };
}

// ── Quản trị ─────────────────────────────────────────────────────────────────

export interface CourseNarrationRow {
  id: string;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  kind: NarrationKind;
  state: NarrationState;
  progress: number;
  error: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  generatedAt: Date | null;
  voices: Record<string, string> | null;
  /** Số ký tự của kịch bản — để ước lượng thời gian tạo. */
  chars: number;
}

export async function listCourseNarrations(courseId: string, db: PrismaClient = prisma): Promise<CourseNarrationRow[]> {
  const rows = await db.lessonNarration.findMany({
    where: { lesson: { module: { courseId } } },
    include: { lesson: { select: { title: true, orderIndex: true, module: { select: { title: true, orderIndex: true } } } } },
  });
  rows.sort(
    (a, b) =>
      a.lesson.module.orderIndex - b.lesson.module.orderIndex ||
      a.lesson.orderIndex - b.lesson.orderIndex ||
      a.kind.localeCompare(b.kind),
  );
  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lessonId,
    lessonTitle: r.lesson.title,
    moduleTitle: r.lesson.module.title,
    kind: r.kind as NarrationKind,
    state: narrationState(r),
    progress: r.progress,
    error: r.error,
    durationSec: r.durationSec,
    sizeBytes: r.sizeBytes,
    generatedAt: r.generatedAt,
    voices: (r.voices as Record<string, string> | null) ?? null,
    chars: JSON.stringify(r.script).length,
  }));
}

export { LectureScript, PodcastScript };
