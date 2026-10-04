import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import {
  resolveSectionTimeline,
  type SectionOverride,
  type SectionState,
  type SectionTimeline,
} from "./section-timeline";
import { markAttemptSubmitted } from "./submission";
import { assertSubjectOwnsAttempt, emitArgsForSubject, type ExamSubject } from "./subject";
import { ExamError } from "./types";

/**
 * LANG G5a — đề thi thử: giờ riêng từng phần, làm lần lượt, không quay lại.
 *
 * Mọi thứ ở đây chỉ chạy khi `Exam.mockMode`; đề thường không bao giờ đi qua
 * (G5a.12). "Phần đang chạy" luôn được suy ra từ giờ (xem section-timeline.ts),
 * bảng ExamAttemptSection chỉ nhớ nộp sớm và gia hạn.
 */

export const MOCK_SECTION_MIN = 1;
export const MOCK_SECTION_MAX = 240;

export interface SectionFlowSection {
  id: string;
  title: string;
  languageSkill: string | null;
  durationSec: number;
  questionCount: number;
  state: SectionState;
  startsAt: string;
  endsAt: string;
}

/** Phần "luồng thi theo phần" gắn vào runtime của lượt thi; null với đề thường. */
export interface SectionFlow {
  sections: SectionFlowSection[];
  activeSectionId: string | null;
  /** Chỉ id câu của phần đang chạy — máy chủ không gửi câu của phần khác. */
  activeQuestionIds: string[];
  remainingSec: number;
  finished: boolean;
  serverNow: string;
}

interface MockContext {
  attempt: {
    id: string;
    examId: string;
    userId: string | null;
    candidateId: string | null;
    status: string;
    startedAt: Date;
    durationSec: number;
    courseId: string | null;
  };
  sections: {
    id: string;
    title: string;
    languageSkill: string | null;
    durationSec: number;
    questionIds: string[];
  }[];
  overrides: Record<string, SectionOverride>;
}

/** null = đề thường (hoặc đề thi thử thiếu giờ phần — không khoá gì, tránh nhốt học viên). */
async function loadMockContext(attemptId: string, db: PrismaClient): Promise<MockContext | null> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      userId: true,
      candidateId: true,
      status: true,
      startedAt: true,
      durationSec: true,
      exam: {
        select: {
          mockMode: true,
          courseId: true,
          sections: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              title: true,
              durationMin: true,
              languageSkill: true,
              items: { orderBy: { orderInSection: "asc" }, select: { examQuestionId: true } },
            },
          },
        },
      },
      sectionStates: { select: { sectionId: true, endedAt: true, extraSec: true } },
    },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (!attempt.exam.mockMode) return null;
  if (attempt.exam.sections.length === 0 || attempt.exam.sections.some((s) => !s.durationMin)) return null;
  const overrides: Record<string, SectionOverride> = {};
  for (const o of attempt.sectionStates) overrides[o.sectionId] = { endedAt: o.endedAt, extraSec: o.extraSec };
  return {
    attempt: {
      id: attempt.id,
      examId: attempt.examId,
      userId: attempt.userId,
      candidateId: attempt.candidateId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      durationSec: attempt.durationSec,
      courseId: attempt.exam.courseId,
    },
    sections: attempt.exam.sections.map((s) => ({
      id: s.id,
      title: s.title,
      languageSkill: s.languageSkill,
      durationSec: s.durationMin! * 60,
      questionIds: s.items.map((i) => i.examQuestionId),
    })),
    overrides,
  };
}

function timelineOf(ctx: MockContext, now: Date): SectionTimeline {
  return resolveSectionTimeline({
    sections: ctx.sections.map((s) => ({ id: s.id, durationSec: s.durationSec })),
    overrides: ctx.overrides,
    startedAt: ctx.attempt.startedAt,
    durationSec: ctx.attempt.durationSec,
    now,
  });
}

/**
 * Phát exam.section.started/ended cho các phần đã chạy. Idempotent theo
 * eventKey; chỉ INSERT những key chưa có (một truy vấn) để gọi nhiều lần
 * không tốn kém. Giờ trong payload là giờ suy ra của máy chủ, không phải lúc
 * ghi event — nên phát muộn vẫn đúng.
 */
async function syncSectionEvents(
  ctx: MockContext,
  tl: SectionTimeline,
  subject: ExamSubject,
  db: PrismaClient,
): Promise<void> {
  const hardEnd = ctx.attempt.startedAt.getTime() + ctx.attempt.durationSec * 1000;
  const todo: { key: string; type: string; payload: Record<string, unknown> }[] = [];
  tl.sections.forEach((r, i) => {
    if (r.state === "upcoming") return;
    if (r.startsAt.getTime() >= hardEnd) return; // bị cắt bởi hạn cứng, chưa từng chạy
    const meta = ctx.sections[i]!;
    const base = {
      examId: ctx.attempt.examId,
      attemptId: ctx.attempt.id,
      sectionId: r.id,
      sectionIndex: i,
      languageSkill: meta.languageSkill,
      startedAt: r.startsAt.toISOString(),
    };
    todo.push({
      key: `exam.section.started:${ctx.attempt.id}:${r.id}`,
      type: LearningEventType.ExamSectionStarted,
      payload: base,
    });
    if (r.state === "done") {
      const o = ctx.overrides[r.id];
      const early = !!o?.endedAt && o.endedAt.getTime() === r.endsAt.getTime();
      todo.push({
        key: `exam.section.ended:${ctx.attempt.id}:${r.id}`,
        type: LearningEventType.ExamSectionEnded,
        payload: { ...base, endedAt: r.endsAt.toISOString(), reason: early ? "submitted_early" : "time_up" },
      });
    }
  });
  if (todo.length === 0) return;
  const have = await db.learningEvent.findMany({
    where: { eventKey: { in: todo.map((t) => t.key) } },
    select: { eventKey: true },
  });
  const haveKeys = new Set(have.map((h) => h.eventKey));
  const ev = emitArgsForSubject(subject);
  for (const t of todo) {
    if (haveKeys.has(t.key)) continue;
    await emitEvent(
      ev.userId,
      t.type as LearningEventType,
      t.payload,
      { courseId: ctx.attempt.courseId, candidateId: ev.candidateId, eventKey: t.key },
      db,
    );
  }
}

function toFlow(ctx: MockContext, tl: SectionTimeline, now: Date): SectionFlow {
  const active = tl.activeIndex === null ? null : ctx.sections[tl.activeIndex]!;
  return {
    sections: tl.sections.map((r, i) => ({
      id: r.id,
      title: ctx.sections[i]!.title,
      languageSkill: ctx.sections[i]!.languageSkill,
      durationSec: ctx.sections[i]!.durationSec,
      questionCount: ctx.sections[i]!.questionIds.length,
      state: r.state,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    })),
    activeSectionId: tl.activeSectionId,
    activeQuestionIds: active ? [...active.questionIds] : [],
    remainingSec: tl.remainingSec,
    finished: tl.finished,
    serverNow: now.toISOString(),
  };
}

/** Cho getAttemptRuntime / heartbeat: luồng theo phần của lượt thi, null nếu đề thường. */
export async function getSectionFlow(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
  opts: { emitEvents?: boolean } = {},
): Promise<SectionFlow | null> {
  const ctx = await loadMockContext(attemptId, db);
  if (!ctx) return null;
  assertSubjectOwnsAttempt(subject, ctx.attempt);
  const now = new Date();
  const tl = timelineOf(ctx, now);
  if (opts.emitEvents !== false) await syncSectionEvents(ctx, tl, subject, db);
  return toFlow(ctx, tl, now);
}

/**
 * G5a.7 — phần nhỏ gọn để heartbeat trả về (máy khách cũ bỏ qua trường lạ).
 * Không phát event (heartbeat không được ghi LearningEvent, xem route).
 */
export async function getSectionHeartbeat(
  subject: ExamSubject,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ activeSectionId: string | null; remainingSec: number; finished: boolean } | null> {
  const flow = await getSectionFlow(subject, attemptId, db, { emitEvents: false });
  if (!flow) return null;
  return { activeSectionId: flow.activeSectionId, remainingSec: flow.remainingSec, finished: flow.finished };
}

/**
 * Dùng trong saveAnswer: đề thi thử chỉ nhận đáp án của phần đang chạy.
 * Đề thường → no-op.
 */
export async function assertQuestionInActiveSection(
  attemptId: string,
  questionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const ctx = await loadMockContext(attemptId, db);
  if (!ctx) return;
  const tl = timelineOf(ctx, new Date());
  if (tl.finished) throw new ExamError("attempt_already_submitted");
  const active = ctx.sections[tl.activeIndex!]!;
  if (!active.questionIds.includes(questionId)) {
    throw new ExamError("section_not_active", { activeSectionId: active.id });
  }
}

/**
 * G5b — bài đọc/nghe có thuộc phần đang chạy không (đề thi thử). Đề thường → no-op.
 * Hết giờ mọi phần → attempt_already_submitted; bài ở phần khác → section_not_active.
 */
export async function assertPassageInActiveSection(
  attemptId: string,
  passageId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const ctx = await loadMockContext(attemptId, db);
  if (!ctx) return;
  const tl = timelineOf(ctx, new Date());
  if (tl.finished) throw new ExamError("attempt_already_submitted");
  const active = ctx.sections[tl.activeIndex!]!;
  const inActive = await db.examQuestion.count({
    where: { passageId, id: { in: active.questionIds } },
  });
  if (inActive === 0) throw new ExamError("section_not_active", { activeSectionId: active.id });
}

/**
 * "Nộp phần này": kết thúc sớm phần đang chạy và mở phần kế (không quay lại).
 * Phần cuối thì nộp cả bài. `expectSectionId` làm lệnh idempotent: nếu máy
 * khách gửi lại vì mất mạng mà phần đó đã qua, không nuốt luôn phần kế.
 */
export async function endCurrentSection(
  subject: ExamSubject,
  attemptId: string,
  opts: { expectSectionId?: string } = {},
  db: PrismaClient = prisma,
): Promise<{ finished: boolean; activeSectionId: string | null }> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, candidateId: true, status: true, exam: { select: { mockMode: true } } },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  if (!attempt.exam.mockMode) throw new ExamError("not_mock_exam");
  if (attempt.status !== "in_progress") return { finished: true, activeSectionId: null };

  const ctx = await loadMockContext(attemptId, db);
  if (!ctx) throw new ExamError("not_mock_exam");
  const now = new Date();
  let tl = timelineOf(ctx, now);

  const submit = async () => {
    await markAttemptSubmitted(attemptId, "manual", db);
  };

  if (tl.finished) {
    await syncSectionEvents(ctx, tl, subject, db);
    await submit();
    return { finished: true, activeSectionId: null };
  }
  if (opts.expectSectionId && opts.expectSectionId !== tl.activeSectionId) {
    return { finished: false, activeSectionId: tl.activeSectionId };
  }

  const sectionId = tl.activeSectionId!;
  await db.examAttemptSection.upsert({
    where: { attemptId_sectionId: { attemptId, sectionId } },
    create: { attemptId, sectionId, endedAt: now },
    update: { endedAt: now },
  });
  ctx.overrides[sectionId] = { endedAt: now, extraSec: ctx.overrides[sectionId]?.extraSec ?? 0 };
  tl = timelineOf(ctx, now);
  await syncSectionEvents(ctx, tl, subject, db);

  if (tl.finished) {
    await submit();
    return { finished: true, activeSectionId: null };
  }
  return { finished: false, activeSectionId: tl.activeSectionId };
}

/** Giảng viên gia hạn: cộng vào phần đang chạy (nếu đề thi thử). Trả về true nếu có áp dụng. */
export async function addExtensionToActiveSection(
  attemptId: string,
  extraSec: number,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const ctx = await loadMockContext(attemptId, db);
  if (!ctx) return false;
  const tl = timelineOf(ctx, new Date());
  if (tl.finished) return false;
  const sectionId = tl.activeSectionId!;
  await db.examAttemptSection.upsert({
    where: { attemptId_sectionId: { attemptId, sectionId } },
    create: { attemptId, sectionId, extraSec },
    update: { extraSec: { increment: extraSec } },
  });
  return true;
}

/** Tổng giây các phần của đề thi thử (null nếu đề thường hoặc chưa đủ giờ). */
export async function mockExamTotalSec(examId: string, db: PrismaClient = prisma): Promise<number | null> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { mockMode: true, sections: { select: { durationMin: true } } },
  });
  if (!exam?.mockMode) return null;
  if (exam.sections.length === 0 || exam.sections.some((s) => !s.durationMin)) return null;
  return exam.sections.reduce((a, s) => a + s.durationMin! * 60, 0);
}

/** Kiểm tra trước khi xuất bản. Đề thường → không lỗi, totalMinutes = null. */
export async function validateMockExamForPublish(
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ errors: string[]; totalMinutes: number | null }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      mockMode: true,
      sections: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          title: true,
          durationMin: true,
          selectionMode: true,
          items: { select: { examQuestionId: true } },
        },
      },
      questions: { select: { id: true, passageId: true } },
    },
  });
  if (!exam?.mockMode) return { errors: [], totalMinutes: null };

  const errors: string[] = [];
  if (exam.sections.length === 0) {
    errors.push("Đề thi thử cần ít nhất một phần.");
  }
  let total = 0;
  const sectionOf = new Map<string, string>();
  for (const s of exam.sections) {
    const d = s.durationMin;
    if (d === null || d < MOCK_SECTION_MIN || d > MOCK_SECTION_MAX) {
      errors.push(`Phần "${s.title}" chưa có giờ làm bài hợp lệ (${MOCK_SECTION_MIN}–${MOCK_SECTION_MAX} phút).`);
    } else {
      total += d;
    }
    // Phần ngẫu nhiên chưa chốt đã bị báo ở luật chung; ở đây chỉ bắt phần cố định rỗng.
    if (s.selectionMode === "fixed" && s.items.length === 0) {
      errors.push(`Phần "${s.title}" chưa có câu hỏi nào.`);
    }
    for (const i of s.items) sectionOf.set(i.examQuestionId, s.id);
  }
  const orphan = exam.questions.filter((q) => !sectionOf.has(q.id));
  if (orphan.length > 0) {
    errors.push(`Có ${orphan.length} câu hỏi chưa thuộc phần nào — đề thi thử phải xếp mọi câu vào một phần.`);
  }
  // Một bài đọc/nghe không được chia đôi qua hai phần (thí sinh sẽ mất ngữ cảnh khi phần đóng).
  const byPassage = new Map<string, Set<string>>();
  for (const q of exam.questions) {
    if (!q.passageId) continue;
    const sec = sectionOf.get(q.id);
    if (!sec) continue;
    byPassage.set(q.passageId, (byPassage.get(q.passageId) ?? new Set()).add(sec));
  }
  const split = [...byPassage.values()].filter((set) => set.size > 1).length;
  if (split > 0) errors.push(`Có ${split} bài đọc/nghe có câu hỏi nằm ở nhiều phần khác nhau.`);

  return { errors, totalMinutes: errors.length === 0 ? total : null };
}
