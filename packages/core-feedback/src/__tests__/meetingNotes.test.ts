import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { prisma } from "@feedbackme/db";
import { LearningEventType, lessonSkillCode } from "@feedbackme/shared-types";
import {
  MeetingNoteDraftError,
  composeRuleNote,
  draftAllMeetingNotes,
  draftMeetingNote,
  gatherMeetingNoteFacts,
  recordMeetingNoteDelivery,
  type MeetingNoteFacts,
} from "../meetingNotes";
import { chargeTokens, getTokenBudget } from "../aiTutor/tokenWallet";

/**
 * CENTER C4b — soạn nhận xét sau buổi. Dữ liệu chỉ của chính học viên (C4.7), chỗ không có dữ liệu thì bỏ trống
 * (C4.8), ghi chú giáo viên được giữ nguyên (C4.9), AI lỗi hoặc hết hạn mức thì dùng mẫu (C4.13), mỗi bản đã gửi
 * có toạ độ SSMMD (C4.15). Mô hình luôn là bản giả; không bao giờ gọi mô hình thật.
 */

let seq = 0;
const uid = () => `${Date.now()}-${++seq}`;

async function user(name: string) {
  const u = await prisma.user.create({ data: { email: `mn-${name}-${uid()}@e.com`, passwordHash: "x", displayName: name } });
  return u.id;
}

interface Fx {
  teacher: string;
  courseId: string;
  sectionId: string;
  meetingId: string;
  lessons: Array<{ id: string; title: string }>;
  assignmentId: string;
  a: string; // học viên có mặt, có dữ liệu
  b: string; // học viên đến muộn, không dữ liệu gì
  c: string; // học viên vắng
}

async function fx(): Promise<Fx> {
  const teacher = await user("Cô Hoa");
  const course = await prisma.course.create({
    data: { title: "Tiếng Trung", slug: `mn-${uid()}`, description: "d", personalizationEnabled: true },
  });
  const mod = await prisma.module.create({ data: { courseId: course.id, title: "Buổi 1: Xin chào", orderIndex: 0, sessionNo: 1 } });
  const lessons: Fx["lessons"] = [];
  for (const [i, title] of ["Từ vựng — Xin chào", "Hội thoại — Làm quen"].entries()) {
    const l = await prisma.lesson.create({ data: { moduleId: mod.id, title, orderIndex: i } });
    lessons.push({ id: l.id, title });
    await prisma.skill.create({ data: { code: lessonSkillCode(l.id), name: title } });
  }
  const assignment = await prisma.assignment.create({
    data: { lessonId: lessons[0]!.id, title: "Viết 5 câu chào hỏi", description: "d", dueAt: new Date("2026-11-08T16:59:00.000Z"), maxScore: 10 },
  });
  const section = await prisma.courseSection.create({ data: { courseId: course.id, name: "Lớp A", isDefault: false } });
  const meeting = await prisma.classMeeting.create({
    data: {
      sectionId: section.id,
      seq: 1,
      startsAt: new Date("2026-11-03T11:30:00.000Z"),
      endsAt: new Date("2026-11-03T13:30:00.000Z"),
      status: "held",
      closedAt: new Date("2026-11-03T14:00:00.000Z"),
      closedById: teacher,
    },
  });
  const [a, b, c] = [await user("An"), await user("Bình"), await user("Chi")];
  for (const [u, st] of [[a, "present"], [b, "late"], [c, "absent"]] as const) {
    await prisma.enrollment.create({ data: { userId: u, courseId: course.id, sectionId: section.id, courseVersion: 1 } });
    await prisma.studentAttendance.create({ data: { meetingId: meeting.id, userId: u, status: st } });
  }
  return { teacher, courseId: course.id, sectionId: section.id, meetingId: meeting.id, lessons, assignmentId: assignment.id, a, b, c };
}

async function setMastery(userId: string, lessonId: string, p: number) {
  const skill = await prisma.skill.findUniqueOrThrow({ where: { code: lessonSkillCode(lessonId) } });
  await prisma.learnerSkillState.create({ data: { userId, skillId: skill.id, masteryProbability: p, attempts: 4, correctCount: 3 } });
}

function fakeOpenAI(content: unknown, usage = { prompt_tokens: 500, completion_tokens: 200 }) {
  const calls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const client = {
    chat: {
      completions: {
        create: async (args: { messages: Array<{ role: string; content: string }> }) => {
          calls.push(args);
          return { choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }], usage };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}
const neverCall = (): OpenAI => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;
const brokenAI = (): OpenAI => ({ chat: { completions: { create: async () => { throw new Error("provider down"); } } } }) as unknown as OpenAI;

describe("gatherMeetingNoteFacts — chỉ dữ liệu của chính học viên (C4.7)", () => {
  it("gồm điểm danh, nhãn mức thành thạo theo bài của buổi, kết quả bài tập; không có người khác", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[0]!.id, 0.92);
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    await setMastery(f.b, f.lessons[0]!.id, 0.1); // dữ liệu của người khác, không được lẫn vào
    await prisma.assignmentSubmission.create({ data: { assignmentId: f.assignmentId, userId: f.a, body: "x", status: "graded", score: 8 } });
    await prisma.assignmentSubmission.create({ data: { assignmentId: f.assignmentId, userId: f.b, body: "y", status: "submitted" } });

    const facts = await gatherMeetingNoteFacts(f.meetingId, f.a);
    expect(facts).toMatchObject({ meetingId: f.meetingId, seq: 1, planTitle: "Buổi 1: Xin chào", attendance: "present", learnerName: "An" });
    expect(facts.lessons.map((l) => [l.title, l.label])).toEqual([
      ["Từ vựng — Xin chào", "solid"],
      ["Hội thoại — Làm quen", "needs_review"],
    ]);
    expect(facts.homework).toEqual([
      expect.objectContaining({ title: "Viết 5 câu chào hỏi", state: "graded", score: 8, maxScore: 10 }),
    ]);
    expect(JSON.stringify(facts)).not.toContain("Bình");

    const fb = await gatherMeetingNoteFacts(f.meetingId, f.b);
    expect(fb.attendance).toBe("late");
    expect(fb.homework[0]).toMatchObject({ state: "submitted", score: null });
    expect(fb.lessons.map((l) => l.label)).toEqual(["needs_review", "no_data"]);
  });

  it("bài tập ẩn không có; bài ẩn không có; học viên chưa nộp thì not_submitted", async () => {
    const f = await fx();
    const facts0 = await gatherMeetingNoteFacts(f.meetingId, f.c);
    expect(facts0.homework[0]).toMatchObject({ state: "not_submitted", score: null });
    await prisma.assignment.update({ where: { id: f.assignmentId }, data: { isHidden: true } });
    await prisma.lesson.update({ where: { id: f.lessons[1]!.id }, data: { isHidden: true } });
    const facts = await gatherMeetingNoteFacts(f.meetingId, f.a);
    expect(facts.homework).toEqual([]);
    expect(facts.lessons.map((l) => l.title)).toEqual(["Từ vựng — Xin chào"]);
  });
});

describe("composeRuleNote — mẫu có sẵn, không bịa (C4.8, C4.14)", () => {
  const base: MeetingNoteFacts = {
    version: 1, meetingId: "m", seq: 1, planTitle: "Buổi 1: Xin chào", attendance: "present", learnerName: "An",
    lessons: [
      { id: "l1", title: "Từ vựng — Xin chào", label: "solid" },
      { id: "l2", title: "Hội thoại — Làm quen", label: "needs_review" },
      { id: "l3", title: "Ngữ âm", label: "practice_more" },
      { id: "l4", title: "Chưa làm", label: "no_data" },
    ],
    homework: [{ assignmentId: "a", title: "Viết 5 câu", dueAt: "2026-11-08T16:59:00.000Z", state: "graded", score: 8, maxScore: 10 }],
  };

  it("nói về nhiệm vụ và quá trình bằng nhãn, không có phần trăm; bỏ chỗ không có dữ liệu", () => {
    const r = composeRuleNote(base);
    expect(r.body).toContain("Từ vựng — Xin chào");
    expect(r.body).toMatch(/nắm chắc/);
    expect(r.body).toMatch(/cần ôn lại/);
    expect(r.body).toMatch(/nên luyện thêm/);
    expect(r.body).toContain("8/10");
    expect(r.body).not.toContain("Chưa làm");
    expect(r.body).not.toMatch(/%/);
    expect(r.usedMastery).toBe(true);
    expect(r.remediationLessonIds).toEqual(["l2", "l3"]);
  });

  it("đến muộn thì nhắc xem lại phần đầu; chưa nộp bài thì nêu hạn; đã nộp chưa chấm thì nói sẽ chấm", () => {
    const r = composeRuleNote({
      ...base, attendance: "late", lessons: [{ id: "l1", title: "Từ vựng — Xin chào", label: "no_data" }],
      homework: [
        { assignmentId: "a", title: "Bài A", dueAt: "2026-11-08T16:59:00.000Z", state: "not_submitted", score: null, maxScore: 10 },
        { assignmentId: "b", title: "Bài B", dueAt: null, state: "submitted", score: null, maxScore: 10 },
      ],
    });
    expect(r.body).toMatch(/đến muộn/);
    expect(r.body).toContain("Từ vựng — Xin chào");
    expect(r.body).toMatch(/chưa nộp/);
    expect(r.body).toContain("08/11");
    expect(r.body).toMatch(/đã nộp/);
  });

  it("không có dữ liệu gì thì bản nháp trống; ghi chú của giáo viên luôn được giữ nguyên chữ", () => {
    const empty = composeRuleNote({ ...base, lessons: [{ id: "l", title: "x", label: "no_data" }], homework: [] });
    expect(empty.body).toBe("");
    const withHint = composeRuleNote({ ...base, lessons: [], homework: [] }, "Em phát biểu rất tự tin");
    expect(withHint.body).toContain("Em phát biểu rất tự tin");
    expect(composeRuleNote(base, "Em phát âm thanh điệu 3 tốt").body).toContain("Em phát âm thanh điệu 3 tốt");
  });
});

describe("draftMeetingNote — bản nháp theo mẫu (C4.6, C4.8, C4.12)", () => {
  it("không có mô hình: soạn theo mẫu, lưu nháp, phát meeting.note.drafted không mang chữ", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const r = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a });
    expect(r).toMatchObject({ source: "rule_template", usedAi: false, fallbackReason: "no_ai", reused: false });
    expect(r.body).toContain("Hội thoại — Làm quen");
    const row = await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: r.noteId } });
    expect(row).toMatchObject({ status: "draft", source: "rule_template", userId: f.a, draftedById: f.teacher });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.MeetingNoteDrafted } });
    expect(ev.userId).toBe(f.teacher);
    expect(ev.payload).toMatchObject({ meetingId: f.meetingId, noteId: r.noteId, source: "rule_template", bodyLength: r.body.length });
    expect(JSON.stringify(ev.payload)).not.toContain("Hội thoại");
  });

  it("học viên vắng, chưa điểm danh hoặc ngoài lớp: không soạn (vắng nhận email chung)", async () => {
    const f = await fx();
    await expect(draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.c, openai: neverCall() })).rejects.toMatchObject({ code: "absent_student" });
    const unmarked = await user("Dũng");
    const e = await prisma.enrollment.create({ data: { userId: unmarked, courseId: f.courseId, sectionId: f.sectionId, courseVersion: 1 } });
    expect(e.id).toBeTruthy();
    await expect(draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: unmarked })).rejects.toMatchObject({ code: "attendance_required" });
    const outsider = await user("Ngoài");
    await expect(draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: outsider })).rejects.toMatchObject({ code: "not_in_roster" });
    expect(new MeetingNoteDraftError("absent_student").code).toBe("absent_student");
  });

  it("buổi chưa đóng thì không soạn", async () => {
    const f = await fx();
    await prisma.classMeeting.update({ where: { id: f.meetingId }, data: { closedAt: null } });
    await expect(draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a })).rejects.toMatchObject({ code: "not_closed" });
  });

  it("đã có bản đang mở thì giữ nguyên (không ghi đè chữ giáo viên đã sửa) trừ khi yêu cầu soạn lại", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const first = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a });
    await prisma.meetingStudentNote.update({ where: { id: first.noteId }, data: { body: "Chữ giáo viên đã sửa", status: "approved", approvedAt: new Date() } });

    const again = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a });
    expect(again).toMatchObject({ noteId: first.noteId, reused: true, body: "Chữ giáo viên đã sửa" });

    const redo = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, regenerate: true, hint: "Em tiến bộ rõ" });
    expect(redo.noteId).toBe(first.noteId);
    expect(redo.reused).toBe(false);
    expect(redo.body).toContain("Em tiến bộ rõ");
    expect(await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: first.noteId } })).toMatchObject({ status: "draft", approvedAt: null, teacherHint: "Em tiến bộ rõ" });
  });

  it("đã có bản đã gửi và không có bản mở: không soạn mới (dùng đính chính)", async () => {
    const f = await fx();
    await prisma.meetingStudentNote.create({ data: { meetingId: f.meetingId, userId: f.a, body: "x", source: "manual", status: "sent", sentAt: new Date() } });
    await expect(draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a })).rejects.toMatchObject({ code: "already_sent" });
  });
});

describe("draftMeetingNote — có mô hình (C4.9, C4.13)", () => {
  it("soạn bằng AI: lời nhắc chỉ có dữ kiện của học viên đó; ghi chú giáo viên được giữ nguyên; trừ token của giáo viên", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const before = await getTokenBudget(f.teacher);
    const { client, calls } = fakeOpenAI({ body: "Em làm đúng phần chào hỏi, cần ôn lại hội thoại làm quen. Em phát biểu rất tự tin." });
    const r = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, hint: "Em phát biểu rất tự tin", openai: client });
    expect(r).toMatchObject({ source: "llm", usedAi: true });
    expect(r.body).toContain("Em phát biểu rất tự tin");

    const prompt = calls[0]!.messages.map((m) => m.content).join("\n");
    expect(prompt).toContain("Hội thoại — Làm quen");
    expect(prompt).toContain("Em phát biểu rất tự tin");
    expect(prompt).not.toContain("Bình");
    expect(prompt).not.toContain("Chi");
    expect(prompt).not.toMatch(/0\.3|30%/); // không đưa số mastery thô cho mô hình
    const after = await getTokenBudget(f.teacher);
    expect(after.total).toBe(before.total - 700);
  });

  it("mô hình quên ghi chú của giáo viên thì nối nguyên văn vào cuối", async () => {
    const f = await fx();
    const { client } = fakeOpenAI({ body: "Em làm tốt bài chào hỏi." });
    const r = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, hint: "Nhớ mang vở lần sau", openai: client });
    expect(r.body).toContain("Em làm tốt bài chào hỏi.");
    expect(r.body).toContain("Nhớ mang vở lần sau");
  });

  it("AI lỗi → mẫu có sẵn, luồng không bị chặn; hết hạn mức token → mẫu và KHÔNG gọi mô hình", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const err = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, openai: brokenAI() });
    expect(err).toMatchObject({ source: "rule_template", usedAi: false, fallbackReason: "ai_error" });
    expect(err.body).toContain("Hội thoại — Làm quen");

    const g = await fx();
    await setMastery(g.a, g.lessons[1]!.id, 0.3);
    const budget = await getTokenBudget(g.teacher);
    await chargeTokens(g.teacher, budget.total + 1_000_000, null);
    const none = await draftMeetingNote({ actorUserId: g.teacher, meetingId: g.meetingId, userId: g.a, openai: neverCall() });
    expect(none).toMatchObject({ source: "rule_template", usedAi: false, fallbackReason: "no_budget" });
  });

  it("đầu ra rỗng hoặc có phần trăm thì bỏ, dùng mẫu", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const empty = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, openai: fakeOpenAI({ body: "  " }).client });
    expect(empty).toMatchObject({ source: "rule_template", fallbackReason: "ai_error" });
    const g = await fx();
    await setMastery(g.a, g.lessons[1]!.id, 0.3);
    const pct = await draftMeetingNote({ actorUserId: g.teacher, meetingId: g.meetingId, userId: g.a, openai: fakeOpenAI({ body: "Em nắm 30% bài hội thoại." }).client });
    expect(pct).toMatchObject({ source: "rule_template", fallbackReason: "ai_error" });
    expect(pct.body).not.toMatch(/%/);
  });
});

describe("draftAllMeetingNotes — soạn cho cả lớp một lượt", () => {
  it("chỉ soạn cho người có mặt/muộn chưa có bản mở; bỏ qua vắng và chưa điểm danh; báo số lượng", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    await prisma.meetingStudentNote.create({ data: { meetingId: f.meetingId, userId: f.b, body: "Bản có sẵn", source: "manual" } });
    const res = await draftAllMeetingNotes({ actorUserId: f.teacher, meetingId: f.meetingId });
    expect(res).toMatchObject({ drafted: 1, kept: 1, skipped: 1 });
    expect(res.items.find((i) => i.userId === f.a)).toMatchObject({ status: "drafted" });
    expect(res.items.find((i) => i.userId === f.b)).toMatchObject({ status: "kept" });
    expect(await prisma.meetingStudentNote.count({ where: { meetingId: f.meetingId } })).toBe(2);
  });
});

describe("recordMeetingNoteDelivery — toạ độ SSMMD (C4.15)", () => {
  it("bản đã gửi tạo FeedbackDelivery mang level, levels, elaboration, sourceKind và ngữ cảnh; không bao giờ là 'self'", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[0]!.id, 0.92);
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const d = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a });
    await prisma.meetingStudentNote.update({ where: { id: d.noteId }, data: { status: "sent", sentAt: new Date() } });

    const id = await recordMeetingNoteDelivery(d.noteId);
    expect(id).toBeTruthy();
    const fd = await prisma.feedbackDelivery.findUniqueOrThrow({ where: { id: id! } });
    expect(fd).toMatchObject({ userId: f.a, level: "self_regulation", elaboration: "elaborated", sourceKind: "bkt_state" });
    expect(fd.levels).toEqual(["task", "process", "self_regulation"]);
    expect(fd.levels as string[]).not.toContain("self");
    expect(fd.remediationLessonIds).toEqual([f.lessons[1]!.id]);
    const ctx = fd.generationContext as Record<string, any>;
    expect(ctx).toMatchObject({ kind: "meeting_note", meetingId: f.meetingId, noteId: d.noteId, source: "rule_template", sectionId: f.sectionId });
    expect(ctx.masteryAtGeneration[lessonSkillCode(f.lessons[1]!.id)]).toBeCloseTo(0.3);
    expect(typeof ctx.coderVersion).toBe("string");
    expect(await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: d.noteId } })).toMatchObject({ feedbackDeliveryId: id });

    // idempotent
    expect(await recordMeetingNoteDelivery(d.noteId)).toBe(id);
    expect(await prisma.feedbackDelivery.count({ where: { userId: f.a } })).toBe(1);
  });

  it("bản chưa gửi thì không ghi; bản do AI soạn và giáo viên duyệt là 'hybrid'", async () => {
    const f = await fx();
    await setMastery(f.a, f.lessons[1]!.id, 0.3);
    const d = await draftMeetingNote({ actorUserId: f.teacher, meetingId: f.meetingId, userId: f.a, openai: fakeOpenAI({ body: "Em cần ôn lại hội thoại." }).client });
    expect(await recordMeetingNoteDelivery(d.noteId)).toBeNull();
    expect(await prisma.feedbackDelivery.count({ where: { userId: f.a } })).toBe(0);
    await prisma.meetingStudentNote.update({ where: { id: d.noteId }, data: { status: "sent", sentAt: new Date() } });
    const id = await recordMeetingNoteDelivery(d.noteId);
    expect((await prisma.feedbackDelivery.findUniqueOrThrow({ where: { id: id! } })).sourceKind).toBe("hybrid");
  });

  it("bản chỉ có ghi chú tay (manual): kr và mức task, nguồn rule_template", async () => {
    const f = await fx();
    const n = await prisma.meetingStudentNote.create({ data: { meetingId: f.meetingId, userId: f.c, body: "Em xem lại bài nhé.", source: "manual", status: "sent", sentAt: new Date() } });
    const id = await recordMeetingNoteDelivery(n.id);
    expect(await prisma.feedbackDelivery.findUniqueOrThrow({ where: { id: id! } })).toMatchObject({ level: "task", elaboration: "kr", sourceKind: "rule_template" });
  });
});
