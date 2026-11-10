import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { buildLessonFrame, loadLessonDurations, minutesOf } from "../lessonFrame";
import type { CourseProgress } from "../../learning/progress";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";

type L = { id: string; completed?: boolean; locked?: boolean };
function progress(mods: L[][]): CourseProgress {
  const modules = mods.map((ls, i) => ({
    id: `m${i}`,
    title: `Unit ${i + 1}`,
    completionPct: 0,
    lessons: ls.map((l) => ({ id: l.id, title: `Bài ${l.id}`, completed: !!l.completed, locked: !!l.locked })),
  }));
  const all = modules.flatMap((m) => m.lessons);
  return { courseId: "c", totalLessons: all.length, completedLessons: all.filter((l) => l.completed).length, courseCompletionPct: 0, modules };
}
const dur = (o: Record<string, number | null> = {}) => new Map(Object.entries(o));

describe("minutesOf", () => {
  it("làm tròn lên, tối thiểu 1 phút, không có thì null", () => {
    expect(minutesOf(61)).toBe(2);
    expect(minutesOf(1)).toBe(1);
    expect(minutesOf(720)).toBe(12);
    for (const v of [null, undefined, 0, -5]) expect(minutesOf(v)).toBeNull();
  });
});

describe("buildLessonFrame (hàm thuần)", () => {
  it("chỉ lấy các bài của đúng Unit chứa bài hiện tại, đủ bốn trạng thái và số phút", () => {
    const p = progress([[{ id: "a" }], [{ id: "b", completed: true }, { id: "c" }, { id: "d" }, { id: "e", locked: true }]]);
    const f = buildLessonFrame(p, "c", dur({ b: 540, c: 720, e: null }))!;
    expect(f.unitTitle).toBe("Unit 2");
    expect(f.items.map((i) => [i.id, i.state, i.minutes])).toEqual([
      ["b", "done", 9],
      ["c", "current", 12],
      ["d", "todo", null],
      ["e", "locked", null],
    ]);
    expect(f.unitDone).toBe(1);
    expect(f.unitTotal).toBe(4);
  });

  it("bài hiện tại luôn là 'current' kể cả khi đã học xong, và vẫn được đếm vào số đã xong", () => {
    const p = progress([[{ id: "a", completed: true }, { id: "b" }]]);
    const f = buildLessonFrame(p, "a", dur())!;
    expect(f.items[0]!.state).toBe("current");
    expect(f.unitDone).toBe(1);
  });

  it("bài kế tiếp: theo thứ tự khoá, nhảy qua Unit, bỏ qua bài khoá", () => {
    const p = progress([[{ id: "a" }, { id: "b", locked: true }], [{ id: "c", locked: true }, { id: "d" }]]);
    expect(buildLessonFrame(p, "a", dur())!.next).toEqual({ id: "d", title: "Bài d" });
    expect(buildLessonFrame(p, "d", dur())!.next).toBeNull();
  });

  it("bài trước: theo thứ tự khoá, nhảy qua Unit, bỏ qua bài khoá; bài đầu tiên không có bài trước", () => {
    const p = progress([[{ id: "a" }, { id: "b", locked: true }], [{ id: "c", locked: true }, { id: "d" }, { id: "e" }]]);
    expect(buildLessonFrame(p, "a", dur())!.prev).toBeNull();
    expect(buildLessonFrame(p, "d", dur())!.prev).toEqual({ id: "a", title: "Bài a" });
    expect(buildLessonFrame(p, "e", dur())!.prev).toEqual({ id: "d", title: "Bài d" });
  });

  it("bài không có trong tiến độ (bài/module ẩn) → null để giữ bố cục thường", () => {
    expect(buildLessonFrame(progress([[{ id: "a" }]]), "zzz", dur())).toBeNull();
  });
});

describe("loadLessonDurations (DB)", () => {
  it("trả đúng giây của từng bài và null khi không khai báo; danh sách rỗng không truy vấn", async () => {
    expect((await loadLessonDurations([])).size).toBe(0);
    const owner = await registerUser({ email: "lf-o@e.com", password: "password1234", displayName: "O" }, "http://localhost:3000");
    const c = await createCourse(owner.userId, { title: "lf", description: "d", slug: "lf-course" });
    const m = await createModule(owner.userId, c.courseId, { title: "U1", orderIndex: 0 });
    const a = await createLesson(owner.userId, m.moduleId, { title: "A", orderIndex: 0 });
    const b = await createLesson(owner.userId, m.moduleId, { title: "B", orderIndex: 1 });
    await prisma.lesson.update({ where: { id: a.lessonId }, data: { durationSec: 600 } });
    const r = await loadLessonDurations([a.lessonId, b.lessonId]);
    expect(r.get(a.lessonId)).toBe(600);
    expect(r.get(b.lessonId)).toBeNull();
  });
});
