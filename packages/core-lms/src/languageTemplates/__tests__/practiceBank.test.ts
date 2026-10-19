import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { registerUser } from "../../auth/register";
import { grantRole } from "../../auth/roles";
import { createCourse } from "../../courses/courses";
import { createPracticeBankCourse, createPracticeExam, PRACTICE_FAMILIES } from "../practiceBank";

/** LANG L6.9 — khung tạo khoá luyện đề theo họ thi + kỹ năng, và đề một-phần-kỹ-năng. */

const BASE = "http://localhost:3000";
let n = 0;
async function instructor() {
  const r = await registerUser({ email: `pb${Date.now()}${++n}${Math.random()}@example.com`, password: "password1234", displayName: "GV" }, BASE);
  await grantRole(r.userId, { targetUserId: r.userId, roleName: RoleName.Instructor });
  return r.userId;
}

describe("createCourse nhận kind", () => {
  it("mặc định standard; practice_bank khi chỉ định", async () => {
    const u = await instructor();
    const a = await createCourse(u, { title: "A", description: "x" });
    const b = await createCourse(u, { title: "B", description: "x", kind: "practice_bank" });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: a.courseId } })).kind).toBe("standard");
    expect((await prisma.course.findUniqueOrThrow({ where: { id: b.courseId } })).kind).toBe("practice_bank");
  });
});

describe("createPracticeBankCourse (L6.9)", () => {
  it("HSK 4 Nghe: khoá nháp thuộc về giảng viên, kind practice_bank, bật chế độ ngoại ngữ, ngôn ngữ zh, có bộ/Part mẫu theo thứ tự", async () => {
    const u = await instructor();
    const r = await createPracticeBankCourse(u, { family: "hsk", skill: "listening", level: "4" });
    const c = await prisma.course.findUniqueOrThrow({ where: { id: r.courseId }, include: { instructors: true, examCollections: { orderBy: { orderIndex: "asc" } } } });
    expect(c).toMatchObject({ kind: "practice_bank", status: "draft", languageMode: true, personalizationEnabled: true, language: "zh" });
    expect(c.title).toContain("HSK 4");
    expect(c.title).toContain("Nghe");
    expect(c.instructors.map((i) => [i.userId, i.role])).toEqual([[u, "owner"]]);
    expect(c.examCollections.map((x) => x.title)).toEqual(["Phần 1", "Phần 2", "Phần 3"]);
    expect(c.description).toMatch(/Luyện đề/);
    expect(c.description).toMatch(/Phòng thi mô phỏng/);
    expect(await prisma.enrollment.count({ where: { courseId: r.courseId } })).toBe(0);
  });

  it("IELTS Reading → Passage 1–3 (en); TOEIC Listening → Part 1–4; TOEIC Reading → Part 5–7", async () => {
    const u = await instructor();
    const titles = async (family: "ielts" | "toeic", skill: "listening" | "reading") => {
      const r = await createPracticeBankCourse(u, { family, skill });
      return (await prisma.examCollection.findMany({ where: { courseId: r.courseId }, orderBy: { orderIndex: "asc" } })).map((x) => x.title);
    };
    expect(await titles("ielts", "reading")).toEqual(["Passage 1", "Passage 2", "Passage 3"]);
    expect(await titles("toeic", "listening")).toEqual(["Part 1", "Part 2", "Part 3", "Part 4"]);
    expect(await titles("toeic", "reading")).toEqual(["Part 5", "Part 6", "Part 7"]);
    const en = await createPracticeBankCourse(u, { family: "ielts", skill: "listening" });
    expect((await prisma.course.findUniqueOrThrow({ where: { id: en.courseId } })).language).toBe("en");
  });

  it("tổ hợp không có (TOEIC Nói/Viết, HSK thiếu/sai cấp độ, họ lạ) bị từ chối; không tạo khoá", async () => {
    const u = await instructor();
    const before = await prisma.course.count();
    for (const bad of [
      { family: "toeic", skill: "speaking" }, { family: "hsk", skill: "listening" }, { family: "hsk", skill: "listening", level: "9" },
      { family: "xyz", skill: "listening" }, { family: "ielts", skill: "dance" },
    ]) {
      await expect(createPracticeBankCourse(u, bad), JSON.stringify(bad)).rejects.toMatchObject({ code: "validation_failed" });
    }
    expect(await prisma.course.count()).toBe(before);
    expect(Object.keys(PRACTICE_FAMILIES).sort()).toEqual(["hsk", "ielts", "toeic"]);
  });

  it("chỉ giảng viên; người thường bị chặn", async () => {
    const r = await registerUser({ email: `pbx${Date.now()}@example.com`, password: "password1234", displayName: "HV" }, BASE);
    await expect(createPracticeBankCourse(r.userId, { family: "ielts", skill: "reading" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("createPracticeExam — đề một phần một kỹ năng", () => {
  it("dựng đề thi thử có MỘT phần đúng kỹ năng + giờ, gán bộ/phân loại, ở trạng thái nháp", async () => {
    const u = await instructor();
    const r = await createPracticeBankCourse(u, { family: "hsk", skill: "listening", level: "4" });
    const coll = await prisma.examCollection.findFirstOrThrow({ where: { courseId: r.courseId } });
    const { examId } = await createPracticeExam(u, r.courseId, {
      title: "Đề 1", skill: "listening", minutes: 35, collectionId: coll.id, seq: 1, paperType: "official", sourceLabel: "HSK 2023-05", difficulty: 3, tags: ["t"],
    });
    const e = await prisma.exam.findUniqueOrThrow({ where: { id: examId }, include: { sections: true } });
    expect(e).toMatchObject({ mockMode: true, status: "draft", allowMock: true, allowPractice: true, collectionId: coll.id, seq: 1, paperType: "official", sourceLabel: "HSK 2023-05", difficulty: 3, durationMin: 35 });
    expect(e.tags).toEqual(["t"]);
    expect(e.sections.map((s) => [s.languageSkill, s.durationMin])).toEqual([["listening", 35]]);
  });

  it("thiếu tiêu đề/kỹ năng/số phút hợp lệ bị từ chối; người ngoài không tạo được", async () => {
    const u = await instructor();
    const r = await createPracticeBankCourse(u, { family: "ielts", skill: "reading" });
    await expect(createPracticeExam(u, r.courseId, { title: "", skill: "reading" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createPracticeExam(u, r.courseId, { title: "x", skill: "dance" as never })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(createPracticeExam(u, r.courseId, { title: "x", skill: "reading", minutes: 0 })).rejects.toMatchObject({ code: "validation_failed" });
    const stranger = await registerUser({ email: `pby${Date.now()}@example.com`, password: "password1234", displayName: "S" }, BASE);
    await expect(createPracticeExam(stranger.userId, r.courseId, { title: "x", skill: "reading" })).rejects.toBeTruthy();
  });
});
