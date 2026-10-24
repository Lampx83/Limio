/**
 * CENTER C4b — soạn nhận xét cá nhân sau buổi học (docs/CENTER-schedule-attendance-AC.md, C4.7–C4.15).
 *
 * Nguyên tắc:
 *  - Chỉ dùng dữ liệu của CHÍNH học viên đó trong buổi: điểm danh, mức thành thạo theo bài của buổi (nhãn, không
 *    bao giờ số), kết quả bài tập liên quan. Không nhắc tên hay kết quả người khác, không xếp hạng (C4.7).
 *  - Chỗ nào không có dữ liệu thì bỏ trống, không suy đoán (C4.8).
 *  - Ghi chú nhanh của giáo viên được giữ nguyên chữ (C4.9).
 *  - AI lỗi hoặc hết hạn mức → mẫu có sẵn từ cùng dữ liệu; luồng không bị chặn (C4.13). Token trừ ví giáo viên.
 *  - Học viên vắng không dùng AI (C4.12); họ nhận email chung.
 *  - Bản nháp chỉ là NHÁP: việc duyệt và gửi ở core-lms (`MeetingStudentNote`); module này không gửi gì.
 *  - Mỗi bản đã gửi ghi một `FeedbackDelivery` mang toạ độ SSMMD (C4.15), xem `recordMeetingNoteDelivery`.
 */
import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType, masteryLabel, lessonSkillCode, type MasteryLabel } from "@feedbackme/shared-types";
import { CODER_VERSION, codeMeetingNote } from "./coding";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor/aiTutor";
import { assertHasTokenBudget } from "./aiTutor/tokenWallet";
import { callJsonModel } from "./aiTutor/generators";
import { AiTutorError } from "./aiTutor/errors";

export class MeetingNoteDraftError extends Error {
  constructor(
    public readonly code: "meeting_not_found" | "not_closed" | "not_in_roster" | "absent_student" | "attendance_required" | "already_sent",
  ) {
    super(code);
  }
}

const COUNTED_ENROLLMENT = ["active", "completed"] as const;
const MAX_BODY = 1500;

export interface NoteLesson {
  id: string;
  title: string;
  label: MasteryLabel;
}

export interface NoteHomework {
  assignmentId: string;
  title: string;
  dueAt: string | null;
  state: "not_submitted" | "submitted" | "graded";
  score: number | null;
  maxScore: number;
}

export interface MeetingNoteFacts {
  version: 1;
  meetingId: string;
  seq: number | null;
  planTitle: string | null;
  attendance: "present" | "late" | "absent" | "excused" | null;
  learnerName: string;
  lessons: NoteLesson[];
  homework: NoteHomework[];
  /** Mastery thô theo mã skill, chỉ để ghi `generationContext` phục vụ phân tích; KHÔNG đi vào lời nhắc hay giao diện. */
  masteryAtGeneration?: Record<string, number>;
}

// ── Thu thập dữ kiện (C4.7) ──────────────────────────────────────────────

export async function gatherMeetingNoteFacts(
  meetingId: string,
  userId: string,
  db: PrismaClient = prisma,
): Promise<MeetingNoteFacts> {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, courseId: true } } },
  });
  if (!meeting) throw new MeetingNoteDraftError("meeting_not_found");

  const [user, attendance, mod] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } }),
    db.studentAttendance.findUnique({ where: { meetingId_userId: { meetingId, userId } }, select: { status: true } }),
    meeting.seq != null
      ? db.module.findFirst({
          where: { courseId: meeting.section.courseId, sessionNo: meeting.seq, isHidden: false },
          select: {
            title: true,
            lessons: { where: { isHidden: false }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
          },
        })
      : Promise.resolve(null),
  ]);
  const lessonRows = mod?.lessons ?? [];
  const lessonIds = lessonRows.map((l) => l.id);
  const codes = lessonIds.map(lessonSkillCode);

  const [skills, assignments] = await Promise.all([
    codes.length
      ? db.skill.findMany({
          where: { code: { in: codes } },
          select: { id: true, code: true, learnerStates: { where: { userId }, select: { masteryProbability: true, attempts: true } } },
        })
      : Promise.resolve([]),
    lessonIds.length
      ? db.assignment.findMany({
          where: { lessonId: { in: lessonIds }, isHidden: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            title: true,
            dueAt: true,
            maxScore: true,
            sectionDues: { where: { sectionId: meeting.sectionId }, select: { dueAt: true } },
            submissions: { where: { userId }, orderBy: { submittedAt: "desc" }, take: 1, select: { status: true, score: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const masterySnapshot: Record<string, number> = {};
  const byCode = new Map(skills.map((s) => [s.code, s]));
  const lessons: NoteLesson[] = lessonRows.map((l) => {
    const st = byCode.get(lessonSkillCode(l.id))?.learnerStates[0];
    const hasData = st != null && st.attempts > 0;
    if (hasData) masterySnapshot[lessonSkillCode(l.id)] = st.masteryProbability;
    return { id: l.id, title: l.title, label: hasData ? masteryLabel(st.masteryProbability) : "no_data" };
  });

  const homework: NoteHomework[] = assignments.map((a) => {
    const sub = a.submissions[0];
    const due = a.sectionDues.length ? a.sectionDues[0]!.dueAt : a.dueAt;
    return {
      assignmentId: a.id,
      title: a.title,
      dueAt: due ? due.toISOString() : null,
      state: !sub ? "not_submitted" : sub.status === "graded" ? "graded" : "submitted",
      score: sub?.status === "graded" ? (sub.score ?? null) : null,
      maxScore: a.maxScore,
    };
  });

  return {
    version: 1,
    meetingId,
    seq: meeting.seq,
    planTitle: mod?.title ?? null,
    attendance: attendance?.status ?? null,
    learnerName: user.displayName,
    lessons,
    homework,
    masteryAtGeneration: masterySnapshot,
  };
}

// ── Bản nháp theo mẫu (C4.8, C4.13, C4.14) ───────────────────────────────

export interface RuleNote {
  body: string;
  usedMastery: boolean;
  usedHomework: boolean;
  /** Bài cần ôn lại hoặc nên luyện thêm — làm "bước tiếp theo" của nhận xét. */
  remediationLessonIds: string[];
}

function vnDayMonth(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const HINT_LABEL = "Thầy/cô nhắn thêm:";

export function composeRuleNote(facts: MeetingNoteFacts, hint?: string | null): RuleNote {
  const bullets: string[] = [];
  const titles = (label: MasteryLabel) => facts.lessons.filter((l) => l.label === label).map((l) => l.title);

  if (facts.attendance === "late") {
    const first = facts.lessons[0]?.title;
    bullets.push(first ? `Em đến muộn nên chưa kịp phần đầu buổi; em xem lại bài "${first}".` : "Em đến muộn buổi này.");
  }
  const solid = titles("solid");
  const practice = titles("practice_more");
  const review = titles("needs_review");
  if (solid.length) bullets.push(`Em nắm chắc: ${solid.join("; ")}.`);
  if (practice.length) bullets.push(`Em nên luyện thêm: ${practice.join("; ")}.`);
  if (review.length) bullets.push(`Em cần ôn lại: ${review.join("; ")}.`);

  for (const h of facts.homework) {
    if (h.state === "graded" && h.score != null) bullets.push(`Bài tập "${h.title}": em được ${h.score}/${h.maxScore} điểm.`);
    else if (h.state === "submitted") bullets.push(`Em đã nộp bài tập "${h.title}", thầy/cô sẽ chấm sớm.`);
    else if (h.state === "not_submitted") bullets.push(`Em chưa nộp bài tập "${h.title}"${h.dueAt ? `, hạn nộp ${vnDayMonth(h.dueAt)}` : ""}.`);
  }

  const parts: string[] = [];
  if (bullets.length) {
    // "Buổi 1: Xin chào" → "Xin chào": số buổi đã nằm ở "Trong buổi 1", không lặp lại trong ngoặc.
    const topic = facts.planTitle?.replace(/^Buổi\s*\d+\s*[:.\-–—]\s*/i, "").trim();
    const head = `Trong ${facts.seq != null ? `buổi ${facts.seq}` : "buổi dạy bù"}${topic ? ` (${topic})` : ""}:`;
    parts.push([head, ...bullets.map((b) => `- ${b}`)].join("\n"));
  }
  const trimmed = hint?.trim();
  if (trimmed) parts.push(`${HINT_LABEL} ${trimmed}`);

  return {
    body: parts.join("\n\n"),
    usedMastery: facts.lessons.some((l) => l.label !== "no_data"),
    usedHomework: facts.homework.length > 0,
    remediationLessonIds: facts.lessons.filter((l) => l.label === "needs_review" || l.label === "practice_more").map((l) => l.id),
  };
}

// ── Bản nháp bằng AI (C4.9, C4.13) ───────────────────────────────────────

const LABEL_TEXT: Record<MasteryLabel, string> = {
  solid: "nắm chắc",
  practice_more: "nên luyện thêm",
  needs_review: "cần ôn lại",
  no_data: "chưa có dữ liệu — không nhận xét phần này",
};

const SYSTEM = `Bạn giúp giáo viên viết nhận xét ngắn gửi MỘT học viên sau buổi học.
Quy tắc cứng:
- Chỉ dùng những gì có trong "Dữ kiện". Không bịa, không suy đoán. Phần nào ghi chưa có dữ liệu thì bỏ qua.
- Không nhắc học viên khác, không so sánh, không xếp hạng.
- Không viết phần trăm hay con số mức thành thạo; chỉ dùng các nhãn đã cho. Điểm bài tập chỉ nêu khi dữ kiện có.
- Nói về nhiệm vụ và cách làm ("em làm đúng phần…, cần ôn lại…"), kèm bước tiếp theo nếu có bài cần ôn. Không khen chung chung.
- Xưng "em", giọng ấm áp, 3 đến 6 câu, tối đa 120 từ, tiếng Việt.
- Nếu có "Ghi chú của giáo viên", đưa vào đúng ý và nên giữ nguyên chữ.
Trả JSON {"body": "..."}.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["body"],
  properties: { body: { type: "string" } },
};

export function buildNotePrompt(facts: MeetingNoteFacts, hint?: string | null): { system: string; user: string } {
  const lines: string[] = [];
  lines.push(`Buổi ${facts.seq ?? "dạy bù"}${facts.planTitle ? `: ${facts.planTitle}` : ""}`);
  lines.push(`Điểm danh: ${facts.attendance === "late" ? "đến muộn" : "có mặt"}`);
  if (facts.lessons.length) {
    lines.push("Các bài của buổi và mức em đạt:");
    for (const l of facts.lessons) lines.push(`- ${l.title}: ${LABEL_TEXT[l.label]}`);
  }
  if (facts.homework.length) {
    lines.push("Bài tập:");
    for (const h of facts.homework) {
      const st =
        h.state === "graded" && h.score != null
          ? `đã chấm ${h.score}/${h.maxScore}`
          : h.state === "submitted"
            ? "đã nộp, chưa chấm"
            : `chưa nộp${h.dueAt ? `, hạn ${vnDayMonth(h.dueAt)}` : ""}`;
      lines.push(`- ${h.title}: ${st}`);
    }
  }
  const trimmed = hint?.trim();
  if (trimmed) lines.push(`Ghi chú của giáo viên: ${trimmed}`);
  return { system: SYSTEM, user: `Dữ kiện:\n${lines.join("\n")}` };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

async function draftWithModel(
  actorUserId: string,
  facts: MeetingNoteFacts,
  hint: string | null,
  openai: OpenAI,
  db: PrismaClient,
): Promise<string> {
  await assertHasTokenBudget(actorUserId, db);
  await assertWithinCaps(actorUserId, db, "generator");
  const { system, user } = buildNotePrompt(facts, hint);
  const { data, inputTokens, outputTokens } = await callJsonModel<{ body?: string }>(openai, DEFAULT_MODEL, system, user, "meeting_note", SCHEMA, 700);
  await recordAiUsage(actorUserId, DEFAULT_MODEL, inputTokens, outputTokens, db);
  let body = (data?.body ?? "").trim();
  if (!body || body.length > MAX_BODY || /%/.test(body)) throw new Error("bad_model_output");
  // Ghi chú của giáo viên phải còn nguyên chữ (C4.9); mô hình quên thì nối vào cuối.
  if (hint && !norm(body).includes(norm(hint))) body = `${body}\n\n${HINT_LABEL} ${hint.trim()}`;
  return body;
}

// ── Soạn bản nháp ────────────────────────────────────────────────────────

export interface DraftMeetingNoteInput {
  /** Giáo viên bấm; core-lms `authorizeMeetingNotes` đã kiểm quyền trước khi gọi. Token trừ ví người này. */
  actorUserId: string;
  meetingId: string;
  userId: string;
  hint?: string | null;
  /** Có thì thử AI; không có (hoặc lỗi, hết hạn mức) thì dùng mẫu. */
  openai?: OpenAI | null;
  /** Soạn lại đè bản đang mở (kể cả bản đã sửa tay hoặc đã duyệt). Mặc định giữ nguyên bản đang mở. */
  regenerate?: boolean;
}

export type FallbackReason = "no_ai" | "no_budget" | "ai_error";

export interface DraftMeetingNoteResult {
  noteId: string;
  body: string;
  source: "llm" | "rule_template" | "manual";
  usedAi: boolean;
  fallbackReason?: FallbackReason;
  /** true = trả lại bản đang mở, không soạn lại. */
  reused: boolean;
}

export async function draftMeetingNote(input: DraftMeetingNoteInput, db: PrismaClient = prisma): Promise<DraftMeetingNoteResult> {
  const meeting = await db.classMeeting.findUnique({ where: { id: input.meetingId }, select: { id: true, sectionId: true, closedAt: true } });
  if (!meeting) throw new MeetingNoteDraftError("meeting_not_found");
  if (!meeting.closedAt) throw new MeetingNoteDraftError("not_closed");

  const enrolled = await db.enrollment.findFirst({
    where: { sectionId: meeting.sectionId, userId: input.userId, status: { in: [...COUNTED_ENROLLMENT] } },
    select: { id: true },
  });
  if (!enrolled) throw new MeetingNoteDraftError("not_in_roster");
  const att = await db.studentAttendance.findUnique({ where: { meetingId_userId: { meetingId: input.meetingId, userId: input.userId } }, select: { status: true } });
  if (!att) throw new MeetingNoteDraftError("attendance_required");
  if (att.status === "absent" || att.status === "excused") throw new MeetingNoteDraftError("absent_student");

  const existing = await db.meetingStudentNote.findMany({ where: { meetingId: input.meetingId, userId: input.userId } });
  const open = existing.find((n) => n.status !== "sent");
  if (!open && existing.some((n) => n.status === "sent")) throw new MeetingNoteDraftError("already_sent");
  if (open && !input.regenerate) {
    return { noteId: open.id, body: open.body, source: open.source as DraftMeetingNoteResult["source"], usedAi: false, reused: true };
  }

  const facts = await gatherMeetingNoteFacts(input.meetingId, input.userId, db);
  const hint = (input.hint ?? open?.teacherHint ?? null)?.trim() || null;
  const rule = composeRuleNote(facts, hint);

  let body = rule.body;
  let source: "llm" | "rule_template" = "rule_template";
  let fallbackReason: FallbackReason | undefined = "no_ai";
  if (input.openai) {
    try {
      body = await draftWithModel(input.actorUserId, facts, hint, input.openai, db);
      source = "llm";
      fallbackReason = undefined;
    } catch (e) {
      fallbackReason = e instanceof AiTutorError ? "no_budget" : "ai_error";
    }
  }

  const { masteryAtGeneration, ...pure } = facts;
  const storedFacts = {
    version: 1,
    attendance: facts.attendance,
    usedMastery: rule.usedMastery,
    usedHomework: rule.usedHomework,
    remediationLessonIds: rule.remediationLessonIds,
    lessons: pure.lessons.map((l) => ({ id: l.id, label: l.label })),
    masteryAtGeneration: masteryAtGeneration ?? {},
  };
  const data = {
    body,
    teacherHint: hint,
    source,
    facts: storedFacts,
    status: "draft" as const,
    approvedAt: null,
    approvedById: null,
    sendError: null,
    draftedById: input.actorUserId,
    draftedAt: new Date(),
  };
  const row = open
    ? await db.meetingStudentNote.update({ where: { id: open.id }, data })
    : await db.meetingStudentNote.create({ data: { meetingId: input.meetingId, userId: input.userId, ...data } });

  const courseId = (await db.courseSection.findUnique({ where: { id: meeting.sectionId }, select: { courseId: true } }))?.courseId ?? null;
  await db.learningEvent.create({
    data: {
      userId: input.actorUserId,
      courseId,
      eventType: LearningEventType.MeetingNoteDrafted,
      // Chỉ id và độ dài — nhận xét thuộc dữ liệu nhạy cảm (C4.18).
      payload: { meetingId: input.meetingId, noteId: row.id, source, bodyLength: body.length },
    },
  });
  return { noteId: row.id, body, source, usedAi: source === "llm", fallbackReason, reused: false };
}

export interface DraftAllResult {
  drafted: number;
  kept: number;
  skipped: number;
  items: Array<{ userId: string; status: "drafted" | "kept" | "skipped"; noteId?: string; fallbackReason?: FallbackReason }>;
}

/** Soạn nháp cho mọi học viên có mặt/muộn chưa có bản mở; bỏ qua người vắng và người chưa điểm danh. */
export async function draftAllMeetingNotes(
  input: { actorUserId: string; meetingId: string; openai?: OpenAI | null; regenerate?: boolean },
  db: PrismaClient = prisma,
): Promise<DraftAllResult> {
  const meeting = await db.classMeeting.findUnique({ where: { id: input.meetingId }, select: { sectionId: true } });
  if (!meeting) throw new MeetingNoteDraftError("meeting_not_found");
  const [enrollments, attendance] = await Promise.all([
    db.enrollment.findMany({ where: { sectionId: meeting.sectionId, status: { in: [...COUNTED_ENROLLMENT] } }, select: { userId: true }, orderBy: { userId: "asc" } }),
    db.studentAttendance.findMany({ where: { meetingId: input.meetingId }, select: { userId: true, status: true } }),
  ]);
  const att = new Map(attendance.map((a) => [a.userId, a.status]));
  const out: DraftAllResult = { drafted: 0, kept: 0, skipped: 0, items: [] };
  const seen = new Set<string>();
  for (const { userId } of enrollments) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    const st = att.get(userId);
    if (st !== "present" && st !== "late") {
      out.skipped++;
      out.items.push({ userId, status: "skipped" });
      continue;
    }
    try {
      const r = await draftMeetingNote({ ...input, userId }, db);
      if (r.reused) {
        out.kept++;
        out.items.push({ userId, status: "kept", noteId: r.noteId });
      } else {
        out.drafted++;
        out.items.push({ userId, status: "drafted", noteId: r.noteId, fallbackReason: r.fallbackReason });
      }
    } catch (e) {
      if (!(e instanceof MeetingNoteDraftError)) throw e;
      // Đã gửi rồi (đính chính qua luồng riêng) hoặc không còn trong lớp: bỏ qua, không dừng cả lượt.
      out.skipped++;
      out.items.push({ userId, status: "skipped" });
    }
  }
  return out;
}

// ── Ghi FeedbackDelivery khi bản đã gửi (C4.15) ──────────────────────────

interface StoredFacts {
  usedMastery?: boolean;
  remediationLessonIds?: string[];
  masteryAtGeneration?: Record<string, number>;
  edited?: boolean;
}

/**
 * Tạo `FeedbackDelivery` mang toạ độ SSMMD cho một nhận xét ĐÃ GỬI. Idempotent: gọi lại trả cùng id. Bản chưa gửi → null.
 * `masteryAtGeneration` là ảnh chụp lúc SOẠN nháp (không đọc lại lúc gửi, vì BKT có thể đã đổi sau khi giáo viên duyệt).
 */
export async function recordMeetingNoteDelivery(noteId: string, db: PrismaClient = prisma): Promise<string | null> {
  const note = await db.meetingStudentNote.findUnique({
    where: { id: noteId },
    include: { meeting: { select: { sectionId: true } } },
  });
  if (!note || note.status !== "sent") return null;
  if (note.feedbackDeliveryId) return note.feedbackDeliveryId;

  const facts = (note.facts as StoredFacts | null) ?? {};
  const remediation = facts.remediationLessonIds ?? [];
  const coding = codeMeetingNote({ source: note.source, hasMasteryStatements: facts.usedMastery === true, remediationCount: remediation.length });
  const delivery = await db.feedbackDelivery.create({
    data: {
      userId: note.userId,
      body: note.body,
      remediationLessonIds: remediation,
      level: coding.level,
      levels: coding.levels,
      elaboration: coding.elaboration,
      sourceKind: coding.sourceKind,
      generationContext: {
        coderVersion: CODER_VERSION,
        kind: "meeting_note",
        templateScope: null,
        templateId: null,
        misconceptionCode: null,
        skillIds: [],
        remediationLessonIds: remediation,
        remediationExcludedCompleted: 0,
        meetingId: note.meetingId,
        noteId: note.id,
        sectionId: note.meeting.sectionId,
        source: note.source,
        edited: facts.edited === true,
        correction: note.correctionOfId != null,
        masteryAtGeneration: facts.masteryAtGeneration ?? {},
      },
    },
  });
  // Hai lượt cùng lúc: chỉ một lượt gắn được; lượt kia xoá bản của mình và trả bản đã gắn.
  const linked = await db.meetingStudentNote.updateMany({ where: { id: noteId, feedbackDeliveryId: null }, data: { feedbackDeliveryId: delivery.id } });
  if (linked.count === 0) {
    await db.feedbackDelivery.delete({ where: { id: delivery.id } });
    return (await db.meetingStudentNote.findUniqueOrThrow({ where: { id: noteId } })).feedbackDeliveryId;
  }
  return delivery.id;
}
