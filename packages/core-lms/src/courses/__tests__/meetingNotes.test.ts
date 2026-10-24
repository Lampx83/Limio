import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  MeetingNoteError,
  approveMeetingNote,
  authorizeMeetingNotes,
  createNoteCorrection,
  listMeetingNotes,
  listMyMeetingNotes,
  saveMeetingNote,
  sendApprovedNotes,
  unapproveMeetingNote,
  updateMeetingNote,
} from "../meetingNotes";
import { closeMeeting, setClassEmailOptOut, type SummaryMailer } from "../meetingSummary";
import { markAttendance } from "../attendance";
import { CourseAuthzError } from "../authz";
import { AFTER_M1, BASE, makeUser, setup, type Setup } from "./meetingFixture";

/** Buổi 1 đã đóng: học viên 1 có mặt, 2 đến muộn, 3 vắng. */
async function closedMeeting(tag: string): Promise<Setup & { meetingId: string }> {
  const s = await setup(tag);
  await markAttendance(s.teacher, s.meetings[0]!.id, { entries: [
    { userId: s.learners[0]!, status: "present" },
    { userId: s.learners[1]!, status: "late" },
    { userId: s.learners[2]!, status: "absent" },
  ] }, prisma, AFTER_M1);
  await closeMeeting(s.teacher, s.meetings[0]!.id, AFTER_M1);
  return { ...s, meetingId: s.meetings[0]!.id };
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

describe("danh sách nhận xét sau buổi (C4.6, C4.12)", () => {
  it("chỉ mở khi buổi đã đóng; liệt kê học viên có mặt/muộn cần nhận xét, người vắng ở nhóm riêng", async () => {
    const s = await setup("list");
    await expect(listMeetingNotes(s.teacher, s.meetings[0]!.id)).rejects.toMatchObject({ code: "not_closed" });

    const c = await closedMeeting("list2");
    const view = await listMeetingNotes(c.teacher, c.meetingId);
    expect(view.meeting).toMatchObject({ id: c.meetingId, seq: 1 });
    const byUser = new Map(view.rows.map((r) => [r.userId, r]));
    expect(byUser.get(c.learners[0]!)).toMatchObject({ kind: "note", attendance: "present", note: null });
    expect(byUser.get(c.learners[1]!)).toMatchObject({ kind: "note", attendance: "late" });
    expect(byUser.get(c.learners[2]!)).toMatchObject({ kind: "absent", attendance: "absent" });
    expect(view.counts).toMatchObject({ draft: 0, approved: 0, sent: 0 });
  });

  it("người không được xếp vào buổi không xem được", async () => {
    const c = await closedMeeting("list-authz");
    const stranger = await makeUser("mn-list-authz-x@e.com", ["instructor"]);
    await expect(listMeetingNotes(stranger, c.meetingId)).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(authorizeMeetingNotes(stranger, c.meetingId)).rejects.toBeInstanceOf(CourseAuthzError);
  });
});

describe("soạn, sửa, duyệt (C4.6, C4.9, C4.10)", () => {
  it("giáo viên tự viết một bản nháp; duyệt thì thành approved; sửa chữ sau khi duyệt thì quay về nháp", async () => {
    const c = await closedMeeting("edit");
    const n = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "Em làm tốt phần chào hỏi." });
    expect(n).toMatchObject({ status: "draft", source: "manual", body: "Em làm tốt phần chào hỏi." });

    const approved = await approveMeetingNote(c.teacher, n.id);
    expect(approved).toMatchObject({ status: "approved", approvedById: c.teacher });
    expect(approved.approvedAt).not.toBeNull();

    const edited = await updateMeetingNote(c.teacher, n.id, { body: "Em làm tốt phần chào hỏi, cần ôn bổ ngữ." });
    expect(edited).toMatchObject({ status: "draft", approvedAt: null });
    await unapproveMeetingNote(c.teacher, n.id).catch(() => undefined); // đã là nháp: không lỗi nặng
  });

  it("bản trống không duyệt được; một học viên chỉ có một bản đang mở", async () => {
    const c = await closedMeeting("empty");
    await expect(saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "   " })).rejects.toMatchObject({ code: "validation_failed" });
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    const b = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "B" });
    expect(b.id).toBe(a.id);
    expect(await prisma.meetingStudentNote.count({ where: { meetingId: c.meetingId, userId: c.learners[0]! } })).toBe(1);
    await prisma.meetingStudentNote.update({ where: { id: a.id }, data: { body: "" } });
    await expect(approveMeetingNote(c.teacher, a.id)).rejects.toMatchObject({ code: "empty_body" });
  });

  it("chỉ học viên trong lớp mới có nhận xét; nhận xét độ dài quá giới hạn bị từ chối", async () => {
    const c = await closedMeeting("roster");
    const outsider = await makeUser("mn-roster-out@e.com");
    await expect(saveMeetingNote(c.teacher, c.meetingId, outsider, { body: "x" })).rejects.toMatchObject({ code: "not_in_roster" });
    await expect(saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "a".repeat(4001) })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("học viên vắng: không có bản nháp tự động, giáo viên vẫn thêm lời nhắn tay được", async () => {
    const c = await closedMeeting("absent");
    const n = await saveMeetingNote(c.teacher, c.meetingId, c.learners[2]!, { body: "Em nhớ xem lại bài Từ vựng 1 nhé." });
    expect(n).toMatchObject({ source: "manual", status: "draft" });
  });
});

describe("sendApprovedNotes — chỉ gửi bản đã duyệt (C4.10, C4.11, C4.17, C4.18)", () => {
  it("gửi bản approved, bản nháp không bao giờ gửi; bản đã gửi không sửa được", async () => {
    const c = await closedMeeting("send");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "Em đã làm tốt bài chào hỏi." });
    const b = await saveMeetingNote(c.teacher, c.meetingId, c.learners[1]!, { body: "Em cần ôn bổ ngữ kết quả." });
    await approveMeetingNote(c.teacher, a.id);

    const { mailer, calls } = recorder();
    const res = await sendApprovedNotes(c.teacher, c.meetingId, { mailer, baseUrl: BASE });
    expect(res).toMatchObject({ sent: 1, failed: 0, skipped: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: "ms-send-l1@e.com", key: "class.student_note" });
    expect(String(calls[0]!.vars.noteText)).toBe("Em đã làm tốt bài chào hỏi.");
    expect(String(calls[0]!.vars.correctionLabel)).toBe("");

    const rows = await prisma.meetingStudentNote.findMany({ where: { meetingId: c.meetingId }, orderBy: { draftedAt: "asc" } });
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ status: "sent" });
    expect(rows.find((r) => r.id === b.id)).toMatchObject({ status: "draft", sentAt: null });

    await expect(updateMeetingNote(c.teacher, a.id, { body: "đổi" })).rejects.toMatchObject({ code: "already_sent" });
    await expect(approveMeetingNote(c.teacher, a.id)).rejects.toMatchObject({ code: "already_sent" });

    // gửi lại: không gửi trùng
    const again = await sendApprovedNotes(c.teacher, c.meetingId, { mailer, baseUrl: BASE });
    expect(again.sent).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("phát meeting.note.sent mang id và độ dài, không mang chữ nhận xét hay email", async () => {
    const c = await closedMeeting("event");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "Nội dung riêng tư của học viên." });
    await approveMeetingNote(c.teacher, a.id);
    await sendApprovedNotes(c.teacher, c.meetingId, { mailer: recorder().mailer, baseUrl: BASE });
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.MeetingNoteSent } });
    expect(ev.userId).toBe(c.teacher);
    expect(ev.payload).toMatchObject({ meetingId: c.meetingId, noteId: a.id, learnerId: c.learners[0]!, bodyLength: 31, correction: false });
    const raw = JSON.stringify(ev.payload);
    expect(raw).not.toContain("riêng tư");
    expect(raw).not.toContain("@e.com");
  });

  it("một email lỗi không chặn các email khác; bản lỗi ở lại approved kèm lý do và gửi lại được", async () => {
    const c = await closedMeeting("fail");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    const b = await saveMeetingNote(c.teacher, c.meetingId, c.learners[1]!, { body: "B" });
    await approveMeetingNote(c.teacher, a.id);
    await approveMeetingNote(c.teacher, b.id);

    const bad = recorder(new Set(["ms-fail-l1@e.com"]));
    const first = await sendApprovedNotes(c.teacher, c.meetingId, { mailer: bad.mailer, baseUrl: BASE });
    expect(first).toMatchObject({ sent: 1, failed: 1 });
    const failed = await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: a.id } });
    expect(failed).toMatchObject({ status: "approved", sentAt: null, sendAttempts: 1 });
    expect(failed.sendError).toContain("provider_down");

    const view = await listMeetingNotes(c.teacher, c.meetingId);
    expect(view.counts.failed).toBe(1);

    const ok = recorder();
    const second = await sendApprovedNotes(c.teacher, c.meetingId, { mailer: ok.mailer, baseUrl: BASE });
    expect(second).toMatchObject({ sent: 1, failed: 0 });
    expect(ok.calls.map((x) => x.to)).toEqual(["ms-fail-l1@e.com"]);
    expect((await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: a.id } })).sendError).toBeNull();
  });

  it("học viên tắt email: nhận xét vẫn ghi là đã gửi (đọc trong app) nhưng không có email", async () => {
    const c = await closedMeeting("optout");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    await approveMeetingNote(c.teacher, a.id);
    await setClassEmailOptOut(c.learners[0]!, true);
    const { mailer, calls } = recorder();
    const res = await sendApprovedNotes(c.teacher, c.meetingId, { mailer, baseUrl: BASE });
    expect(res).toMatchObject({ sent: 0, skipped: 1 });
    expect(calls).toHaveLength(0);
    expect(await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "sent", sendError: "email_optout" });
    expect(await listMyMeetingNotes(c.learners[0]!, 10)).toHaveLength(1);
  });

  it("hook afterSent được gọi sau khi gửi và id FeedbackDelivery được lưu; hook lỗi không làm mất bản đã gửi", async () => {
    const c = await closedMeeting("hook");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    const b = await saveMeetingNote(c.teacher, c.meetingId, c.learners[1]!, { body: "B" });
    await approveMeetingNote(c.teacher, a.id);
    await approveMeetingNote(c.teacher, b.id);
    const seen: string[] = [];
    await sendApprovedNotes(c.teacher, c.meetingId, {
      mailer: recorder().mailer,
      baseUrl: BASE,
      afterSent: async (note) => {
        seen.push(note.id);
        if (note.id === b.id) throw new Error("boom");
        return "delivery-1";
      },
    });
    expect(seen.sort()).toEqual([a.id, b.id].sort());
    expect((await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: a.id } })).feedbackDeliveryId).toBe("delivery-1");
    expect(await prisma.meetingStudentNote.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ status: "sent", feedbackDeliveryId: null });
  });

  it("hệ thống (actor null) gửi được; người lạ thì không", async () => {
    const c = await closedMeeting("sys");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    await approveMeetingNote(c.teacher, a.id);
    const stranger = await makeUser("mn-sys-x@e.com", ["instructor"]);
    await expect(sendApprovedNotes(stranger, c.meetingId, { mailer: recorder().mailer, baseUrl: BASE })).rejects.toBeInstanceOf(CourseAuthzError);
    await expect(sendApprovedNotes(null, c.meetingId, { mailer: recorder().mailer, baseUrl: BASE })).resolves.toMatchObject({ sent: 1 });
  });
});

describe("đính chính (C4.11)", () => {
  it("bản đã gửi muốn sửa thì tạo bản đính chính mới, gửi kèm nhãn 'Đính chính'", async () => {
    const c = await closedMeeting("corr");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "Em làm đúng cả 5 câu." });
    await approveMeetingNote(c.teacher, a.id);
    await sendApprovedNotes(c.teacher, c.meetingId, { mailer: recorder().mailer, baseUrl: BASE });

    await expect(createNoteCorrection(c.teacher, "no-such")).rejects.toMatchObject({ code: "note_not_found" });
    const corr = await createNoteCorrection(c.teacher, a.id);
    expect(corr).toMatchObject({ status: "draft", correctionOfId: a.id, body: "Em làm đúng cả 5 câu." });
    // chỉ một đính chính đang mở cho mỗi bản
    expect((await createNoteCorrection(c.teacher, a.id)).id).toBe(corr.id);

    await updateMeetingNote(c.teacher, corr.id, { body: "Em làm đúng 4/5 câu, câu 3 cần sửa." });
    await approveMeetingNote(c.teacher, corr.id);
    const { mailer, calls } = recorder();
    await sendApprovedNotes(c.teacher, c.meetingId, { mailer, baseUrl: BASE });
    expect(calls).toHaveLength(1);
    expect(String(calls[0]!.vars.correctionLabel)).toBe("Đính chính: ");
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.MeetingNoteSent }, orderBy: { id: "desc" }, take: 1 });
    expect(ev[0]!.payload).toMatchObject({ correction: true });
  });

  it("chưa gửi thì không đính chính được", async () => {
    const c = await closedMeeting("corr-unsent");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "A" });
    await expect(createNoteCorrection(c.teacher, a.id)).rejects.toMatchObject({ code: "not_sent" });
  });
});

describe("học viên đọc nhận xét của mình (C4.16)", () => {
  it("chỉ thấy bản đã gửi của chính mình, kèm bản đính chính; không thấy nháp hay của người khác", async () => {
    const c = await closedMeeting("mine");
    const a = await saveMeetingNote(c.teacher, c.meetingId, c.learners[0]!, { body: "Nhận xét cho em 1." });
    const b = await saveMeetingNote(c.teacher, c.meetingId, c.learners[1]!, { body: "Nhận xét cho em 2." });
    await approveMeetingNote(c.teacher, a.id);
    await sendApprovedNotes(c.teacher, c.meetingId, { mailer: recorder().mailer, baseUrl: BASE });

    const m1 = await listMyMeetingNotes(c.learners[0]!, 10);
    expect(m1).toHaveLength(1);
    expect(m1[0]).toMatchObject({ noteId: a.id, body: "Nhận xét cho em 1.", seq: 1, correction: false });
    expect(JSON.stringify(m1)).not.toContain("em 2");
    expect(await listMyMeetingNotes(c.learners[1]!, 10)).toEqual([]); // b còn là nháp
    expect(b.status).toBe("draft");
    expect(Object.keys(m1[0]!)).not.toContain("facts");
    expect(Object.keys(m1[0]!)).not.toContain("teacherHint");
  });
});

it("MeetingNoteError là lỗi có mã", () => {
  expect(new MeetingNoteError("not_closed").code).toBe("not_closed");
});
