import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../courses";
import { createModule } from "../modules";
import { createLesson, updateLesson } from "../lessons";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function setup(titles: string[]) {
  const r = await registerUser(
    {
      email: `les${Date.now()}${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: "password1234",
      displayName: "L",
    },
    BASE,
  );
  const c = await createCourse(r.userId, { title: "Lesson tests", description: "x" });
  const m = await createModule(r.userId, c.courseId, { title: "M", orderIndex: 0 });
  const lessonIds: string[] = [];
  for (const [i, title] of titles.entries()) {
    const l = await createLesson(r.userId, m.moduleId, { title, orderIndex: i });
    lessonIds.push(l.lessonId);
  }
  return { userId: r.userId, moduleId: m.moduleId, lessonIds };
}

async function order(moduleId: string) {
  const rows = await prisma.lesson.findMany({
    where: { moduleId },
    select: { title: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  });
  return rows.map((r) => `${r.orderIndex}:${r.title}`);
}

describe("updateLesson", () => {
  it("renames a lesson even when orderIndex is resent unchanged", async () => {
    const { userId, moduleId, lessonIds } = await setup(["A", "B"]);
    await updateLesson(userId, lessonIds[1]!, { title: "B mới", orderIndex: 1 });
    expect(await order(moduleId)).toEqual(["0:A", "1:B mới"]);
  });

  // Regression: form sửa bài học gửi kèm ORDER. Nếu số đó đang thuộc về bài
  // khác, gán thẳng sẽ đụng unique (moduleId, orderIndex) → P2002 → API 500 và
  // người dùng thấy "không sửa được tên bài học".
  it("renames + moves when the requested order belongs to a sibling", async () => {
    const { userId, moduleId, lessonIds } = await setup(["A", "B", "C"]);
    await updateLesson(userId, lessonIds[2]!, { title: "C mới", orderIndex: 0 });
    expect(await order(moduleId)).toEqual(["0:C mới", "1:A", "2:B"]);
  });

  it("clamps an out-of-range order to the end", async () => {
    const { userId, moduleId, lessonIds } = await setup(["A", "B"]);
    await updateLesson(userId, lessonIds[0]!, { orderIndex: 99 });
    expect(await order(moduleId)).toEqual(["0:B", "1:A"]);
  });

  it("persists isHidden", async () => {
    const { userId, lessonIds } = await setup(["A"]);
    await updateLesson(userId, lessonIds[0]!, { isHidden: true });
    const row = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonIds[0]! } });
    expect(row.isHidden).toBe(true);
  });
});
