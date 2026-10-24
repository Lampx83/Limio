/**
 * CENTER C4a — kết thúc buổi và tổng kết chung gửi cả lớp (docs/CENTER-schedule-attendance-AC.md, C4.1–C4.5, C4.19).
 *
 * - `closeMeeting`: giáo viên bấm "Kết thúc buổi" → buổi thành `held`, ghi ai đóng và khi nào, chụp tổng kết
 *   (dựng từ giáo án của buổi) vào `ClassMeeting.summary` để email và trong app dùng chung một nội dung.
 * - `sendMeetingSummary`: gửi cho mọi học viên của lớp, **idempotent** theo (buổi, học viên): người đã nhận không
 *   nhận lại, người lỗi được gửi lại ở lần sau. Chạy lại bao nhiêu lần cũng an toàn (hàng đợi retry).
 * - Học viên không bao giờ nhận nội dung bài học, chỉ tên bài; bài ẩn và bài tập ẩn bị lọc.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";
import { emitEvent } from "../learning/events";
import { sendTemplatedEmail, type SendTemplatedEmailInput } from "../email/templates";
import { assertCanManageCourse, assertCanTeachMeeting } from "./teachingScope";
import { loadSessionPlans } from "./sessionPlan";

export class MeetingSummaryError extends Error {
  constructor(
    public readonly code: "meeting_not_found" | "meeting_cancelled" | "meeting_not_started" | "not_closed" | "section_not_found",
  ) {
    super(code);
  }
}

const COUNTED_ENROLLMENT = ["active", "completed"] as const;
const MAX_VOCAB = 12;

// ── Nội dung tổng kết ────────────────────────────────────────────────────

export interface MeetingSummaryContent {
  version: 1;
  meetingId: string;
  sectionName: string;
  courseTitle: string;
  seq: number | null;
  startsAt: string;
  /** Tên giáo án của buổi (chương `sessionNo = seq`); null khi chưa gắn giáo án. */
  planTitle: string | null;
  lessons: Array<{ id: string; title: string }>;
  vocab: Array<{ term: string; reading: string | null; meaning: string }>;
  homework: Array<{ assignmentId: string; title: string; dueAt: string | null }>;
  next: { meetingId: string; seq: number | null; startsAt: string; endsAt: string; room: string | null; planTitle: string | null } | null;
}

async function buildSummary(meetingId: string, db: DbClient): Promise<MeetingSummaryContent> {
  const m = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, name: true, courseId: true, course: { select: { title: true } } } } },
  });
  if (!m) throw new MeetingSummaryError("meeting_not_found");
  const courseId = m.section.courseId;

  const plans = await loadSessionPlans([courseId], "learner", db);
  const byNo = plans.get(courseId);
  const plan = m.seq != null ? byNo?.get(m.seq) : undefined;
  const lessonIds = plan?.lessons.map((l) => l.id) ?? [];

  const [vocabItems, assignments, nextMeeting, dueOverrides] = await Promise.all([
    lessonIds.length
      ? db.contentItem.findMany({
          where: { lessonId: { in: lessonIds }, type: "vocab_list", isHidden: false },
          orderBy: [{ lessonId: "asc" }, { orderIndex: "asc" }],
          select: { payload: true },
        })
      : Promise.resolve([]),
    lessonIds.length
      ? db.assignment.findMany({
          where: { lessonId: { in: lessonIds }, isHidden: false },
          orderBy: [{ createdAt: "asc" }],
          select: { id: true, title: true, dueAt: true },
        })
      : Promise.resolve([]),
    db.classMeeting.findFirst({
      where: { sectionId: m.sectionId, status: { not: "cancelled" }, startsAt: { gt: m.startsAt } },
      orderBy: { startsAt: "asc" },
    }),
    lessonIds.length
      ? db.assignmentSectionDue.findMany({ where: { sectionId: m.sectionId }, select: { assignmentId: true, dueAt: true } })
      : Promise.resolve([]),
  ]);

  const vocab: MeetingSummaryContent["vocab"] = [];
  for (const it of vocabItems) {
    const items = (it.payload as { items?: Array<{ term?: string; reading?: string | null; meaning?: string }> } | null)?.items ?? [];
    for (const v of items) {
      if (vocab.length >= MAX_VOCAB) break;
      if (v.term && v.meaning) vocab.push({ term: v.term, reading: v.reading || null, meaning: v.meaning });
    }
  }
  const overrideBy = new Map(dueOverrides.map((o) => [o.assignmentId, o.dueAt]));
  const homework = assignments.map((a) => {
    const due = overrideBy.has(a.id) ? overrideBy.get(a.id)! : a.dueAt;
    return { assignmentId: a.id, title: a.title, dueAt: due ? due.toISOString() : null };
  });

  return {
    version: 1,
    meetingId: m.id,
    sectionName: m.section.name,
    courseTitle: m.section.course.title,
    seq: m.seq,
    startsAt: m.startsAt.toISOString(),
    planTitle: plan?.title ?? null,
    lessons: plan?.lessons.map((l) => ({ id: l.id, title: l.title })) ?? [],
    vocab,
    homework,
    next: nextMeeting
      ? {
          meetingId: nextMeeting.id,
          seq: nextMeeting.seq,
          startsAt: nextMeeting.startsAt.toISOString(),
          endsAt: nextMeeting.endsAt.toISOString(),
          room: nextMeeting.room,
          planTitle: nextMeeting.seq != null ? (byNo?.get(nextMeeting.seq)?.title ?? null) : null,
        }
      : null,
  };
}

// ── Kết thúc buổi (C4.1) ─────────────────────────────────────────────────

export interface CloseMeetingResult {
  meetingId: string;
  alreadyClosed: boolean;
  /** Lớp có bật tự gửi tổng kết chung không (người gọi quyết định có xếp hàng gửi hay không). */
  autoSend: boolean;
  summary: MeetingSummaryContent;
}

export async function closeMeeting(
  actorUserId: string,
  meetingId: string,
  now: Date = new Date(),
  db: DbClient = prisma,
): Promise<CloseMeetingResult> {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, courseId: true, instructorId: true, autoSendSummary: true } } },
  });
  if (!meeting) throw new MeetingSummaryError("meeting_not_found");
  await assertCanTeachMeeting(actorUserId, meeting, db);
  const autoSend = meeting.section.autoSendSummary;

  if (meeting.closedAt && meeting.summary) {
    return { meetingId, alreadyClosed: true, autoSend, summary: meeting.summary as unknown as MeetingSummaryContent };
  }
  if (meeting.status === "cancelled") throw new MeetingSummaryError("meeting_cancelled");
  if (now.getTime() < meeting.startsAt.getTime()) throw new MeetingSummaryError("meeting_not_started");

  const summary = await buildSummary(meetingId, db);
  // Chỉ người đầu tiên đóng được ghi nhận; hai lần bấm đồng thời không phát hai event.
  const claimed = await db.classMeeting.updateMany({
    where: { id: meetingId, closedAt: null },
    data: { status: "held", closedAt: now, closedById: actorUserId, summary: summary as object },
  });
  if (claimed.count === 0) {
    const row = await db.classMeeting.findUniqueOrThrow({ where: { id: meetingId } });
    return { meetingId, alreadyClosed: true, autoSend, summary: row.summary as unknown as MeetingSummaryContent };
  }
  await emitEvent(
    actorUserId,
    LearningEventType.ClassMeetingClosed,
    { meetingId, sectionId: meeting.sectionId, courseId: meeting.section.courseId, hasPlan: summary.planTitle != null },
    { courseId: meeting.section.courseId, eventKey: `class.meeting.closed:${meetingId}` },
    db,
  );
  return { meetingId, alreadyClosed: false, autoSend, summary };
}

/** Bật/tắt tự gửi tổng kết chung của lớp (mặc định bật). Chỉ người quản khoá. */
export async function setSectionAutoSendSummary(
  actorUserId: string,
  sectionId: string,
  enabled: boolean,
  db: DbClient = prisma,
): Promise<{ autoSendSummary: boolean }> {
  const section = await db.courseSection.findUnique({ where: { id: sectionId }, select: { courseId: true } });
  if (!section) throw new MeetingSummaryError("section_not_found");
  await assertCanManageCourse(actorUserId, section.courseId, db);
  const row = await db.courseSection.update({ where: { id: sectionId }, data: { autoSendSummary: enabled }, select: { autoSendSummary: true } });
  return { autoSendSummary: row.autoSendSummary };
}

// ── Gửi cả lớp (C4.4, C4.5) ─────────────────────────────────────────────

export type SummaryMailer = (
  input: SendTemplatedEmailInput,
) => Promise<{ delivered: boolean; loggedOnly: boolean; error?: unknown }>;

export interface SendSummaryOptions {
  mailer?: SummaryMailer;
  /** Gốc URL của ứng dụng, để dựng liên kết trong email. */
  baseUrl: string;
}

export interface SendSummaryResult {
  sent: number;
  failed: number;
  skipped: number;
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "Thứ Ba 03/11/2026 18:30" theo giờ Việt Nam. */
export function formatVnMoment(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const vnWeekday = new Date(d.getTime() + 7 * 3600_000).getUTCDay();
  return `${WEEKDAYS[vnWeekday]} ${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function listHtml(items: string[]): string {
  return items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";
}
const listText = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

/** Biến cho template `class.meeting_summary`. Phần *Html đã escape; phần *Text là chữ thuần. */
export function buildSummaryVars(
  s: MeetingSummaryContent,
  ctx: { learnerName: string; absent: boolean; appUrl: string; unsubscribeUrl: string },
): Record<string, string> {
  const lessons = s.lessons.map((l) => l.title);
  const vocab = s.vocab.map((v) => `${v.term}${v.reading ? ` (${v.reading})` : ""} — ${v.meaning}`);
  const homework = s.homework.map((h) => `${h.title}${h.dueAt ? ` — hạn ${formatVnMoment(h.dueAt)}` : ""}`);
  const nextText = s.next
    ? `Buổi tiếp theo: ${formatVnMoment(s.next.startsAt)}${s.next.room ? `, phòng ${s.next.room}` : ""}${s.next.planTitle ? `. Nội dung: ${s.next.planTitle}` : ""}.`
    : "Hiện chưa có buổi tiếp theo trong lịch.";
  const makeupText =
    ctx.absent && lessons.length
      ? `Em vắng buổi này, bài cần học bù: ${lessons.join("; ")}.`
      : ctx.absent
        ? "Em vắng buổi này, em nhắn thầy/cô để biết cần học bù phần nào."
        : "";
  return {
    learnerName: ctx.learnerName,
    courseTitle: s.courseTitle,
    sectionName: s.sectionName,
    meetingLabel: s.planTitle ?? (s.seq ? `Buổi ${s.seq}` : "Buổi dạy bù"),
    meetingDate: formatVnMoment(s.startsAt),
    learnedHtml: listHtml(lessons),
    learnedText: listText(lessons),
    vocabHtml: listHtml(vocab),
    vocabText: listText(vocab),
    homeworkHtml: listHtml(homework),
    homeworkText: listText(homework),
    nextText,
    makeupText,
    makeupHtml: makeupText ? `<p><strong>${esc(makeupText)}</strong></p>` : "",
    appUrl: ctx.appUrl,
    unsubscribeUrl: ctx.unsubscribeUrl,
  };
}

const defaultMailer: SummaryMailer = (input) => sendTemplatedEmail(input);

export async function sendMeetingSummary(
  /** null = hệ thống (hàng đợi) gửi thay giáo viên. */
  actorUserId: string | null,
  meetingId: string,
  opts: SendSummaryOptions,
  db: DbClient = prisma,
): Promise<SendSummaryResult> {
  const meeting = await db.classMeeting.findUnique({
    where: { id: meetingId },
    include: { section: { select: { id: true, courseId: true, instructorId: true, course: { select: { organizationId: true } } } } },
  });
  if (!meeting) throw new MeetingSummaryError("meeting_not_found");
  if (actorUserId) await assertCanTeachMeeting(actorUserId, meeting, db);
  if (!meeting.closedAt || !meeting.summary) throw new MeetingSummaryError("not_closed");
  const summary = meeting.summary as unknown as MeetingSummaryContent;
  const mailer = opts.mailer ?? defaultMailer;

  const [enrollments, attendance, done] = await Promise.all([
    db.enrollment.findMany({
      where: { sectionId: meeting.sectionId, status: { in: [...COUNTED_ENROLLMENT] } },
      select: { user: { select: { id: true, email: true, displayName: true, classEmailOptOut: true } } },
    }),
    db.studentAttendance.findMany({ where: { meetingId }, select: { userId: true, status: true } }),
    db.meetingSummaryDelivery.findMany({ where: { meetingId }, select: { userId: true, status: true, attempts: true } }),
  ]);
  const absent = new Set(attendance.filter((a) => a.status === "absent" || a.status === "excused").map((a) => a.userId));
  const doneBy = new Map(done.map((d) => [d.userId, d]));

  const result: SendSummaryResult = { sent: 0, failed: 0, skipped: 0 };
  const seen = new Set<string>();
  for (const { user } of enrollments) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    const prev = doneBy.get(user.id);
    if (prev?.status === "sent") continue; // C4.5: mỗi (buổi, học viên) nhiều nhất một email
    const attempts = (prev?.attempts ?? 0) + 1;

    let status: "sent" | "failed" | "skipped_optout" | "skipped_no_email";
    let error: string | null = null;
    if (user.classEmailOptOut) status = "skipped_optout";
    else if (!user.email) status = "skipped_no_email";
    else {
      const vars = buildSummaryVars(summary, {
        learnerName: user.displayName,
        absent: absent.has(user.id),
        appUrl: `${opts.baseUrl.replace(/\/$/, "")}/me/lich-hoc`,
        unsubscribeUrl: `${opts.baseUrl.replace(/\/$/, "")}/api/class-email/unsubscribe?token=${classMailUnsubscribeToken(user.id)}`,
      });
      try {
        const r = await mailer({ key: "class.meeting_summary", to: user.email, variables: vars, organizationId: meeting.section.course.organizationId });
        if (r.delivered || r.loggedOnly) status = "sent";
        else {
          status = "failed";
          error = String(typeof r.error === "string" ? r.error : JSON.stringify(r.error ?? "unknown")).slice(0, 300);
        }
      } catch (e) {
        // Một email lỗi không chặn các email khác (C4.17).
        status = "failed";
        error = String((e as Error).message ?? e).slice(0, 300);
      }
    }
    await db.meetingSummaryDelivery.upsert({
      where: { meetingId_userId: { meetingId, userId: user.id } },
      create: { meetingId, userId: user.id, status, error, attempts, sentAt: status === "sent" ? new Date() : null },
      update: { status, error, attempts, sentAt: status === "sent" ? new Date() : null },
    });
    if (status === "sent") result.sent++;
    else if (status === "failed") result.failed++;
    else result.skipped++;
  }

  const eventUser = actorUserId ?? meeting.closedById;
  if (eventUser && result.sent + result.failed + result.skipped > 0) {
    await emitEvent(
      eventUser,
      LearningEventType.MeetingSummarySent,
      { meetingId, sectionId: meeting.sectionId, courseId: meeting.section.courseId, ...result },
      { courseId: meeting.section.courseId },
      db,
    );
  }
  return result;
}

// ── Học viên đọc lại trong app (C4.4) ────────────────────────────────────

export interface MySummaryItem {
  meetingId: string;
  seq: number | null;
  planTitle: string | null;
  sectionName: string;
  startsAt: string;
  closedAt: string;
  summary: MeetingSummaryContent;
}

/** Tổng kết các buổi đã đóng của lớp mình đang học, mới nhất trước. Không bao giờ trả buổi lớp khác. */
export async function getMyMeetingSummaries(userId: string, limit = 10, db: DbClient = prisma): Promise<MySummaryItem[]> {
  const rows = await db.classMeeting.findMany({
    where: {
      closedAt: { not: null },
      summary: { not: undefined },
      section: { enrollments: { some: { userId, status: { in: [...COUNTED_ENROLLMENT] } } } },
    },
    orderBy: { closedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    include: { section: { select: { name: true } } },
  });
  return rows
    .filter((r) => r.summary != null)
    .map((r) => {
      const s = r.summary as unknown as MeetingSummaryContent;
      return {
        meetingId: r.id,
        seq: r.seq,
        planTitle: s.planTitle,
        sectionName: r.section.name,
        startsAt: r.startsAt.toISOString(),
        closedAt: r.closedAt!.toISOString(),
        summary: s,
      };
    });
}

// ── Huỷ nhận email (C4.19) ───────────────────────────────────────────────

function unsubscribeSecret(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET chưa đặt");
  return "dev-only-class-mail-secret";
}

const sign = (userId: string) => createHmac("sha256", unsubscribeSecret()).update(`class-mail:${userId}`).digest("base64url");

export function classMailUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Trả userId nếu chữ ký đúng, null nếu sai hay bị sửa. */
export function verifyClassMailUnsubscribeToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const userId = token.slice(0, i);
  const given = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(sign(userId));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}

/** Tắt/bật email tổng kết và nhận xét sau buổi (vẫn xem được trong app). */
export async function setClassEmailOptOut(userId: string, optOut: boolean, db: DbClient = prisma): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { classEmailOptOut: optOut } });
}
