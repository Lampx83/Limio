import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  createCourseTeam,
  getCourseTeamsOverview,
  getMyCourseTeam,
  instructorMoveTeamMember,
  instructorSetTeamCaptain,
  joinCourseTeamByCode,
  leaveCourseTeam,
  regenerateCourseTeamCode,
  removeCourseTeamMember,
  renameCourseTeam,
  instructorRenameCourseTeam,
  updateCourseTeamSettings,
} from "../teams";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { enrollInCourse } from "../../learning/enroll";

const BASE = "http://localhost:3000";

async function user(name: string) {
  const r = await registerUser(
    { email: `${name}-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
  return r.userId;
}

/** Khoá đã publish + n học viên đã ghi danh. */
async function setup(n = 4) {
  const instId = await user("Inst");
  const c = await createCourse(instId, { title: "Teams", description: "x" });
  const m = await createModule(instId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(instId, m.moduleId, { title: "L", orderIndex: 0 });
  await prisma.course.update({ where: { id: c.courseId }, data: { status: "published" } });
  const learners: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = await user(`Lr${i}`);
    await enrollInCourse(id, c.courseId);
    learners.push(id);
  }
  return { instId, courseId: c.courseId, lessonId: l.lessonId, learners };
}

function events(type: string) {
  return prisma.learningEvent.findMany({ where: { eventType: type }, orderBy: { id: "asc" } });
}

describe("Nhóm của khoá — học viên tự lập (A)", () => {
  it("A1 — tạo nhóm: người tạo là trưởng nhóm, có mã 6 ký tự, ghi sự kiện", async () => {
    const s = await setup(1);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "Nhóm Mây");
    expect(t.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const mine = await getMyCourseTeam(s.learners[0]!, s.courseId);
    expect(mine.team?.name).toBe("Nhóm Mây");
    expect(mine.team?.captainId).toBe(s.learners[0]);
    expect(mine.team?.members.map((m) => m.userId)).toEqual([s.learners[0]]);
    const ev = await events(LearningEventType.CourseTeamCreated);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.userId).toBe(s.learners[0]);
    expect(ev[0]!.courseId).toBe(s.courseId);
  });

  it("A1 — tên trùng trong cùng khoá bị chặn; tên rỗng bị chặn", async () => {
    const s = await setup(2);
    await createCourseTeam(s.learners[0]!, s.courseId, "Nhóm 1");
    await expect(createCourseTeam(s.learners[1]!, s.courseId, " Nhóm 1 ")).rejects.toMatchObject({
      code: "team_name_taken",
    });
    await expect(createCourseTeam(s.learners[1]!, s.courseId, "  ")).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("A1 — chưa ghi danh thì không tạo được; đã có nhóm thì không tạo thêm", async () => {
    const s = await setup(1);
    const outsider = await user("Out");
    await expect(createCourseTeam(outsider, s.courseId, "X")).rejects.toMatchObject({ code: "not_enrolled" });
    await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await expect(createCourseTeam(s.learners[0]!, s.courseId, "B")).rejects.toMatchObject({
      code: "already_in_team",
    });
  });

  it("A2 — vào nhóm bằng mã (không phân biệt hoa thường, bỏ khoảng trắng)", async () => {
    const s = await setup(2);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, ` ${t.joinCode.toLowerCase()} `);
    const mine = await getMyCourseTeam(s.learners[1]!, s.courseId);
    expect(mine.team?.id).toBe(t.teamId);
    expect(mine.team?.members).toHaveLength(2);
    expect(await events(LearningEventType.CourseTeamJoined)).toHaveLength(1);
  });

  it("A2 — mã sai, hoặc mã của nhóm ở khoá khác, đều báo không tìm thấy", async () => {
    const s = await setup(1);
    const other = await setup(1);
    const t = await createCourseTeam(other.learners[0]!, other.courseId, "Khác");
    await expect(joinCourseTeamByCode(s.learners[0]!, s.courseId, "ZZZZZZ")).rejects.toMatchObject({
      code: "join_code_invalid",
    });
    await expect(joinCourseTeamByCode(s.learners[0]!, s.courseId, t.joinCode)).rejects.toMatchObject({
      code: "join_code_invalid",
    });
  });

  it("A2 — nhóm đã đủ người bị chặn, kể cả khi hai người vào cùng lúc", async () => {
    const s = await setup(4);
    await updateCourseTeamSettings(s.instId, s.courseId, { teamMaxSize: 2 });
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    const results = await Promise.allSettled([
      joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode),
      joinCourseTeamByCode(s.learners[2]!, s.courseId, t.joinCode),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "team_full" });
    expect(await prisma.courseTeamMember.count({ where: { teamId: t.teamId } })).toBe(2);
  });

  it("A3 — trưởng nhóm rời: quyền chuyển cho người vào sớm nhất", async () => {
    const s = await setup(3);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    await joinCourseTeamByCode(s.learners[2]!, s.courseId, t.joinCode);
    await leaveCourseTeam(s.learners[0]!, s.courseId);
    const mine = await getMyCourseTeam(s.learners[1]!, s.courseId);
    expect(mine.team?.captainId).toBe(s.learners[1]);
    expect(mine.team?.members.map((m) => m.userId)).toEqual([s.learners[1], s.learners[2]]);
    expect((await getMyCourseTeam(s.learners[0]!, s.courseId)).team).toBeNull();
  });

  it("A3 — người cuối rời: nhóm chưa có bài nộp thì bị xoá", async () => {
    const s = await setup(1);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await leaveCourseTeam(s.learners[0]!, s.courseId);
    expect(await prisma.courseTeam.findUnique({ where: { id: t.teamId } })).toBeNull();
  });

  it("A3 — người cuối rời: nhóm đã có bài nộp thì được giữ lại (rỗng)", async () => {
    const s = await setup(1);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    const a = await prisma.assignment.create({
      data: { lessonId: s.lessonId, title: "BT", description: "x", submissionMode: "team" },
    });
    await prisma.assignmentSubmission.create({
      data: { assignmentId: a.id, userId: s.learners[0]!, body: "b", teamId: t.teamId },
    });
    await leaveCourseTeam(s.learners[0]!, s.courseId);
    const kept = await prisma.courseTeam.findUnique({ where: { id: t.teamId } });
    expect(kept).not.toBeNull();
    expect(kept!.captainId).toBeNull();
  });

  it("A4 — đổi mã: mã cũ hết hiệu lực, thành viên cũ giữ nguyên; chỉ trưởng nhóm đổi được", async () => {
    const s = await setup(3);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    await expect(regenerateCourseTeamCode(s.learners[1]!, s.courseId)).rejects.toMatchObject({
      code: "not_captain",
    });
    const { joinCode } = await regenerateCourseTeamCode(s.learners[0]!, s.courseId);
    expect(joinCode).not.toBe(t.joinCode);
    await expect(joinCourseTeamByCode(s.learners[2]!, s.courseId, t.joinCode)).rejects.toMatchObject({
      code: "join_code_invalid",
    });
    await joinCourseTeamByCode(s.learners[2]!, s.courseId, joinCode);
    expect(await prisma.courseTeamMember.count({ where: { teamId: t.teamId } })).toBe(3);
  });

  it("A5 — trưởng nhóm mời một bạn ra; thành viên thường không làm được", async () => {
    const s = await setup(3);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    await joinCourseTeamByCode(s.learners[2]!, s.courseId, t.joinCode);
    await expect(removeCourseTeamMember(s.learners[1]!, s.courseId, s.learners[2]!)).rejects.toMatchObject({
      code: "not_captain",
    });
    await removeCourseTeamMember(s.learners[0]!, s.courseId, s.learners[2]!);
    expect((await getMyCourseTeam(s.learners[2]!, s.courseId)).team).toBeNull();
    const left = await events(LearningEventType.CourseTeamLeft);
    expect(left.at(-1)!.payload).toMatchObject({ removedBy: s.learners[0] });
  });

  it("A — mã nhóm không lộ cho người ngoài nhóm", async () => {
    const s = await setup(2);
    await createCourseTeam(s.learners[0]!, s.courseId, "A");
    const outsider = await getMyCourseTeam(s.learners[1]!, s.courseId);
    expect(outsider.team).toBeNull();
  });
});

describe("Nhóm của khoá — giảng viên quản lý (B)", () => {
  it("B1, B2 — khoá danh sách chặn mọi thao tác của học viên", async () => {
    const s = await setup(3);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await updateCourseTeamSettings(s.instId, s.courseId, { locked: true });
    await expect(createCourseTeam(s.learners[1]!, s.courseId, "B")).rejects.toMatchObject({ code: "teams_locked" });
    await expect(joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode)).rejects.toMatchObject({
      code: "teams_locked",
    });
    await expect(leaveCourseTeam(s.learners[0]!, s.courseId)).rejects.toMatchObject({ code: "teams_locked" });
    await expect(regenerateCourseTeamCode(s.learners[0]!, s.courseId)).rejects.toMatchObject({
      code: "teams_locked",
    });
    const mine = await getMyCourseTeam(s.learners[0]!, s.courseId);
    expect(mine.settings.locked).toBe(true);
    await updateCourseTeamSettings(s.instId, s.courseId, { locked: false });
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    expect(await events(LearningEventType.CourseTeamsSettingsChanged)).toHaveLength(2);
  });

  it("B1 — chỉ người sửa được khoá mới đổi cài đặt", async () => {
    const s = await setup(1);
    await expect(updateCourseTeamSettings(s.learners[0]!, s.courseId, { locked: true })).rejects.toThrow();
  });

  it("B3 — tổng quan: danh sách nhóm và học viên chưa có nhóm", async () => {
    const s = await setup(4);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    const o = await getCourseTeamsOverview(s.instId, s.courseId);
    expect(o.teams).toHaveLength(1);
    expect(o.teams[0]!.members).toHaveLength(2);
    expect(o.teams[0]!.joinCode).toBe(t.joinCode);
    expect(o.unassigned.map((u) => u.id).sort()).toEqual([s.learners[2], s.learners[3]].sort());
    await expect(getCourseTeamsOverview(s.learners[0]!, s.courseId)).rejects.toThrow();
  });

  it("B4 — giảng viên chuyển, thêm, gỡ thành viên và đổi trưởng nhóm, kể cả khi đã khoá", async () => {
    const s = await setup(4);
    const a = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    const b = await createCourseTeam(s.learners[1]!, s.courseId, "B");
    await joinCourseTeamByCode(s.learners[2]!, s.courseId, a.joinCode);
    await updateCourseTeamSettings(s.instId, s.courseId, { locked: true });

    // chuyển L2 từ A sang B
    await instructorMoveTeamMember(s.instId, s.courseId, s.learners[2]!, b.teamId);
    expect((await getMyCourseTeam(s.learners[2]!, s.courseId)).team?.id).toBe(b.teamId);
    // thêm L3 (chưa có nhóm) vào A
    await instructorMoveTeamMember(s.instId, s.courseId, s.learners[3]!, a.teamId);
    expect((await getMyCourseTeam(s.learners[3]!, s.courseId)).team?.id).toBe(a.teamId);
    // gỡ L3 khỏi nhóm
    await instructorMoveTeamMember(s.instId, s.courseId, s.learners[3]!, null);
    expect((await getMyCourseTeam(s.learners[3]!, s.courseId)).team).toBeNull();
    // đổi trưởng nhóm B
    await instructorSetTeamCaptain(s.instId, s.courseId, b.teamId, s.learners[2]!);
    expect((await getMyCourseTeam(s.learners[1]!, s.courseId)).team?.captainId).toBe(s.learners[2]);

    const moved = await events(LearningEventType.CourseTeamMemberMoved);
    expect(moved).toHaveLength(3);
    expect(moved[0]!.payload).toMatchObject({ actorId: s.instId, fromTeamId: a.teamId, toTeamId: b.teamId });
    await expect(instructorMoveTeamMember(s.learners[0]!, s.courseId, s.learners[2]!, a.teamId)).rejects.toThrow();
  });

  it("B4 — trưởng nhóm bị chuyển đi: quyền chuyển cho người vào sớm nhất của nhóm cũ", async () => {
    const s = await setup(3);
    const a = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, a.joinCode);
    const b = await createCourseTeam(s.learners[2]!, s.courseId, "B");
    await instructorMoveTeamMember(s.instId, s.courseId, s.learners[0]!, b.teamId);
    expect((await getMyCourseTeam(s.learners[1]!, s.courseId)).team?.captainId).toBe(s.learners[1]);
  });
});

describe("Đổi tên nhóm", () => {
  it("trưởng nhóm đổi tên khi chưa khoá; ghi sự kiện có tên cũ và mới", async () => {
    const s = await setup(2);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "a");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    await renameCourseTeam(s.learners[0]!, s.courseId, "  Nhóm   Mây  ");
    expect((await getMyCourseTeam(s.learners[1]!, s.courseId)).team?.name).toBe("Nhóm Mây");
    const ev = await events(LearningEventType.CourseTeamRenamed);
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ teamId: t.teamId, from: "a", to: "Nhóm Mây", actorId: s.learners[0] });
  });

  it("thành viên thường không đổi được; người chưa có nhóm cũng không", async () => {
    const s = await setup(3);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await joinCourseTeamByCode(s.learners[1]!, s.courseId, t.joinCode);
    await expect(renameCourseTeam(s.learners[1]!, s.courseId, "B")).rejects.toMatchObject({ code: "not_captain" });
    await expect(renameCourseTeam(s.learners[2]!, s.courseId, "B")).rejects.toMatchObject({ code: "not_in_team" });
  });

  it("tên trùng nhóm khác hoặc rỗng/quá dài bị chặn; giữ nguyên tên thì không ghi sự kiện", async () => {
    const s = await setup(2);
    await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await createCourseTeam(s.learners[1]!, s.courseId, "B");
    await expect(renameCourseTeam(s.learners[0]!, s.courseId, "B")).rejects.toMatchObject({ code: "team_name_taken" });
    await expect(renameCourseTeam(s.learners[0]!, s.courseId, "   ")).rejects.toMatchObject({ code: "validation_failed" });
    await expect(renameCourseTeam(s.learners[0]!, s.courseId, "x".repeat(61))).rejects.toMatchObject({
      code: "validation_failed",
    });
    await renameCourseTeam(s.learners[0]!, s.courseId, " A ");
    expect(await events(LearningEventType.CourseTeamRenamed)).toHaveLength(0);
  });

  it("khoá danh sách thì trưởng nhóm không đổi được, nhưng giảng viên vẫn đổi được", async () => {
    const s = await setup(1);
    const t = await createCourseTeam(s.learners[0]!, s.courseId, "a");
    await updateCourseTeamSettings(s.instId, s.courseId, { locked: true });
    await expect(renameCourseTeam(s.learners[0]!, s.courseId, "Mây")).rejects.toMatchObject({ code: "teams_locked" });
    await instructorRenameCourseTeam(s.instId, s.courseId, t.teamId, "Nhóm Mây");
    expect((await getMyCourseTeam(s.learners[0]!, s.courseId)).team?.name).toBe("Nhóm Mây");
    const ev = await events(LearningEventType.CourseTeamRenamed);
    expect(ev[0]!.payload).toMatchObject({ actorId: s.instId, from: "a", to: "Nhóm Mây" });
  });

  it("giảng viên: nhóm của khoá khác báo không tìm thấy; học viên không gọi được hàm của giảng viên", async () => {
    const s = await setup(1);
    const other = await setup(1);
    const t = await createCourseTeam(other.learners[0]!, other.courseId, "X");
    await expect(instructorRenameCourseTeam(s.instId, s.courseId, t.teamId, "Y")).rejects.toMatchObject({
      code: "team_not_found",
    });
    const mine = await createCourseTeam(s.learners[0]!, s.courseId, "A");
    await expect(instructorRenameCourseTeam(s.learners[0]!, s.courseId, mine.teamId, "B")).rejects.toThrow();
  });
});
