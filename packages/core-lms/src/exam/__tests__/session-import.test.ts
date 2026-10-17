import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  createExamQuestion,
  createFormalSession,
  importSessionRooms,
  publishExam,
} from "../";

const BASE = "http://localhost:3000";

async function setup(slug: string) {
  const owner = await registerUser(
    { email: `simp-${slug}@e.com`, password: "password1234", displayName: "Owner" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: `C ${slug}`,
    description: "x",
    slug: `simp-course-${slug}`,
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: `Đề ${slug}`,
    durationMin: 20,
  });
  await createExamQuestion(owner.userId, examId, {
    type: "mcq",
    prompt: "Q",
    config: {
      options: [
        { id: "a", label: "A", isCorrect: true },
        { id: "b", label: "B", isCorrect: false },
      ],
    },
    points: 10,
  });
  await publishExam(owner.userId, examId);
  const { id: sessionId } = await createFormalSession(owner.userId, {
    examId,
    accessMode: "assigned_code",
  });
  return { ownerId: owner.userId, courseId: course.courseId, examId, sessionId };
}

describe("importSessionRooms — nhập phòng/lớp/thí sinh cho một ca", () => {
  it("dòng chỉ có phòng: tạo phòng + lớp học + lớp thi; giám thị mặc định là người nhập", async () => {
    const s = await setup("rooms");
    const r = await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [
        { examClassCode: "p101", cohortCode: "k65a", roomLocation: "Nhà A1", stt: 1 },
        { examClassCode: "p102", cohortCode: "k65a", roomLocation: "Nhà A2", stt: 2 },
      ],
      BASE,
    );
    expect(r.roomsCreated).toBe(2);
    expect(r.cohortsCreated).toBe(1);
    expect(r.cohortsUpdated).toBe(1);
    expect(r.examClassesCreated).toBe(2);
    expect(r.skipped).toEqual([]);

    const room = await prisma.examRoom.findFirstOrThrow({
      where: { sessionId: s.sessionId, name: "P101" },
    });
    expect(room.proctorUserId).toBe(s.ownerId);
    expect(room.locationNote).toBe("Nhà A1");
    expect(room.sourceRowNum).toBe(1);
    expect(room.accessCode).toBeTruthy();
    expect(room.isDefault).toBe(false); // phòng mặc định của ca đã có sẵn

    const cohort = await prisma.courseSection.findFirstOrThrow({
      where: { courseId: s.courseId, code: "K65A" },
    });
    expect(cohort.name).toBe("K65A");
  });

  it("dòng có họ tên: gom theo phòng và thêm thí sinh; số dự kiến = số dòng", async () => {
    const s = await setup("cands");
    const r = await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [
        { examClassCode: "P201", cohortCode: "K66", displayName: "An", mssv: "1001" },
        { examClassCode: "P201", displayName: "Bình", email: "binh@e.com" },
        { examClassCode: "P202", cohortCode: "K66", displayName: "Chi", mssv: "1003" },
      ],
      BASE,
    );
    expect(r.roomsCreated).toBe(2);
    expect(r.candidatesAdded).toBe(3);

    const p201 = await prisma.examRoom.findFirstOrThrow({
      where: { sessionId: s.sessionId, name: "P201" },
      include: { candidates: true },
    });
    expect(p201.candidates.map((c) => c.displayName).sort()).toEqual(["An", "Bình"]);

    const ec = await prisma.cohortExamClass.findFirstOrThrow({
      where: { courseId: s.courseId, code: "P201" },
    });
    expect(ec.expectedStudentCount).toBe(2);
  });

  it("chạy lại cùng dữ liệu không nhân đôi phòng hay thí sinh", async () => {
    const s = await setup("idem");
    const rows = [
      { examClassCode: "P301", cohortCode: "K67", displayName: "An", mssv: "2001" },
      { examClassCode: "P301", displayName: "Bình", email: "b2@e.com" },
    ];
    await importSessionRooms(s.ownerId, s.sessionId, rows, BASE);
    const again = await importSessionRooms(s.ownerId, s.sessionId, rows, BASE);

    expect(again.roomsCreated).toBe(0);
    expect(again.roomsUpdated).toBe(1);
    expect(again.candidatesAdded).toBe(0);
    expect(again.candidatesSkipped).toBe(2);
    expect(await prisma.examCandidate.count({ where: { sessionId: s.sessionId } })).toBe(2);
    expect(
      await prisma.examRoom.count({ where: { sessionId: s.sessionId, name: "P301" } }),
    ).toBe(1);
  });

  it("giám thị chưa có tài khoản được mời; email sai chỉ bỏ qua phòng đó", async () => {
    const s = await setup("proctor");
    const r = await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [
        { examClassCode: "P401", proctorEmail: "giamthi.moi@e.com" },
        { examClassCode: "P402", proctorEmail: "khong-phai-email" },
        { examClassCode: "P403" },
      ],
      BASE,
    );
    expect(r.invited).toBe(1);
    expect(r.roomsCreated).toBe(2);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0]).toMatchObject({ row: 2, reason: "invalid_proctor_email" });

    const p401 = await prisma.examRoom.findFirstOrThrow({
      where: { sessionId: s.sessionId, name: "P401" },
      include: { proctor: { select: { email: true } } },
    });
    expect(p401.proctor.email).toBe("giamthi.moi@e.com");
  });

  it("dòng thiếu mã lớp thi bị bỏ qua, không hỏng cả lượt", async () => {
    const s = await setup("missing");
    const r = await importSessionRooms(
      s.ownerId,
      s.sessionId,
      [{ examClassCode: "" , displayName: "X" }, { examClassCode: "P501" }],
      BASE,
    );
    expect(r.skipped).toEqual([{ row: 1, reason: "missing_room_code" }]);
    expect(r.roomsCreated).toBe(1);
  });

  it("người không phải giảng viên của đề thì bị chặn", async () => {
    const s = await setup("forbid");
    const stranger = await registerUser(
      { email: `simp-stranger-${Date.now()}@e.com`, password: "password1234", displayName: "S" },
      BASE,
    );
    await expect(
      importSessionRooms(stranger.userId, s.sessionId, [{ examClassCode: "P1" }], BASE),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(await prisma.examRoom.count({ where: { sessionId: s.sessionId } })).toBe(1);
  });

  it("danh sách rỗng bị từ chối", async () => {
    const s = await setup("empty");
    await expect(
      importSessionRooms(s.ownerId, s.sessionId, [], BASE),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});
