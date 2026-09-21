import { z } from "zod";
import { prisma, type PrismaClient, type OralExamTopic } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditExam } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ExamError } from "./types";

// A6.7 — Chủ đề (tình huống) giao cho từng sinh viên trong đề vấn đáp AI.
//
// Trước đây "mỗi sinh viên một chủ đề" phải nhờ AI tự ánh xạ (vd theo chữ số cuối
// mã sinh viên gõ trong hướng dẫn): dễ sai, không kiểm chứng được, và cả bảng chủ đề
// bị nhồi vào ô hướng dẫn giới hạn 5.000 ký tự. Giờ HỆ THỐNG giao chủ đề lúc sinh
// viên bắt đầu lượt thi (pickOralTopicForAttempt) và AI chỉ nhận đúng chủ đề của
// sinh viên đó (xem examinerChat.ts).

/** Trần số chủ đề mỗi đề — đủ cho một lớp lớn, và giữ trang quản lý gọn. */
export const MAX_ORAL_TOPICS = 30;

const TopicInput = z.object({
  // trim() TRƯỚC min(1): nếu để sau thì chuỗi toàn dấu cách qua được min(1) rồi bị cắt thành rỗng.
  title: z.string().trim().min(1).max(200),
  // Phần AI đọc: bối cảnh + dữ kiện gắn với chủ đề. Không lộ nguyên văn cho sinh viên.
  brief: z.string().trim().min(1).max(4_000),
  // Phần SINH VIÊN đọc được (thẻ "Tình huống của bạn" ghim trong phòng thi). Tuỳ chọn; chuỗi rỗng = không có.
  studentBrief: z
    .string()
    .trim()
    .max(2_000)
    .optional()
    .transform((v) => (v ? v : null)),
});

// Cùng bất biến với tài liệu: sửa chủ đề sau publish khiến sinh viên cùng ca gặp đề khác nhau
// tuỳ lúc, và mọi bài đã chấm gắn với chủ đề cũ sẽ mất nghĩa.
async function assertOralDraftAndEditable(examId: string, actorUserId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, status: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");
  if (exam.status !== "draft") throw new ExamError("exam_not_draft");
  await assertCanEditExam(actorUserId, exam, db);
  return exam;
}

export type OralTopicWithUsage = OralExamTopic & { assignedCount: number };

/** Chủ đề của đề, theo thứ tự, kèm số lượt thi đã được giao. Ném exam_not_oral nếu là thi viết. */
export async function listOralTopics(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<OralTopicWithUsage[]> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");
  await assertCanEditExam(actorUserId, exam, db);
  const rows = await db.oralExamTopic.findMany({
    where: { examId },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { attempts: true } } },
  });
  return rows.map(({ _count, ...t }) => ({ ...t, assignedCount: _count.attempts }));
}

export async function createOralTopic(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ topicId: string }> {
  await assertOralDraftAndEditable(examId, actorUserId, db);
  const parsed = TopicInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());

  const existing = await db.oralExamTopic.aggregate({
    where: { examId },
    _count: { _all: true },
    _max: { orderIndex: true },
  });
  if (existing._count._all >= MAX_ORAL_TOPICS) {
    throw new ExamError("validation_failed", `Tối đa ${MAX_ORAL_TOPICS} chủ đề mỗi đề`);
  }
  const topic = await db.oralExamTopic.create({
    data: {
      examId,
      title: parsed.data.title,
      brief: parsed.data.brief,
      studentBrief: parsed.data.studentBrief,
      orderIndex: (existing._max.orderIndex ?? -1) + 1,
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralTopicCreated,
    { examId, topicId: topic.id },
    { eventKey: `exam.oral_topic.created:${topic.id}` },
    db,
  );
  return { topicId: topic.id };
}

export async function updateOralTopic(
  actorUserId: string,
  topicId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const topic = await db.oralExamTopic.findUnique({ where: { id: topicId }, select: { examId: true } });
  if (!topic) throw new ExamError("topic_not_found");
  await assertOralDraftAndEditable(topic.examId, actorUserId, db);
  const parsed = TopicInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  await db.oralExamTopic.update({ where: { id: topicId }, data: parsed.data });
}

export async function deleteOralTopic(
  actorUserId: string,
  topicId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const topic = await db.oralExamTopic.findUnique({ where: { id: topicId }, select: { id: true, examId: true } });
  if (!topic) throw new ExamError("topic_not_found");
  await assertOralDraftAndEditable(topic.examId, actorUserId, db);
  await db.oralExamTopic.delete({ where: { id: topicId } });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamOralTopicDeleted,
    { examId: topic.examId, topicId: topic.id },
    { eventKey: `exam.oral_topic.deleted:${topic.id}` },
    db,
  );
}

/**
 * Chọn chủ đề cho một lượt thi: ít lượt được giao nhất trước (chia đều cả lớp), hòa thì
 * ngẫu nhiên. Hàm THUẦN để test được — `rand` truyền vào cho kết quả xác định.
 * Trả null khi không có ứng viên (đề không có chủ đề riêng).
 */
export function chooseBalancedTopic(
  candidates: ReadonlyArray<{ id: string; used: number }>,
  rand: () => number = Math.random,
): string | null {
  if (candidates.length === 0) return null;
  const min = Math.min(...candidates.map((c) => c.used));
  const least = candidates.filter((c) => c.used === min);
  return least[Math.min(least.length - 1, Math.floor(rand() * least.length))]!.id;
}

/**
 * Chủ đề cho lượt thi sắp tạo của `userId`. Chia đều theo số lượt đã được giao; khi sinh viên
 * thi lại (attemptPolicy=multi) thì tránh chủ đề họ đã gặp nếu còn chủ đề khác — thi lại một
 * đề y hệt lần trước không đo thêm được gì. null nếu đề không có chủ đề nào.
 */
export async function pickOralTopicForAttempt(
  examId: string,
  userId: string,
  db: PrismaClient = prisma,
): Promise<string | null> {
  const topics = await db.oralExamTopic.findMany({ where: { examId }, select: { id: true } });
  if (topics.length === 0) return null;

  const [usage, mine] = await Promise.all([
    db.examAttempt.groupBy({
      by: ["oralTopicId"],
      where: { examId, oralTopicId: { not: null } },
      _count: { _all: true },
    }),
    db.examAttempt.findMany({
      where: { examId, userId, oralTopicId: { not: null } },
      select: { oralTopicId: true },
    }),
  ]);
  const usedBy = new Map(usage.map((u) => [u.oralTopicId!, u._count._all]));
  const seen = new Set(mine.map((m) => m.oralTopicId!));
  const all = topics.map((t) => ({ id: t.id, used: usedBy.get(t.id) ?? 0 }));
  const fresh = all.filter((t) => !seen.has(t.id));
  return chooseBalancedTopic(fresh.length > 0 ? fresh : all);
}
