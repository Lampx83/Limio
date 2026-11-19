import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createExam } from "../";
import { commitWordExamImport, parseExamWord, type WordCommitStore } from "../";

const FIXTURE = path.join(__dirname, "fixtures", "de-thi-mau.docx");
const BASE = "http://localhost:3000";

async function setup(tag: string) {
  const owner = (await registerUser({ email: `wi-${tag}@e.com`, password: "password1234", displayName: "O" }, BASE)).userId;
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `wi-${tag}` });
  const { examId } = await createExam(owner, c.courseId, { title: "Đề nhập Word", durationMin: 30 });
  return { owner, examId };
}

function fakeStore(failOnSave: number[] = []) {
  const saved: string[] = [];
  const removed: string[] = [];
  let calls = 0;
  const store: WordCommitStore = {
    async save(filename) {
      calls++;
      if (failOnSave.includes(calls)) throw new Error("disk full");
      saved.push(filename);
    },
    async remove(filename) {
      removed.push(filename);
    },
  };
  return { store, saved, removed };
}

describe("commitWordExamImport", () => {
  it("nhập file mẫu: 16 câu, 1 đoạn văn, 3 ảnh, đúng điểm và đúng gắn đoạn", async () => {
    const { owner, examId } = await setup("full");
    const parse = await parseExamWord(readFileSync(FIXTURE));
    const { store, saved } = fakeStore();
    const r = await commitWordExamImport(owner, examId, parse, { includeWarnings: true, store });
    expect(r).toMatchObject({ imported: 16, passagesCreated: 1, imagesUploaded: 3, skippedError: 0, errors: [] });
    expect(saved).toHaveLength(3);

    const qs = await prisma.examQuestion.findMany({ where: { examId }, orderBy: { orderInExam: "asc" } });
    expect(qs).toHaveLength(16);
    expect(qs.reduce((s, q) => s + q.points, 0)).toBe(20);
    expect(new Set(qs.map((q) => q.type)).size).toBe(10);
    // Thứ tự đúng như trong file.
    expect(qs[0]!.prompt).toContain("khối ngành");
    // Câu có ảnh: đường dẫn thật, không còn embedded.
    const q7 = qs[6]!;
    expect(q7.prompt).toMatch(/<img src="\/api\/exam-assets\/[A-Za-z0-9._-]+\.png" alt="Hình minh hoạ câu 7">/);
    expect(q7.prompt).not.toContain("embedded:");
    // Đoạn văn: có ảnh, 5 câu gắn vào theo thứ tự.
    const passage = await prisma.examPassage.findFirstOrThrow({ where: { examId } });
    expect(passage.title).toBe("Một ngày của Minh ở Bách khoa");
    expect(JSON.stringify(passage.contentJson)).toMatch(/"type":"image".*\/api\/exam-assets\//);
    const inPassage = qs.filter((q) => q.passageId === passage.id);
    expect(inPassage).toHaveLength(5);
    expect(inPassage.map((q) => q.orderInPassage)).toEqual([0, 1, 2, 3, 4]);
    expect(qs.filter((q) => q.passageId === null)).toHaveLength(11);
    // Ảnh đã đăng ký vào đề với mô tả.
    const assets = await prisma.examAsset.findMany({ where: { examId } });
    expect(assets).toHaveLength(3);
    expect(assets.every((a) => a.altText.length > 0)).toBe(true);
    // Cấu hình câu số đúng schema.
    expect(qs.find((q) => q.type === "numerical")!.config).toMatchObject({ expected: 0.2, tolerance: 0.01 });
  });

  it("một ảnh không lưu được: chỉ câu chứa ảnh đó bị bỏ và báo lỗi, các câu khác vẫn nhập", async () => {
    const { owner, examId } = await setup("imgfail");
    const parse = await parseExamWord(readFileSync(FIXTURE));
    const { store } = fakeStore([1]); // ảnh đầu tiên (Câu 7) lỗi
    const r = await commitWordExamImport(owner, examId, parse, { includeWarnings: true, store });
    expect(r.imported).toBe(15);
    expect(r.imagesUploaded).toBe(2);
    expect(r.errors).toEqual([{ rowNumber: 7, errors: [expect.stringContaining("Ảnh không tải lên được")] }]);
    expect(await prisma.examQuestion.count({ where: { examId } })).toBe(15);
  });

  it("ảnh của đoạn văn lỗi: đoạn không được tạo, 5 câu của đoạn báo lỗi, câu ngoài đoạn vẫn nhập", async () => {
    const { owner, examId } = await setup("passfail");
    const parse = await parseExamWord(readFileSync(FIXTURE));
    const { store } = fakeStore([3]); // ảnh thứ ba = ảnh của đoạn văn
    const r = await commitWordExamImport(owner, examId, parse, { includeWarnings: true, store });
    expect(r.passagesCreated).toBe(0);
    expect(r.imported).toBe(11);
    expect(r.errors.map((e) => e.rowNumber).sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13]);
    expect(await prisma.examPassage.count({ where: { examId } })).toBe(0);
  });

  it("đề đã xuất bản (không còn nháp): ảnh không đăng ký được, tệp đã lưu được xoá, câu không ảnh vẫn nhập", async () => {
    const { owner, examId } = await setup("published");
    await prisma.exam.update({ where: { id: examId }, data: { status: "published" } });
    const parse = await parseExamWord(readFileSync(FIXTURE));
    const { store, saved, removed } = fakeStore();
    const r = await commitWordExamImport(owner, examId, parse, { includeWarnings: true, store });
    expect(r.imagesUploaded).toBe(0);
    expect(removed.sort()).toEqual([...saved].sort());
    expect(r.imported).toBe(9); // 16 − Câu 7, 8 − 5 câu của đoạn có ảnh
    expect(r.errors.find((e) => e.rowNumber === 7)!.errors[0]).toMatch(/Nháp/);
    expect(await prisma.examAsset.count({ where: { examId } })).toBe(0);
  });

  it("người không sửa được khoá: không đăng ký được ảnh, đoạn văn nào (quyền ghi câu do route kiểm trước, như Excel/AI)", async () => {
    const { examId } = await setup("stranger");
    const stranger = (await registerUser({ email: "wi-x-stranger@e.com", password: "password1234", displayName: "X" }, BASE)).userId;
    const parse = await parseExamWord(readFileSync(FIXTURE));
    const { store } = fakeStore();
    const r = await commitWordExamImport(stranger, examId, parse, { includeWarnings: true, store });
    expect(r.imagesUploaded).toBe(0);
    expect(r.passagesCreated).toBe(0);
    expect(r.imported).toBe(9); // chỉ còn câu không ảnh, không đoạn — route đã chặn người này từ trước bằng canEditExam
    expect(await prisma.examAsset.count({ where: { examId } })).toBe(0);
  });
});
