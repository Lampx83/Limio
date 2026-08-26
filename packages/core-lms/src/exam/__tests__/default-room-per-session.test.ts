import { expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import {
  createExam,
  ensureDefaultRound,
  ensureDefaultRoomForSession,
} from "../";

const BASE = "http://localhost:3000";

/**
 * ExamRoom có `@@unique([examId, name])`, mà phòng mặc định trước đây luôn tên
 * "Phòng mặc định" — nên ca THỨ HAI của cùng một gói đề không tạo nổi phòng.
 * Lỗi này nằm im vì luồng mở nhanh cũ luôn dùng lại ca cũ; nó lộ ra khi cùng
 * một gói đề mở được nhiều buổi, và nó cũng làm hỏng "Tạo nhiều ca thi".
 */
it("hai ca của cùng một gói đề đều tạo được phòng mặc định", async () => {
  const owner = await registerUser(
    { email: "room-per-session@e.com", password: "password1234", displayName: "GV" },
    BASE,
  );
  const course = await createCourse(owner.userId, {
    title: "C room", description: "x", slug: "room-per-session",
  });
  const { examId } = await createExam(owner.userId, course.courseId, {
    title: "Đề room", durationMin: 20,
  });
  const roundId = await ensureDefaultRound(examId);

  const mk = () =>
    prisma.examSession.create({
      data: {
        examId, roundId,
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 3_600_000),
      },
      select: { id: true },
    });

  const s1 = await mk();
  const s2 = await mk();

  await ensureDefaultRoomForSession(owner.userId, s1.id);
  await ensureDefaultRoomForSession(owner.userId, s2.id);

  const rooms = await prisma.examRoom.findMany({
    where: { examId },
    select: { name: true, sessionId: true },
    orderBy: { name: "asc" },
  });
  expect(rooms).toHaveLength(2);
  // Tên phải khác nhau, và mỗi phòng thuộc đúng ca của nó.
  expect(new Set(rooms.map((r) => r.name)).size).toBe(2);
  expect(new Set(rooms.map((r) => r.sessionId))).toEqual(
    new Set([s1.id, s2.id]),
  );
});
