import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { isAdmin } from "../auth/roles";
import { isSessionOpen } from "./session-window";
import { ExamError } from "./types";

// Công tắc TẮT vấn đáp AI bản cũ (docs/tieu-chi/limio-van-dap.md, mục 2 và AC0.9–AC0.11).
//
// Tắt nghĩa là: không còn cách nào BẮT ĐẦU một cuộc hỏi–đáp AI mới ở bản cũ (tạo đề, sửa tài liệu/chủ đề,
// mở buổi, vào thi bằng mã hay từ trang khoá, thử vấn đáp). Mọi thứ ĐÃ CÓ vẫn dùng được: xem kết quả, chấm,
// xuất Excel/Word, giám sát. Lượt đang làm dở được làm nốt (cắt giữa chừng là làm hỏng bài của học viên).
//
// Giữ trong site setting thay vì cờ người dùng `ai_oral.access`: cờ đó chỉ khoá một phần trang giảng viên,
// không chặn học viên và không chặn tạo đề từ trang khoá — tắt nó để lại trạng thái dở dang.

export const LEGACY_ORAL_DISABLED_KEY = "oral.legacy_disabled";

export async function isLegacyOralDisabled(db: PrismaClient = prisma): Promise<boolean> {
  const row = await db.siteSetting.findUnique({ where: { key: LEGACY_ORAL_DISABLED_KEY } });
  return row?.value === "true";
}

/** Ném `legacy_oral_disabled` khi bản cũ đã tắt. Gọi ngay trước mọi bước tạo mới của vấn đáp cũ. */
export async function assertLegacyOralEnabled(db: PrismaClient = prisma): Promise<void> {
  if (await isLegacyOralDisabled(db)) throw new ExamError("legacy_oral_disabled");
}

export interface LegacyOralReadiness {
  disabled: boolean;
  /** Đề vấn đáp cũ: tổng, nháp, đã xuất bản. */
  exams: { total: number; draft: number; published: number };
  /** Buổi đang mở cho học viên vào (đóng buổi trước khi tắt). */
  openSessions: number;
  /** Lượt thi đang làm dở và còn thời gian — tắt xong vẫn được làm nốt. */
  inProgressAttempts: number;
  /** Lượt đã nộp mà giảng viên chưa chốt điểm — vẫn chấm được sau khi tắt. */
  awaitingGrading: number;
}

/** Số liệu để quyết định tắt có ảnh hưởng ai không. Chỉ đọc. */
export async function getLegacyOralReadiness(
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<LegacyOralReadiness> {
  const [disabled, byStatus, sessions, inProgress, submitted] = await Promise.all([
    isLegacyOralDisabled(db),
    db.exam.groupBy({ by: ["status"], where: { kind: "oral" }, _count: { _all: true } }),
    db.examSession.findMany({
      where: { exam: { kind: "oral" }, status: { not: "closed" } },
      select: { opensAt: true, closesAt: true, timingMode: true, status: true },
    }),
    db.examAttempt.findMany({
      where: { exam: { kind: "oral" }, status: "in_progress" },
      select: { startedAt: true, durationSec: true },
    }),
    db.examAttempt.findMany({
      where: { exam: { kind: "oral" }, status: { not: "in_progress" } },
      select: { oralEvaluation: { select: { status: true } } },
    }),
  ]);

  const draft = byStatus.find((r) => r.status === "draft")?._count._all ?? 0;
  const total = byStatus.reduce((sum, r) => sum + r._count._all, 0);
  return {
    disabled,
    exams: { total, draft, published: total - draft },
    openSessions: sessions.filter((s) => isSessionOpen(s, now)).length,
    inProgressAttempts: inProgress.filter((a) => a.startedAt.getTime() + a.durationSec * 1000 > now.getTime()).length,
    awaitingGrading: submitted.filter((a) => !a.oralEvaluation || a.oralEvaluation.status === "pending_review").length,
  };
}

/** Bật/tắt công tắc. Chỉ admin; ghi sự kiện để truy được ai tắt lúc nào. */
export async function setLegacyOralDisabled(
  actorUserId: string,
  disabled: boolean,
  db: PrismaClient = prisma,
): Promise<void> {
  if (!(await isAdmin(actorUserId))) throw new ExamError("forbidden");
  await db.siteSetting.upsert({
    where: { key: LEGACY_ORAL_DISABLED_KEY },
    create: { key: LEGACY_ORAL_DISABLED_KEY, value: disabled ? "true" : "false" },
    update: { value: disabled ? "true" : "false" },
  });
  await emitEvent(actorUserId, LearningEventType.ExamOralLegacySwitched, { disabled }, {}, db);
}
