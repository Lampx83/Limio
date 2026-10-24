import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  MeetingSummaryError,
  buildSummaryVars,
  classMailUnsubscribeToken,
  closeMeeting,
  getMyMeetingSummaries,
  sendMeetingSummary,
  setClassEmailOptOut,
  setSectionAutoSendSummary,
  verifyClassMailUnsubscribeToken,
  type SummaryMailer,
} from "../meetingSummary";
import { setClassSchedule } from "../classSchedule";
import { markAttendance } from "../attendance";
import { createCourse } from "../courses";
import { createCourseSection } from "../sections";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { createContentItem } from "../contents";
import { createAssignment } from "../assignments";
import { CourseAuthzError } from "../authz";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const BEFORE = new Date("2026-10-23T03:00:00.000Z");
// Sau buổi 1 (thứ ba 03/11/2026 18:30–20:30 giờ VN = 11:30–13:30 UTC), trước buổi 2.
const AFTER_M1 = new Date("2026-11-03T14:00:00.000Z");

async function makeUser(email: string, roles: string[] = []) {
  const r = await registerUser({ email, password: "password1234", displayName: email.split("@")[0]! }, BASE);
  for (const name of roles) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.userRole.create({ data: { userId: r.userId, roleId: role.id, grantedBy: r.userId } });
  }
  return r.userId;
}

interface Setup {
  teacher: string;
  courseId: string;
  sectionId: string;
  learners: string[];
  meetings: Array<{ id: string; seq: number | null }>;
  lessons: string[];
  assignmentId: string;
}

/** Khoá 3 chương gắn buổi 1..3; chương 1 có từ vựng + bài tập; lớp 3 học viên, lịch 3 buổi thứ ba hằng tuần. */
async function setup(tag: string, opts: { withPlan?: boolean } = {}): Promise<Setup> {
  const withPlan = opts.withPlan ?? true;
  const teacher = await makeUser(`ms-${tag}-t@e.com`, ["instructor"]);
  const { courseId } = await createCourse(teacher, {
    title: `Tiếng Trung ${tag}`,
    description: "d",
    slug: `ms-${tag}`,
    personalizationEnabled: false,
  });
  const lessons: string[] = [];
  let assignmentId = "";
  if (withPlan) {
    for (let i = 1; i <= 3; i++) {
      const m = await createModule(teacher, courseId, { title: `Buổi ${i}: Chủ đề ${i}`, orderIndex: i - 1 });
      await prisma.module.update({ where: { id: m.moduleId }, data: { sessionNo: i } });
      const l1 = await createLesson(teacher, m.moduleId, { title: `Từ vựng ${i}`, orderIndex: 0 });
      const l2 = await createLesson(teacher, m.moduleId, { title: `Hội thoại ${i}`, orderIndex: 1 });
      lessons.push(l1.lessonId, l2.lessonId);
      if (i === 1) {
        await createContentItem(teacher, l1.lessonId, {
          type: "vocab_list",
          orderIndex: 0,
          payload: { items: [{ term: "你好", reading: "nǐ hǎo", meaning: "xin chào" }, { term: "谢谢", reading: "xièxie", meaning: "cảm ơn" }] },
        });
        const a = await createAssignment(teacher, l1.lessonId, {
          title: "Viết 5 câu chào hỏi",
          description: "Viết 5 câu",
          dueAt: "2026-11-08T16:59:00.000Z",
        });
        assignmentId = a.assignmentId;
      }
    }
  }
  const section = await createCourseSection(teacher, courseId, { name: "Lớp A" });
  await setClassSchedule(
    teacher,
    section.id,
    { startDate: "2026-11-03", totalMeetings: 3, slots: [{ weekday: 2, startTime: "18:30", durationMin: 120, room: "B2" }] },
    prisma,
    BEFORE,
  );
  const learners: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const u = await makeUser(`ms-${tag}-l${i}@e.com`);
    await prisma.enrollment.create({ data: { userId: u, courseId, sectionId: section.id, courseVersion: 1 } });
    learners.push(u);
  }
  const meetings = await prisma.classMeeting.findMany({ where: { sectionId: section.id }, orderBy: { startsAt: "asc" }, select: { id: true, seq: true } });
  return { teacher, courseId, sectionId: section.id, learners, meetings, lessons, assignmentId };
}

function recorder(fail: Set<string> = new Set()) {
  const calls: Array<{ to: string; key: string; vars: Record<string, unknown> }> = [];
  const mailer: SummaryMailer = async (input) => {
    calls.push({ to: input.to, key: input.key, vars: input.variables });
    if (fail.has(input.to)) return { delivered: false, loggedOnly: false, error: "provider_down" };
    return { delivered: true, loggedOnly: false };
  };
  return { calls, mailer };
}

describe("closeMeeting — kết thúc buổi (C4.1)", () => {
  it("đóng buổi: held, ghi người đóng và giờ đóng, lưu tổng kết, phát class.meeting.closed một lần", async () => {
    const s = await setup("close");
    const res = await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    expect(res).toMatchObject({ alreadyClosed: false, autoSend: true });
    const row = await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } });
    expect(row).toMatchObject({ status: "held", closedById: s.teacher });
    expect(row.closedAt).toEqual(AFTER_M1);
    expect(row.summary).not.toBeNull();

    const again = await closeMeeting(s.teacher, s.meetings[0]!.id, new Date(AFTER_M1.getTime() + 60_000));
    expect(again.alreadyClosed).toBe(true);
    expect((await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } })).closedAt).toEqual(AFTER_M1);
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.ClassMeetingClosed, userId: s.teacher } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ meetingId: s.meetings[0]!.id, hasPlan: true });
  });

  it("chưa bắt đầu hoặc đã huỷ thì không đóng được; người không liên quan bị từ chối", async () => {
    const s = await setup("close-bad");
    await expect(closeMeeting(s.teacher, s.meetings[0]!.id, BEFORE)).rejects.toMatchObject({ code: "meeting_not_started" });
    await prisma.classMeeting.update({ where: { id: s.meetings[1]!.id }, data: { status: "cancelled" } });
    await expect(closeMeeting(s.teacher, s.meetings[1]!.id, new Date("2026-12-01T00:00:00Z"))).rejects.toMatchObject({ code: "meeting_cancelled" });
    const stranger = await makeUser("ms-close-bad-x@e.com", ["instructor"]);
    await expect(closeMeeting(stranger, s.meetings[0]!.id, AFTER_M1)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(closeMeeting(s.teacher, "no-such", AFTER_M1)).rejects.toBeInstanceOf(MeetingSummaryError);
  });
});

describe("tổng kết chung dựng từ giáo án (C4.2, C4.3)", () => {
  it("có giáo án: học gì, từ vựng, bài tập + hạn, buổi sau học gì và giờ nào", async () => {
    const s = await setup("content");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    const summary = (await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } })).summary as any;
    expect(summary).toMatchObject({
      seq: 1,
      planTitle: "Buổi 1: Chủ đề 1",
      lessons: [{ title: "Từ vựng 1" }, { title: "Hội thoại 1" }],
      vocab: [{ term: "你好", reading: "nǐ hǎo", meaning: "xin chào" }, { term: "谢谢", reading: "xièxie", meaning: "cảm ơn" }],
      homework: [{ title: "Viết 5 câu chào hỏi", dueAt: "2026-11-08T16:59:00.000Z" }],
      next: { seq: 2, planTitle: "Buổi 2: Chủ đề 2", room: "B2" },
    });
    expect(summary.next.startsAt).toBe("2026-11-10T11:30:00.000Z");
  });

  it("hạn bài tập riêng của lớp thắng hạn chung; lớp không có hạn thì dueAt null", async () => {
    const s = await setup("due");
    await prisma.assignmentSectionDue.create({ data: { assignmentId: s.assignmentId, sectionId: s.sectionId, dueAt: new Date("2026-11-20T10:00:00.000Z") } });
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    let summary = (await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } })).summary as any;
    expect(summary.homework[0].dueAt).toBe("2026-11-20T10:00:00.000Z");

    await prisma.assignmentSectionDue.update({ where: { assignmentId_sectionId: { assignmentId: s.assignmentId, sectionId: s.sectionId } }, data: { dueAt: null } });
    await prisma.classMeeting.update({ where: { id: s.meetings[0]!.id }, data: { closedAt: null, status: "planned", summary: undefined } });
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    summary = (await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } })).summary as any;
    expect(summary.homework[0].dueAt).toBeNull();
  });

  it("bài tập ẩn không có trong tổng kết", async () => {
    const s = await setup("hidden-hw");
    await prisma.assignment.update({ where: { id: s.assignmentId }, data: { isHidden: true } });
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    const summary = (await prisma.classMeeting.findUniqueOrThrow({ where: { id: s.meetings[0]!.id } })).summary as any;
    expect(summary.homework).toEqual([]);
  });

  it("chưa gắn giáo án: chỉ có giờ buổi sau và bài tập (nếu có), không bịa nội dung", async () => {
    const s = await setup("noplan", { withPlan: false });
    const res = await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    expect(res.summary).toMatchObject({ planTitle: null, lessons: [], vocab: [], homework: [], next: { seq: 2, planTitle: null } });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.ClassMeetingClosed } });
    expect(ev.payload).toMatchObject({ hasPlan: false });
  });

  it("buổi cuối: không có buổi sau thì next = null", async () => {
    const s = await setup("last");
    const res = await closeMeeting(s.teacher, s.meetings[2]!.id, new Date("2026-11-20T00:00:00Z"));
    expect(res.summary.next).toBeNull();
  });
});

describe("sendMeetingSummary — gửi cả lớp (C4.4, C4.5)", () => {
  it("gửi mọi học viên của lớp; người vắng nhận thêm dòng bài cần học bù; chưa đóng buổi thì không gửi", async () => {
    const s = await setup("send");
    const { mailer, calls } = recorder();
    await expect(sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE })).rejects.toMatchObject({ code: "not_closed" });

    await markAttendance(s.teacher, s.meetings[0]!.id, { entries: [
      { userId: s.learners[0]!, status: "present" },
      { userId: s.learners[1]!, status: "absent" },
      { userId: s.learners[2]!, status: "excused" },
    ] }, prisma, AFTER_M1);
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    const res = await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE });
    expect(res).toMatchObject({ sent: 3, failed: 0, skipped: 0 });
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.key === "class.meeting_summary")).toBe(true);

    const byTo = new Map(calls.map((c) => [c.to, c.vars]));
    const present = byTo.get("ms-send-l1@e.com")!;
    const absent = byTo.get("ms-send-l2@e.com")!;
    expect(String(present.makeupText)).toBe("");
    expect(String(absent.makeupText)).toContain("Em vắng buổi này, bài cần học bù");
    expect(String(absent.makeupText)).toContain("Từ vựng 1");
    expect(String(byTo.get("ms-send-l3@e.com")!.makeupText)).toContain("Em vắng buổi này");
    expect(String(present.unsubscribeUrl)).toContain("/api/class-email/unsubscribe?token=");

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.MeetingSummarySent } });
    expect(ev.payload).toMatchObject({ meetingId: s.meetings[0]!.id, sent: 3, failed: 0 });
    expect(JSON.stringify(ev.payload)).not.toContain("@e.com");
  });

  it("idempotent: gửi lại không gửi trùng; người lỗi được gửi lại ở lần sau, người đã nhận thì không", async () => {
    const s = await setup("idem");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    const bad = recorder(new Set(["ms-idem-l2@e.com"]));
    const first = await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer: bad.mailer, baseUrl: BASE });
    expect(first).toMatchObject({ sent: 2, failed: 1 });
    expect(bad.calls).toHaveLength(3);

    const ok = recorder();
    const second = await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer: ok.mailer, baseUrl: BASE });
    expect(second).toMatchObject({ sent: 1, failed: 0 });
    expect(ok.calls.map((c) => c.to)).toEqual(["ms-idem-l2@e.com"]);

    const third = await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer: ok.mailer, baseUrl: BASE });
    expect(third).toMatchObject({ sent: 0, failed: 0 });
    expect(ok.calls).toHaveLength(1);
    expect(await prisma.meetingSummaryDelivery.count({ where: { meetingId: s.meetings[0]!.id, status: "sent" } })).toBe(3);
    const failedRow = await prisma.meetingSummaryDelivery.findUniqueOrThrow({ where: { meetingId_userId: { meetingId: s.meetings[0]!.id, userId: s.learners[1]! } } });
    expect(failedRow.attempts).toBe(2);
  });

  it("học viên đã tắt email thì bỏ qua (vẫn xem trong app); học viên đã rời lớp không nhận", async () => {
    const s = await setup("optout");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    await setClassEmailOptOut(s.learners[0]!, true);
    await prisma.enrollment.updateMany({ where: { userId: s.learners[2]!, sectionId: s.sectionId }, data: { status: "dropped" } });
    const { mailer, calls } = recorder();
    const res = await sendMeetingSummary(s.teacher, s.meetings[0]!.id, { mailer, baseUrl: BASE });
    expect(res).toMatchObject({ sent: 1, skipped: 1 });
    expect(calls.map((c) => c.to)).toEqual(["ms-optout-l2@e.com"]);

    const mine = await getMyMeetingSummaries(s.learners[0]!, 10);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ meetingId: s.meetings[0]!.id, seq: 1, planTitle: "Buổi 1: Chủ đề 1" });
  });

  it("giáo viên không được xếp (người lạ) không gửi được; hệ thống (actor null) gửi được", async () => {
    const s = await setup("authz");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    const stranger = await makeUser("ms-authz-x@e.com", ["instructor"]);
    const { mailer } = recorder();
    await expect(sendMeetingSummary(stranger, s.meetings[0]!.id, { mailer, baseUrl: BASE })).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(sendMeetingSummary(null, s.meetings[0]!.id, { mailer, baseUrl: BASE })).resolves.toMatchObject({ sent: 3 });
  });
});

describe("tổng kết hiện trong app (C4.4) và chỉ của lớp mình", () => {
  it("getMyMeetingSummaries chỉ trả buổi đã đóng của lớp mình đang học", async () => {
    const s = await setup("mine");
    const other = await setup("mine-other");
    await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    await closeMeeting(other.teacher, other.meetings[0]!.id, AFTER_M1);
    const mine = await getMyMeetingSummaries(s.learners[0]!, 10);
    expect(mine.map((m) => m.meetingId)).toEqual([s.meetings[0]!.id]);
    expect(await getMyMeetingSummaries(other.teacher, 10)).toEqual([]);
  });
});

describe("tự gửi tổng kết theo lớp, huỷ nhận email (C4.4, C4.19)", () => {
  it("mặc định bật; chỉ người quản tắt/bật được; đóng buổi báo autoSend theo cài đặt", async () => {
    const s = await setup("auto");
    expect((await prisma.courseSection.findUniqueOrThrow({ where: { id: s.sectionId } })).autoSendSummary).toBe(true);
    await setSectionAutoSendSummary(s.teacher, s.sectionId, false);
    const res = await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
    expect(res.autoSend).toBe(false);
    const stranger = await makeUser("ms-auto-x@e.com", ["instructor"]);
    await expect(setSectionAutoSendSummary(stranger, s.sectionId, true)).rejects.toBeInstanceOf(CourseAuthzError);
  });

  it("mã huỷ nhận email: đọc lại đúng người, sai chữ ký hoặc bị sửa thì bị từ chối", () => {
    const t = classMailUnsubscribeToken("user-1");
    expect(verifyClassMailUnsubscribeToken(t)).toBe("user-1");
    expect(verifyClassMailUnsubscribeToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(verifyClassMailUnsubscribeToken(t.replace("user-1", "user-2"))).toBeNull();
    expect(verifyClassMailUnsubscribeToken("rác")).toBeNull();
  });
});

describe("buildSummaryVars — biến cho email", () => {
  it("escape chữ giảng viên trong phần HTML, và bản text không có thẻ", () => {
    const vars = buildSummaryVars(
      {
        version: 1, meetingId: "m", sectionName: "Lớp A", courseTitle: "Khoá", seq: 1, startsAt: "2026-11-03T11:30:00.000Z",
        planTitle: "Buổi 1 <b>x</b>", lessons: [{ id: "l", title: "Bài <script>" }], vocab: [], homework: [], next: null,
      },
      { learnerName: "Lan", absent: false, appUrl: "http://x", unsubscribeUrl: "http://x/u" },
    );
    expect(String(vars.learnedHtml)).not.toContain("<script>");
    expect(String(vars.learnedHtml)).toContain("&lt;script&gt;");
    expect(String(vars.learnedText)).toContain("Bài <script>");
    expect(String(vars.nextText)).toContain("chưa có buổi tiếp theo");
  });
});
