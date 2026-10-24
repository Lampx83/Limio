/**
 * CENTER C4b — nhận xét cá nhân sau buổi (docs/CENTER-schedule-attendance-AC.md, C4.6, C4.9–C4.12, C4.16–C4.19).
 *
 * Module này giữ TRẠNG THÁI và việc GỬI: nháp → đã duyệt → đã gửi, và email. Việc SOẠN bản nháp (mẫu hoặc AI, từ
 * dữ liệu của chính học viên) thuộc core-feedback; hai module không import nhau, nên bản nháp đi qua bảng
 * `MeetingStudentNote` và apps/web ghép hai bên.
 *
 * Quy tắc cứng:
 *  - Bản `draft` KHÔNG BAO GIỜ được gửi; chỉ `approved`. Không có chế độ tự gửi.
 *  - Bản đã gửi không sửa; muốn đính chính thì tạo bản mới (`correctionOfId`) gửi kèm nhãn "Đính chính".
 *  - Một học viên chỉ có một bản đang mở (draft/approved) cho mỗi buổi.
 *  - Event không mang chữ nhận xét, chỉ id và độ dài.
 */
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { MeetingStudentNote, Prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { sendTemplatedEmail } from "../email/templates";
import { assertCanTeachMeeting } from "./teachingScope";
import { classMailUnsubscribeToken, formatVnMoment, type MeetingSummaryContent, type SummaryMailer } from "./meetingSummary";

export class MeetingNoteError extends Error {
  constructor(
    public readonly code:
      | "meeting_not_found"
      | "not_closed"
      | "note_not_found"
      | "not_in_roster"
      | "validation_failed"
      | "empty_body"
      | "already_sent"
      | "not_sent",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export const MEETING_NOTE_MAX_CHARS = 4000;
const COUNTED_ENROLLMENT = ["active", "completed"] as const;

const BodyInput = z.object({
  body: z.string().trim().min(1).max(MEETING_NOTE_MAX_CHARS),
  teacherHint: z.string().trim().max(500).nullish(),
});

export type NoteView = MeetingStudentNote;

// ── Tải & kiểm quyền ─────────────────────────────────────────────────────

/** Buổi kèm lớp và khoá — kiểu viết tường minh vì kiểu suy ra của Prisma không xuất được ra .d.ts. */
export type MeetingForNotes = Prisma.ClassMeetingGetPayload<{
  include: { section: { select: { id: true; name: true; courseId: true; instructorId: true; course: { select: { organizationId: true; title: true } } } } };
}>;

async function loadClosedMeeting(meetingId: string, db: DbClient): Promise<MeetingForNotes> {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, name: true, courseId: true, instructorId: true, course: { select: { organizationId: true, title: true } } } } },
  });
  if (!meeting) throw new MeetingNoteError("meeting_not_found");
  return meeting;
}

/**
 * Cổng cho mọi thao tác nhận xét của một buổi: người gọi phải được xếp dạy buổi này (hoặc là người quản khoá),
 * và buổi phải đã đóng. Apps/web gọi trước khi gọi core-feedback soạn nháp.
 */
export async function authorizeMeetingNotes(actorUserId: string | null, meetingId: string, db: DbClient = prisma): Promise<MeetingForNotes> {
  const meeting = await loadClosedMeeting(meetingId, db);
  if (actorUserId) await assertCanTeachMeeting(actorUserId, meeting, db);
  if (!meeting.closedAt) throw new MeetingNoteError("not_closed");
  return meeting;
}

async function loadNote(actorUserId: string | null, noteId: string, db: DbClient) {
  const note = await db.meetingStudentNote.findUnique({ where: { id: noteId } });
  if (!note) throw new MeetingNoteError("note_not_found");
  const meeting = await authorizeMeetingNotes(actorUserId, note.meetingId, db);
  return { note, meeting };
}

async function rosterIds(sectionId: string, db: DbClient): Promise<Set<string>> {
  const rows = await db.enrollment.findMany({
    where: { sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

// ── Danh sách (C4.6) ─────────────────────────────────────────────────────

export interface NoteRow {
  userId: string;
  displayName: string;
  attendance: "present" | "late" | "absent" | "excused" | null;
  /** note: có mặt/muộn, cần nhận xét; absent: vắng, chỉ có lời nhắn tay; unmarked: chưa điểm danh. */
  kind: "note" | "absent" | "unmarked";
  /** Bản đang mở (nháp hoặc đã duyệt chưa gửi). */
  note: NoteView | null;
  sentNotes: NoteView[];
}

export interface MeetingNotesView {
  meeting: { id: string; seq: number | null; sectionId: string; sectionName: string; startsAt: string; closedAt: string };
  rows: NoteRow[];
  counts: { draft: number; approved: number; sent: number; failed: number };
}

export async function listMeetingNotes(actorUserId: string, meetingId: string, db: DbClient = prisma): Promise<MeetingNotesView> {
  const meeting = await authorizeMeetingNotes(actorUserId, meetingId, db);
  const [enrollments, attendance, notes] = await Promise.all([
    db.enrollment.findMany({
      where: { sectionId: meeting.sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { user: { select: { id: true, displayName: true } } },
    }),
    db.studentAttendance.findMany({ where: { meetingId }, select: { userId: true, status: true } }),
    db.meetingStudentNote.findMany({ where: { meetingId }, orderBy: { draftedAt: "asc" } }),
  ]);
  const att = new Map(attendance.map((a) => [a.userId, a.status]));
  const seen = new Set<string>();
  const rows: NoteRow[] = [];
  for (const { user } of enrollments) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    const a = att.get(user.id) ?? null;
    const mine = notes.filter((n) => n.userId === user.id);
    rows.push({
      userId: user.id,
      displayName: user.displayName,
      attendance: a,
      kind: a === "present" || a === "late" ? "note" : a === "absent" || a === "excused" ? "absent" : "unmarked",
      note: mine.find((n) => n.status !== "sent") ?? null,
      sentNotes: mine.filter((n) => n.status === "sent"),
    });
  }
  rows.sort((x, y) => x.displayName.localeCompare(y.displayName, "vi"));
  return {
    meeting: {
      id: meeting.id,
      seq: meeting.seq,
      sectionId: meeting.sectionId,
      sectionName: meeting.section.name,
      startsAt: meeting.startsAt.toISOString(),
      closedAt: meeting.closedAt!.toISOString(),
    },
    rows,
    counts: {
      draft: notes.filter((n) => n.status === "draft").length,
      approved: notes.filter((n) => n.status === "approved").length,
      sent: notes.filter((n) => n.status === "sent").length,
      failed: notes.filter((n) => n.status === "approved" && n.sendError).length,
    },
  };
}

// ── Soạn tay, sửa, duyệt (C4.9, C4.10) ───────────────────────────────────

function parseBody(raw: unknown) {
  const r = BodyInput.safeParse(raw);
  if (!r.success) throw new MeetingNoteError("validation_failed", r.error.flatten());
  return r.data;
}

/** Giáo viên tự viết (hoặc thêm lời nhắn cho người vắng). Ghi đè bản đang mở nếu có. */
export async function saveMeetingNote(
  actorUserId: string,
  meetingId: string,
  userId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<NoteView> {
  const meeting = await authorizeMeetingNotes(actorUserId, meetingId, db);
  const input = parseBody(rawInput);
  if (!(await rosterIds(meeting.sectionId, db)).has(userId)) throw new MeetingNoteError("not_in_roster");
  const open = await db.meetingStudentNote.findFirst({ where: { meetingId, userId, status: { not: "sent" } } });
  if (open) {
    return db.meetingStudentNote.update({
      where: { id: open.id },
      data: { body: input.body, teacherHint: input.teacherHint ?? open.teacherHint, source: "manual", status: "draft", approvedAt: null, approvedById: null, sendError: null },
    });
  }
  if (await db.meetingStudentNote.findFirst({ where: { meetingId, userId, status: "sent" }, select: { id: true } })) {
    throw new MeetingNoteError("already_sent");
  }
  return db.meetingStudentNote.create({
    data: { meetingId, userId, body: input.body, teacherHint: input.teacherHint ?? null, source: "manual", draftedById: actorUserId },
  });
}

export async function updateMeetingNote(
  actorUserId: string,
  noteId: string,
  rawInput: { body?: string; teacherHint?: string | null },
  db: DbClient = prisma,
): Promise<NoteView> {
  const { note } = await loadNote(actorUserId, noteId, db);
  if (note.status === "sent") throw new MeetingNoteError("already_sent");
  const data: Record<string, unknown> = {};
  if (rawInput.teacherHint !== undefined) {
    const hint = (rawInput.teacherHint ?? "").trim();
    if (hint.length > 500) throw new MeetingNoteError("validation_failed");
    data.teacherHint = hint || null;
  }
  if (rawInput.body !== undefined) {
    const { body } = parseBody({ body: rawInput.body });
    if (body !== note.body) {
      data.body = body;
      // Sửa chữ sau khi duyệt thì phải duyệt lại; bản do mô hình soạn mà giáo viên đã sửa thì đánh dấu để phân tích.
      data.status = "draft";
      data.approvedAt = null;
      data.approvedById = null;
      data.sendError = null;
      if (note.source !== "manual") data.facts = { ...((note.facts as object | null) ?? {}), edited: true };
    }
  }
  return db.meetingStudentNote.update({ where: { id: noteId }, data });
}

export async function approveMeetingNote(actorUserId: string, noteId: string, db: DbClient = prisma): Promise<NoteView> {
  const { note } = await loadNote(actorUserId, noteId, db);
  if (note.status === "sent") throw new MeetingNoteError("already_sent");
  if (!note.body.trim()) throw new MeetingNoteError("empty_body");
  return db.meetingStudentNote.update({
    where: { id: noteId },
    data: { status: "approved", approvedAt: new Date(), approvedById: actorUserId },
  });
}

export async function unapproveMeetingNote(actorUserId: string, noteId: string, db: DbClient = prisma): Promise<NoteView> {
  const { note } = await loadNote(actorUserId, noteId, db);
  if (note.status === "sent") throw new MeetingNoteError("already_sent");
  if (note.status === "draft") return note;
  return db.meetingStudentNote.update({ where: { id: noteId }, data: { status: "draft", approvedAt: null, approvedById: null } });
}

/** Bản đã gửi muốn đính chính: tạo bản nháp mới (chép nội dung cũ), gửi kèm nhãn "Đính chính". */
export async function createNoteCorrection(actorUserId: string, sentNoteId: string, db: DbClient = prisma): Promise<NoteView> {
  const { note } = await loadNote(actorUserId, sentNoteId, db);
  if (note.status !== "sent") throw new MeetingNoteError("not_sent");
  const open = await db.meetingStudentNote.findFirst({ where: { correctionOfId: sentNoteId, status: { not: "sent" } } });
  if (open) return open;
  return db.meetingStudentNote.create({
    data: {
      meetingId: note.meetingId,
      userId: note.userId,
      body: note.body,
      source: "manual",
      correctionOfId: sentNoteId,
      draftedById: actorUserId,
    },
  });
}

// ── Gửi (C4.10, C4.17, C4.18) ────────────────────────────────────────────

export interface SendNotesOptions {
  mailer?: SummaryMailer;
  baseUrl: string;
  /**
   * Gọi sau khi một bản đã gửi — apps/web nối vào core-feedback để ghi FeedbackDelivery mang toạ độ SSMMD.
   * Trả id FeedbackDelivery. Lỗi ở đây không làm mất bản đã gửi (chỉ để trống id, ghi lại sau).
   */
  afterSent?: (note: NoteView) => Promise<string | null>;
}

export interface SendNotesResult {
  sent: number;
  failed: number;
  skipped: number;
  items: Array<{ noteId: string; userId: string; status: "sent" | "failed" | "skipped" }>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function bodyToHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const defaultMailer: SummaryMailer = (input) => sendTemplatedEmail(input);

export async function sendApprovedNotes(
  /** null = hệ thống (hàng đợi) gửi thay giáo viên. */
  actorUserId: string | null,
  meetingId: string,
  opts: SendNotesOptions,
  db: DbClient = prisma,
): Promise<SendNotesResult> {
  const meeting = await authorizeMeetingNotes(actorUserId, meetingId, db);
  const summary = meeting.summary as unknown as MeetingSummaryContent | null;
  const mailer = opts.mailer ?? defaultMailer;
  const base = opts.baseUrl.replace(/\/$/, "");
  const approved = await db.meetingStudentNote.findMany({
    where: { meetingId, status: "approved" },
    orderBy: { approvedAt: "asc" },
    include: { user: { select: { id: true, email: true, displayName: true, classEmailOptOut: true } } },
  });

  const out: SendNotesResult = { sent: 0, failed: 0, skipped: 0, items: [] };
  const eventUser = actorUserId ?? meeting.closedById;
  for (const n of approved) {
    // Giữ chỗ trước khi gửi: hai lượt chạy song song không gửi trùng một bản.
    const claimed = await db.meetingStudentNote.updateMany({
      where: { id: n.id, status: "approved" },
      data: { status: "sent", sentAt: new Date(), sendAttempts: { increment: 1 }, sendError: null },
    });
    if (claimed.count === 0) continue;

    let final: "sent" | "failed" | "skipped" = "sent";
    if (n.user.classEmailOptOut || !n.user.email) {
      final = "skipped";
      await db.meetingStudentNote.update({ where: { id: n.id }, data: { sendError: n.user.classEmailOptOut ? "email_optout" : "no_email" } });
    } else {
      try {
        const r = await mailer({
          key: "class.student_note",
          to: n.user.email,
          organizationId: meeting.section.course.organizationId,
          variables: {
            learnerName: n.user.displayName,
            courseTitle: meeting.section.course.title,
            sectionName: meeting.section.name,
            meetingLabel: summary?.planTitle ?? (meeting.seq ? `Buổi ${meeting.seq}` : "Buổi dạy bù"),
            meetingDate: formatVnMoment(meeting.startsAt.toISOString()),
            noteHtml: bodyToHtml(n.body),
            noteText: n.body,
            correctionLabel: n.correctionOfId ? "Đính chính: " : "",
            appUrl: `${base}/me/lich-hoc`,
            unsubscribeUrl: `${base}/api/class-email/unsubscribe?token=${classMailUnsubscribeToken(n.user.id)}`,
          },
        });
        if (!(r.delivered || r.loggedOnly)) throw new Error(String(typeof r.error === "string" ? r.error : JSON.stringify(r.error ?? "unknown")));
      } catch (e) {
        final = "failed";
        // Trả về approved để giáo viên thấy lỗi và gửi lại; bản này chưa từng tới học viên.
        await db.meetingStudentNote.update({
          where: { id: n.id },
          data: { status: "approved", sentAt: null, sendError: String((e as Error).message ?? e).slice(0, 300) },
        });
      }
    }

    if (final !== "failed") {
      const fresh = await db.meetingStudentNote.findUniqueOrThrow({ where: { id: n.id } });
      if (opts.afterSent) {
        try {
          const deliveryId = await opts.afterSent(fresh);
          if (deliveryId) await db.meetingStudentNote.update({ where: { id: n.id }, data: { feedbackDeliveryId: deliveryId } });
        } catch (e) {
          console.error(`[meeting-note:after_sent_failed] note=${n.id} ${(e as Error).message}`);
        }
      }
      if (eventUser) {
        await emitEvent(
          eventUser,
          LearningEventType.MeetingNoteSent,
          { meetingId, noteId: n.id, learnerId: n.userId, bodyLength: n.body.length, correction: n.correctionOfId != null },
          { courseId: meeting.section.courseId },
          db,
        );
      }
    }
    out.items.push({ noteId: n.id, userId: n.userId, status: final });
    out[final === "sent" ? "sent" : final === "failed" ? "failed" : "skipped"]++;
  }
  return out;
}

// ── Học viên đọc (C4.16) ─────────────────────────────────────────────────

export interface MyNoteItem {
  noteId: string;
  meetingId: string;
  seq: number | null;
  planTitle: string | null;
  sectionName: string;
  startsAt: string;
  sentAt: string;
  body: string;
  correction: boolean;
}

/** Nhận xét ĐÃ GỬI của chính mình, mới nhất trước. Không trả nháp, ghi chú giáo viên hay dữ liệu soạn. */
export async function listMyMeetingNotes(userId: string, limit = 20, db: DbClient = prisma): Promise<MyNoteItem[]> {
  const rows = await db.meetingStudentNote.findMany({
    where: { userId, status: "sent" },
    orderBy: { sentAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    include: { meeting: { select: { id: true, seq: true, startsAt: true, summary: true, section: { select: { name: true } } } } },
  });
  return rows.map((r) => ({
    noteId: r.id,
    meetingId: r.meetingId,
    seq: r.meeting.seq,
    planTitle: (r.meeting.summary as unknown as MeetingSummaryContent | null)?.planTitle ?? null,
    sectionName: r.meeting.section.name,
    startsAt: r.meeting.startsAt.toISOString(),
    sentAt: r.sentAt!.toISOString(),
    body: r.body,
    correction: r.correctionOfId != null,
  }));
}
