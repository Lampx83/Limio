import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { buildLanguagePath, getLanguageLearnerPath, unitState } from "../overview";
import type { CourseProgress } from "../../learning/progress";
import { registerUser } from "../../auth/register";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { enrollInCourse } from "../../learning/enroll";
import { completeLesson } from "../../learning/lessons";

const BASE = "http://localhost:3000";

function progress(mods: Array<Array<{ id: string; completed?: boolean; locked?: boolean }>>): CourseProgress {
  const modules = mods.map((ls, i) => ({
    id: `m${i}`,
    title: `Unit ${i + 1}`,
    completionPct: 0,
    lessons: ls.map((l) => ({ id: l.id, title: `Bài ${l.id}`, completed: !!l.completed, locked: !!l.locked })),
  }));
  const all = modules.flatMap((m) => m.lessons);
  return {
    courseId: "c",
    totalLessons: all.length,
    completedLessons: all.filter((l) => l.completed).length,
    courseCompletionPct: 0,
    modules,
  };
}
const meta = (o: Record<string, { skill?: "reading" | "listening" | "speaking" | "writing" | null; durationSec?: number | null }>) =>
  new Map(Object.entries(o).map(([k, v]) => [k, { skill: v.skill ?? null, durationSec: v.durationSec ?? null }]));

describe("unitState", () => {
  it("Hoàn thành khi đủ bài, Đang học khi có một phần, Chưa học khi 0", () => {
    expect(unitState(3, 3)).toBe("done");
    expect(unitState(1, 3)).toBe("learning");
    expect(unitState(0, 3)).toBe("todo");
  });
});

describe("buildLanguagePath (hàm thuần)", () => {
  it("Unit: đếm x/y, trạng thái, bỏ Unit không có bài", () => {
    const p = progress([[{ id: "a", completed: true }, { id: "b", completed: true }], [{ id: "c", completed: true }, { id: "d" }], [{ id: "e" }], []]);
    const r = buildLanguagePath(p, meta({}), null);
    expect(r.units.map((u) => [u.done, u.total, u.state])).toEqual([
      [2, 2, "done"],
      [1, 2, "learning"],
      [0, 1, "todo"],
    ]);
  });

  it("kỹ năng: tính theo bài hoàn thành, ẩn kỹ năng khoá không có bài, bỏ bài chưa gắn kỹ năng, đúng thứ tự Đọc-Nghe-Nói-Viết", () => {
    const p = progress([[{ id: "r1", completed: true }, { id: "r2" }, { id: "l1", completed: true }, { id: "w1" }, { id: "x" }]]);
    const r = buildLanguagePath(p, meta({ r1: { skill: "reading" }, r2: { skill: "reading" }, l1: { skill: "listening" }, w1: { skill: "writing" } }), null);
    expect(r.skills).toEqual([
      { skill: "reading", done: 1, total: 2, pct: 50 },
      { skill: "listening", done: 1, total: 1, pct: 100 },
      { skill: "writing", done: 0, total: 1, pct: 0 },
    ]);
    expect(r.skills.find((s) => s.skill === "speaking")).toBeUndefined();
  });

  it("không có số mastery trong kết quả", () => {
    const p = progress([[{ id: "a" }]]);
    expect(JSON.stringify(buildLanguagePath(p, meta({ a: { skill: "reading" } }), null))).not.toMatch(/mastery|probab/i);
  });

  it("tiếp tục học: ưu tiên bài mở gần nhất còn dang dở; nếu đã xong/khoá thì bài chưa xong đầu tiên", () => {
    const p = progress([[{ id: "a", completed: true }, { id: "b" }, { id: "c" }]]);
    expect(buildLanguagePath(p, meta({}), "c").continue?.lessonId).toBe("c");
    expect(buildLanguagePath(p, meta({}), "a").continue?.lessonId).toBe("b");
    expect(buildLanguagePath(p, meta({}), "không-có").continue?.lessonId).toBe("b");
    const locked = progress([[{ id: "a" , locked: true }, { id: "b" }]]);
    expect(buildLanguagePath(locked, meta({}), "a").continue?.lessonId).toBe("b");
  });

  it("học hết thì không còn bài để tiếp tục", () => {
    const p = progress([[{ id: "a", completed: true }]]);
    expect(buildLanguagePath(p, meta({}), "a").continue).toBeNull();
  });

  it("số phút chỉ hiện khi bài có thời lượng, làm tròn lên", () => {
    const p = progress([[{ id: "a" }, { id: "b" }]]);
    expect(buildLanguagePath(p, meta({ a: { durationSec: 61 } }), null).continue?.minutes).toBe(2);
    expect(buildLanguagePath(p, meta({ a: { durationSec: null } }), null).continue?.minutes).toBeNull();
    expect(buildLanguagePath(p, meta({ a: { durationSec: 0 } }), null).continue?.minutes).toBeNull();
  });
});

async function setup(tag: string) {
  const owner = await registerUser({ email: `o-${tag}@e.com`, password: "password1234", displayName: "O" }, BASE);
  const learner = await registerUser({ email: `l-${tag}@e.com`, password: "password1234", displayName: "L" }, BASE);
  return { owner: owner.userId, learner: learner.userId };
}

async function course(owner: string, slug: string, opts: { language: boolean; lessons: Array<{ skill?: "reading" | "listening" }> }) {
  const c = await createCourse(owner, {
    title: slug,
    description: "x",
    slug,
    ...(opts.language ? { personalizationEnabled: true, languageMode: true } : {}),
  });
  const m = await createModule(owner, c.courseId, { title: "Unit 1", orderIndex: 0 });
  const lessonIds: string[] = [];
  for (let i = 0; i < opts.lessons.length; i++) {
    const l = await createLesson(owner, m.moduleId, {
      title: `Bài ${i}`,
      orderIndex: i,
      ...(opts.lessons[i]!.skill ? { languageSkill: opts.lessons[i]!.skill } : {}),
    });
    lessonIds.push(l.lessonId);
  }
  await publishCourse(owner, c.courseId);
  return { courseId: c.courseId, lessonIds };
}

describe("getLanguageLearnerPath (DB)", () => {
  it("chưa ghi danh khoá ngoại ngữ nào → rỗng; khoá thường không được tính", async () => {
    const { owner, learner } = await setup("lp1");
    const plain = await course(owner, "lp1-plain", { language: false, lessons: [{}] });
    await enrollInCourse(learner, plain.courseId);
    const r = await getLanguageLearnerPath(learner, null);
    expect(r.selected).toBeNull();
    expect(r.courses).toEqual([]);
  });

  it("tổng hợp đúng tiến độ Unit và kỹ năng sau khi hoàn thành bài", async () => {
    const { owner, learner } = await setup("lp2");
    const c = await course(owner, "lp2-lang", { language: true, lessons: [{ skill: "reading" }, { skill: "reading" }, { skill: "listening" }] });
    await enrollInCourse(learner, c.courseId);
    await completeLesson(learner, c.lessonIds[0]!);
    const r = await getLanguageLearnerPath(learner, null);
    expect(r.selected?.slug).toBe("lp2-lang");
    expect(r.units).toEqual([expect.objectContaining({ done: 1, total: 3, state: "learning" })]);
    expect(r.skills).toEqual([
      { skill: "reading", done: 1, total: 2, pct: 50 },
      { skill: "listening", done: 0, total: 1, pct: 0 },
    ]);
    expect(r.continue?.lessonId).toBe(c.lessonIds[1]);
  });

  it("slug của khoá người khác (hoặc không ghi danh) bị bỏ qua, không lộ khoá đó", async () => {
    const a = await setup("lp3a");
    const b = await setup("lp3b");
    const ca = await course(a.owner, "lp3-a", { language: true, lessons: [{}] });
    const cb = await course(b.owner, "lp3-b", { language: true, lessons: [{}] });
    await enrollInCourse(a.learner, ca.courseId);
    await enrollInCourse(b.learner, cb.courseId);
    const r = await getLanguageLearnerPath(a.learner, "lp3-b");
    expect(r.selected?.slug).toBe("lp3-a");
    expect(r.courses.map((c) => c.slug)).toEqual(["lp3-a"]);
  });

  it("bài bị ẩn không tính vào Unit và kỹ năng", async () => {
    const { owner, learner } = await setup("lp4");
    const c = await course(owner, "lp4-lang", { language: true, lessons: [{ skill: "reading" }, { skill: "reading" }] });
    await enrollInCourse(learner, c.courseId);
    await prisma.lesson.update({ where: { id: c.lessonIds[1]! }, data: { isHidden: true } });
    const r = await getLanguageLearnerPath(learner, null);
    expect(r.units[0]).toMatchObject({ total: 1 });
    expect(r.skills).toEqual([{ skill: "reading", done: 0, total: 1, pct: 0 }]);
  });
});
