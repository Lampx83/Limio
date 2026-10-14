import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createAssignment,
  gradeSubmission,
  listTeamSubmissionsForInstructor,
  overrideSubmissionScore,
  setSubmissionContributionNote,
  submitAssignment,
  updateAssignment,
} from "../assignments";
import { duplicateLesson } from "../lessons";
import { registerUser } from "../../auth/register";
import { deleteUser } from "../../auth/deleteUser";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson } from "../lessons";
import { enrollInCourse } from "../../learning/enroll";
import {
  createCourseTeam,
  instructorMoveTeamMember,
  joinCourseTeamByCode,
  leaveCourseTeam,
} from "../../teams/teams";

const BASE = "http://localhost:3000";

async function user(name: string) {
  const r = await registerUser(
    { email: `${name}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
  return r.userId;
}

/** Khoá có 1 bài tập nhóm, nhóm "A" gồm L0 (trưởng nhóm), L1, L2; L3 và L4 chưa có nhóm. */
async function setup(opts: { responseFormat?: "text" | "audio" } = {}) {
  const instId = await user("Inst");
  const c = await createCourse(instId, { title: "TA", description: "x" });
  const m = await createModule(instId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(instId, m.moduleId, { title: "L", orderIndex: 0 });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
  const L: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = await user(`L${i}`);
    await enrollInCourse(id, c.courseId);
    L.push(id);
  }
  const team = await createCourseTeam(L[0]!, c.courseId, "A");
  await joinCourseTeamByCode(L[1]!, c.courseId, team.joinCode);
  await joinCourseTeamByCode(L[2]!, c.courseId, team.joinCode);
  const a = await createAssignment(instId, l.lessonId, {
    title: "Giữa kỳ",
    description: "Nộp slide PDF",
    maxScore: 10,
    submissionMode: "team",
  });
  if (opts.responseFormat) {
    await prisma.assignment.update({ where: { id: a.assignmentId }, data: { responseFormat: opts.responseFormat } });
  }
  return { instId, courseId: c.courseId, lessonId: l.lessonId, L, teamId: team.teamId, joinCode: team.joinCode, assignmentId: a.assignmentId };
}

const rows = (assignmentId: string) =>
  prisma.assignmentSubmission.findMany({ where: { assignmentId }, orderBy: { userId: "asc" } });

const submitted = (s: { L: string[]; assignmentId: string }, i: number, body = "slide.pdf") =>
  submitAssignment(s.L[i]!, s.assignmentId, { body, attachmentUrl: "https://x.test/api/assignment-media/f1.pdf" });

describe("Bài tập nộp theo nhóm — C", () => {
  it("C1 — tạo bài tập ở chế độ nhóm; nhân bản bài học giữ nguyên chế độ", async () => {
    const s = await setup();
    const a = await prisma.assignment.findUniqueOrThrow({ where: { id: s.assignmentId } });
    expect(a.submissionMode).toBe("team");
    const dup = await duplicateLesson(s.instId, s.lessonId);
    const copied = await prisma.assignment.findFirstOrThrow({ where: { lessonId: dup.lessonId } });
    expect(copied.submissionMode).toBe("team");
  });

  it("C1 — đổi chế độ khi đã có bài nộp bị chặn; chưa có bài thì đổi được", async () => {
    const s = await setup();
    await updateAssignment(s.instId, s.assignmentId, { submissionMode: "individual" });
    await updateAssignment(s.instId, s.assignmentId, { submissionMode: "team" });
    await submitted(s, 1);
    await expect(updateAssignment(s.instId, s.assignmentId, { submissionMode: "individual" })).rejects.toMatchObject({
      code: "validation_failed",
      details: "submission_mode_locked",
    });
    // Sửa trường khác vẫn được
    await updateAssignment(s.instId, s.assignmentId, { title: "Giữa kỳ (sửa)" });
  });

  it("C2 — một người nộp, mọi thành viên có một dòng cùng nội dung, cùng mốc nộp nhóm; mỗi người một sự kiện", async () => {
    const s = await setup();
    const r = await submitted(s, 1);
    expect(r.teamId).toBe(s.teamId);
    const all = await rows(s.assignmentId);
    expect(all.map((x) => x.userId).sort()).toEqual([s.L[0], s.L[1], s.L[2]].sort());
    for (const x of all) {
      expect(x.body).toBe("slide.pdf");
      expect(x.teamId).toBe(s.teamId);
      expect(x.submittedById).toBe(s.L[1]);
      expect(x.teamSubmittedAt?.getTime()).toBe(all[0]!.teamSubmittedAt?.getTime());
    }
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.AssignmentSubmitted } });
    expect(ev).toHaveLength(3);
    expect(ev.every((e) => (e.payload as { teamId?: string }).teamId === s.teamId)).toBe(true);
  });

  it("C2 — tự đánh giá/suy ngẫm chỉ gắn vào dòng của người bấm nộp", async () => {
    const s = await setup();
    await submitAssignment(s.L[0]!, s.assignmentId, {
      body: "b",
      selfRating: 4,
      reflection: "Em đã làm phần soi trang Limio và phỏng vấn hai bạn.",
    });
    const all = await rows(s.assignmentId);
    const mine = all.find((x) => x.userId === s.L[0])!;
    const other = all.find((x) => x.userId === s.L[1])!;
    expect(mine.selfRating).toBe(4);
    expect(other.selfRating).toBeNull();
    expect(other.reflection).toBeNull();
  });

  it("C3 — chưa có nhóm thì không nộp được", async () => {
    const s = await setup();
    await expect(submitted(s, 3)).rejects.toMatchObject({ code: "no_team" });
    expect(await rows(s.assignmentId)).toHaveLength(0);
  });

  it("C5 — nộp lại thay bài cả nhóm và đưa cả nhóm về chưa chấm", async () => {
    const s = await setup();
    await submitted(s, 0, "v1");
    const first = (await rows(s.assignmentId))[0]!;
    await gradeSubmission(s.instId, first.id, { score: 8, feedback: "Tốt" });
    await submitted(s, 2, "v2");
    const all = await rows(s.assignmentId);
    expect(all).toHaveLength(3);
    for (const x of all) {
      expect(x.body).toBe("v2");
      expect(x.status).toBe("submitted");
      expect(x.score).toBeNull();
      expect(x.teamScore).toBeNull();
      expect(x.submittedById).toBe(s.L[2]);
    }
  });

  it("C6 — 'Phần việc của tôi': chỉ chủ dòng sửa được, không đưa bài về chưa chấm, có sự kiện", async () => {
    const s = await setup();
    await submitted(s, 0);
    const all = await rows(s.assignmentId);
    const l1Row = all.find((x) => x.userId === s.L[1])!;
    await gradeSubmission(s.instId, l1Row.id, { score: 9 });
    await setSubmissionContributionNote(s.L[1]!, l1Row.id, "Em vẽ 3 màn hình giấy.");
    await expect(setSubmissionContributionNote(s.L[2]!, l1Row.id, "sửa hộ")).rejects.toMatchObject({ code: "forbidden" });
    const after = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: l1Row.id } });
    expect(after.contributionNote).toBe("Em vẽ 3 màn hình giấy.");
    expect(after.status).toBe("graded");
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.AssignmentContributionNoted } });
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ length: "Em vẽ 3 màn hình giấy.".length });
    await expect(setSubmissionContributionNote(s.L[1]!, l1Row.id, "x".repeat(1001))).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("C7 — người rời nhóm giữ bài cũ; người mới vào không nhận bài cũ; nộp lại gồm cả người mới", async () => {
    const s = await setup();
    await submitted(s, 0, "v1");
    await leaveCourseTeam(s.L[2]!, s.courseId);
    await joinCourseTeamByCode(s.L[3]!, s.courseId, s.joinCode);
    let all = await rows(s.assignmentId);
    expect(all.map((x) => x.userId).sort()).toEqual([s.L[0], s.L[1], s.L[2]].sort());
    await submitted(s, 1, "v2");
    all = await rows(s.assignmentId);
    const byUser = new Map(all.map((x) => [x.userId, x]));
    expect(byUser.get(s.L[3]!)?.body).toBe("v2");
    expect(byUser.get(s.L[2]!)?.body).toBe("v1"); // người đã rời giữ bản cũ
    expect(byUser.get(s.L[2]!)?.teamSubmittedAt?.getTime()).not.toBe(byUser.get(s.L[0]!)?.teamSubmittedAt?.getTime());
  });

  it("C7 — người chuyển sang nhóm khác rồi nhóm mới nộp: dòng của người đó chuyển theo nhóm mới", async () => {
    const s = await setup();
    await submitted(s, 0, "A-v1");
    const b = await createCourseTeam(s.L[4]!, s.courseId, "B");
    await instructorMoveTeamMember(s.instId, s.courseId, s.L[2]!, b.teamId);
    await submitted(s, 4, "B-v1");
    const row = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { assignmentId_userId: { assignmentId: s.assignmentId, userId: s.L[2]! } },
    });
    expect(row.teamId).toBe(b.teamId);
    expect(row.body).toBe("B-v1");
  });
});

describe("Chấm bài nhóm — D", () => {
  it("D2 — chấm một lần áp cho cả nhóm; mỗi người một sự kiện; dòng của người đã rời không bị chấm đè", async () => {
    const s = await setup();
    await submitted(s, 0, "v1");
    await leaveCourseTeam(s.L[2]!, s.courseId);
    await submitted(s, 0, "v2");
    const current = (await rows(s.assignmentId)).find((x) => x.userId === s.L[1])!;
    await gradeSubmission(s.instId, current.id, { score: 7, feedback: "Ổn" });
    const all = await rows(s.assignmentId);
    const byUser = new Map(all.map((x) => [x.userId, x]));
    for (const u of [s.L[0]!, s.L[1]!]) {
      expect(byUser.get(u)).toMatchObject({ status: "graded", score: 7, teamScore: 7, feedback: "Ổn", graderId: s.instId });
    }
    expect(byUser.get(s.L[2]!)).toMatchObject({ status: "submitted", score: null, body: "v1" });
    const ev = await prisma.learningEvent.findMany({ where: { eventType: LearningEventType.AssignmentGraded } });
    expect(ev).toHaveLength(2);
  });

  it("D2 — điểm vượt điểm tối đa bị chặn", async () => {
    const s = await setup();
    await submitted(s, 0);
    const r = (await rows(s.assignmentId))[0]!;
    await expect(gradeSubmission(s.instId, r.id, { score: 11 })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("D3 — chỉnh riêng một người; chấm lại nhóm không ghi đè; bỏ chỉnh thì về điểm nhóm", async () => {
    const s = await setup();
    await submitted(s, 0);
    const all = await rows(s.assignmentId);
    const l2 = all.find((x) => x.userId === s.L[2])!;
    await expect(overrideSubmissionScore(s.instId, l2.id, { score: 5 })).rejects.toMatchObject({
      code: "validation_failed",
      details: "grade_team_first",
    });
    await gradeSubmission(s.instId, l2.id, { score: 8 });
    await overrideSubmissionScore(s.instId, l2.id, { score: 5, note: "Ít đóng góp" });
    await gradeSubmission(s.instId, all[0]!.id, { score: 9 });
    let after = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: l2.id } });
    expect(after).toMatchObject({ score: 5, teamScore: 9, scoreOverridden: true, scoreOverrideNote: "Ít đóng góp" });
    const other = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { assignmentId_userId: { assignmentId: s.assignmentId, userId: s.L[0]! } },
    });
    expect(other.score).toBe(9);
    await overrideSubmissionScore(s.instId, l2.id, { score: null });
    after = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: l2.id } });
    expect(after).toMatchObject({ score: 9, scoreOverridden: false, scoreOverrideNote: null });
    expect(
      await prisma.learningEvent.count({ where: { eventType: LearningEventType.AssignmentScoreOverridden } }),
    ).toBe(2);
    await expect(overrideSubmissionScore(s.L[0]!, l2.id, { score: 10 })).rejects.toThrow();
  });

  it("D1 — danh sách chấm theo nhóm: ai đã rời, ai mới vào, ai chưa có nhóm", async () => {
    const s = await setup();
    await submitted(s, 1);
    await leaveCourseTeam(s.L[2]!, s.courseId);
    await joinCourseTeamByCode(s.L[3]!, s.courseId, s.joinCode);
    await createCourseTeam(s.L[4]!, s.courseId, "B"); // nhóm chưa nộp
    const list = await listTeamSubmissionsForInstructor(s.instId, s.assignmentId);
    expect(list.teams.map((t) => t.team.name)).toEqual(["A", "B"]);
    const a = list.teams[0]!;
    expect(a.latest?.submittedBy?.id).toBe(s.L[1]);
    expect(a.latest?.status).toBe("submitted");
    const flags = new Map(a.latest!.members.map((m) => [m.user.id, m]));
    expect(flags.get(s.L[2]!)?.leftTeam).toBe(true);
    expect(a.joinedAfterSubmit.map((u) => u.id)).toEqual([s.L[3]]);
    expect(list.teams[1]!.latest).toBeNull();
    expect(list.unassigned.map((u) => u.id)).toEqual([s.L[2]]); // L2 đã rời nhóm A
    expect(list.counts).toEqual({ teams: 2, submitted: 1, graded: 0 });
    await expect(listTeamSubmissionsForInstructor(s.L[0]!, s.assignmentId)).rejects.toThrow();
  });
});

describe("Dữ liệu và an toàn — E", () => {
  it("E1 — xoá tài khoản một thành viên không xoá tệp ghi âm nhóm khi người khác còn dùng", async () => {
    const s = await setup({ responseFormat: "audio" });
    await submitted(s, 0);
    const adminId = await user("Admin");
    const { removedFiles } = await deleteUser(adminId, s.L[1]!);
    expect(removedFiles).toEqual([]);
    const others = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: s.assignmentId, userId: { not: s.L[1]! } },
    });
    expect(others.every((x) => x.attachmentUrl?.endsWith("/f1.pdf"))).toBe(true);
  });

  it("E3 — bài tập cá nhân giữ nguyên hành vi (không chép cho bạn cùng nhóm)", async () => {
    const s = await setup();
    const indiv = await createAssignment(s.instId, s.lessonId, { title: "Cá nhân", description: "x" });
    await submitAssignment(s.L[0]!, indiv.assignmentId, { body: "b" });
    const all = await rows(indiv.assignmentId);
    expect(all).toHaveLength(1);
    expect(all[0]!.teamId).toBeNull();
  });
});
