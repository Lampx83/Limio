import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AccessCodeError, redeemAccessCode, revokeAccessCode } from "../accessCode";
import {
  ACCESS_CODE_BATCH_LIMIT,
  ACCESS_CODE_PAGE_SIZE,
  createAccessCodeBatch,
  exportBatchCodesCsv,
  listAccessCodeBatches,
  listBatchCodes,
  lookupAccessCode,
  revokeBatch,
} from "../accessCodeBatch";
import { createCourse, publishCourse, updateCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createSkill, tagLessonSkill } from "../../courses/skills";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";
const CODE_RE = /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

async function makeUser(email: string) {
  return (await registerUser({ email, password: "password1234", displayName: email }, BASE)).userId;
}

async function paidCourse(ownerId: string, slug: string, priceCents = 199_000) {
  const c = await createCourse(ownerId, { title: `t ${slug}`, description: "d", slug });
  await updateCourse(ownerId, c.courseId, { priceCents, currency: "VND" });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  const s = await createSkill({ code: `skill.${slug}`, name: "s" });
  await tagLessonSkill(ownerId, l.lessonId, { skillId: s.skillId });
  await publishCourse(ownerId, c.courseId);
  return c.courseId;
}

async function errCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof AccessCodeError) return e.code;
    throw e;
  }
}

describe("createAccessCodeBatch", () => {
  it("sinh đúng N mã duy nhất gắn vào lô, chốt giá lúc sinh, ghi sự kiện không mang mã", async () => {
    const owner = await makeUser("b-owner1@e.com");
    const courseId = await paidCourse(owner, "b-1", 250_000);

    const { batchId, count } = await createAccessCodeBatch(courseId, owner, { label: "  Tái bản 2026 — đợt 1  ", count: 120, note: "in 12/2026" });
    expect(count).toBe(120);

    const batch = await prisma.courseAccessCodeBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch).toMatchObject({ courseId, label: "Tái bản 2026 — đợt 1", note: "in 12/2026", count: 120, createdBy: owner });

    const codes = await prisma.courseAccessCode.findMany({ where: { batchId } });
    expect(codes).toHaveLength(120);
    expect(new Set(codes.map((c) => c.code)).size).toBe(120);
    expect(codes.every((c) => CODE_RE.test(c.code) && c.status === "unused" && c.courseId === courseId)).toBe(true);
    expect(codes.every((c) => c.priceCentsSnapshot === 250_000 && c.currency === "VND")).toBe(true);

    // Đổi giá khoá sau đó không làm lệch giá đã chốt.
    await prisma.course.update({ where: { id: courseId }, data: { priceCents: 999_000 } });
    expect((await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } })).priceCentsSnapshot).toBe(250_000);

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.CourseAccessBatchCreated, courseId } });
    expect(ev.userId).toBe(owner);
    expect(ev.payload).toEqual({ batchId, courseId, count: 120 }); // không có mã
    expect(JSON.stringify(ev.payload)).not.toMatch(/[2-9A-Z]{4}-[2-9A-Z]{4}/);
  });

  it("lô lớn nhất (10.000 mã) xong trong một lượt, đủ và không trùng", async () => {
    const owner = await makeUser("b-owner2@e.com");
    const courseId = await paidCourse(owner, "b-2");
    const t0 = Date.now();
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô lớn", count: ACCESS_CODE_BATCH_LIMIT });
    const ms = Date.now() - t0;
    expect(await prisma.courseAccessCode.count({ where: { batchId } })).toBe(ACCESS_CODE_BATCH_LIMIT);
    const distinct = await prisma.courseAccessCode.groupBy({ by: ["code"], where: { batchId } });
    expect(distinct).toHaveLength(ACCESS_CODE_BATCH_LIMIT);
    // Ngưỡng rộng, chỉ để bắt trường hợp hồi quy về cách chèn từng dòng (chậm cả chục giây).
    expect(ms).toBeLessThan(10_000);
  }, 30_000);

  it("đầu vào sai bị từ chối và không để lại lô nửa vời", async () => {
    const owner = await makeUser("b-owner3@e.com");
    const courseId = await paidCourse(owner, "b-3");
    const bad = [
      { label: "", count: 5 },
      { label: "   ", count: 5 },
      { label: "x".repeat(81), count: 5 },
      { label: "ok", count: 0 },
      { label: "ok", count: -3 },
      { label: "ok", count: 1.5 },
      { label: "ok", count: ACCESS_CODE_BATCH_LIMIT + 1 },
      { label: "ok", count: 5, note: "n".repeat(501) },
    ];
    for (const input of bad) {
      expect(await errCode(createAccessCodeBatch(courseId, owner, input))).toBe("validation_failed");
    }
    expect(await prisma.courseAccessCodeBatch.count({ where: { courseId } })).toBe(0);
    expect(await prisma.courseAccessCode.count({ where: { courseId } })).toBe(0);
  });

  it("khoá không tồn tại → course_not_found; khoá chỉ-link-mời → course_invite_only", async () => {
    const owner = await makeUser("b-owner4@e.com");
    expect(await errCode(createAccessCodeBatch("00000000-0000-4000-8000-000000000000", owner, { label: "x", count: 1 }))).toBe("course_not_found");
    const courseId = await paidCourse(owner, "b-4");
    await prisma.course.update({ where: { id: courseId }, data: { enrollMode: "invite_only", priceCents: null } });
    expect(await errCode(createAccessCodeBatch(courseId, owner, { label: "x", count: 1 }))).toBe("course_invite_only");
  });
});

describe("listAccessCodeBatches", () => {
  it("đếm theo trạng thái cho từng lô, mới nhất trước, và đếm riêng mã lẻ không thuộc lô", async () => {
    const owner = await makeUser("b-owner5@e.com");
    const buyer = await makeUser("b-buyer5@e.com");
    const courseId = await paidCourse(owner, "b-5");
    const a = await createAccessCodeBatch(courseId, owner, { label: "Lô A", count: 4 });
    const b = await createAccessCodeBatch(courseId, owner, { label: "Lô B", count: 3 });
    await prisma.courseAccessCode.create({ data: { courseId, code: "AAAA-BBBB-CCCC", createdBy: owner } }); // mã lẻ

    const aCodes = await prisma.courseAccessCode.findMany({ where: { batchId: a.batchId }, orderBy: { code: "asc" } });
    await redeemAccessCode(buyer, aCodes[0]!.code);
    await revokeAccessCode(courseId, aCodes[1]!.id);

    const r = await listAccessCodeBatches(courseId);
    expect(r.ungrouped).toBe(1);
    expect(r.batches.map((x) => x.label)).toEqual(["Lô B", "Lô A"]);
    expect(r.batches[0]).toMatchObject({ id: b.batchId, count: 3, stats: { unused: 3, redeemed: 0, revoked: 0 } });
    expect(r.batches[1]).toMatchObject({ id: a.batchId, count: 4, stats: { unused: 2, redeemed: 1, revoked: 1 } });
  });

  it("không lẫn lô của khoá khác", async () => {
    const owner = await makeUser("b-owner6@e.com");
    const c1 = await paidCourse(owner, "b-6a");
    const c2 = await paidCourse(owner, "b-6b");
    await createAccessCodeBatch(c1, owner, { label: "Của c1", count: 2 });
    expect((await listAccessCodeBatches(c2)).batches).toEqual([]);
  });
});

describe("listBatchCodes", () => {
  it("phân trang 50/trang, lọc theo trạng thái, kèm người đã dùng", async () => {
    const owner = await makeUser("b-owner7@e.com");
    const buyer = await makeUser("b-buyer7@e.com");
    const courseId = await paidCourse(owner, "b-7");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô", count: 120 });
    const first = await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } });
    await redeemAccessCode(buyer, first.code);

    const p1 = await listBatchCodes(courseId, batchId);
    expect(p1).toMatchObject({ total: 120, page: 1, pageSize: ACCESS_CODE_PAGE_SIZE });
    expect(p1.rows).toHaveLength(50);
    const p3 = await listBatchCodes(courseId, batchId, { page: 3 });
    expect(p3.rows).toHaveLength(20);
    const all = [...p1.rows, ...(await listBatchCodes(courseId, batchId, { page: 2 })).rows, ...p3.rows];
    expect(new Set(all.map((r) => r.id)).size).toBe(120); // không sót không trùng giữa các trang

    const redeemed = await listBatchCodes(courseId, batchId, { status: "redeemed" });
    expect(redeemed.total).toBe(1);
    expect(redeemed.rows[0]!.redeemedBy?.email).toBe("b-buyer7@e.com");
    expect((await listBatchCodes(courseId, batchId, { status: "unused" })).total).toBe(119);
    expect((await listBatchCodes(courseId, batchId, { page: 0 })).page).toBe(1); // trang bậy về trang 1
  });

  it("lô của khoá khác hoặc không tồn tại → batch_not_found", async () => {
    const owner = await makeUser("b-owner8@e.com");
    const c1 = await paidCourse(owner, "b-8a");
    const c2 = await paidCourse(owner, "b-8b");
    const { batchId } = await createAccessCodeBatch(c1, owner, { label: "Lô", count: 2 });
    expect(await errCode(listBatchCodes(c2, batchId))).toBe("batch_not_found");
    expect(await errCode(listBatchCodes(c1, "00000000-0000-4000-8000-000000000000"))).toBe("batch_not_found");
  });
});

describe("lookupAccessCode", () => {
  it("trả trạng thái, lô và người dùng; chấp nhận mã gõ thiếu gạch / chữ thường", async () => {
    const owner = await makeUser("b-owner9@e.com");
    const buyer = await makeUser("b-buyer9@e.com");
    const courseId = await paidCourse(owner, "b-9");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô tra cứu", count: 2 });
    const [c1, c2] = await prisma.courseAccessCode.findMany({ where: { batchId }, orderBy: { code: "asc" } });

    const unused = await lookupAccessCode(courseId, c1!.code.toLowerCase().replace(/-/g, " "));
    expect(unused).toMatchObject({ status: "unused", batch: { id: batchId, label: "Lô tra cứu" }, redeemedBy: null });

    await redeemAccessCode(buyer, c2!.code);
    const used = await lookupAccessCode(courseId, c2!.code);
    expect(used.status).toBe("redeemed");
    expect(used.redeemedBy?.email).toBe("b-buyer9@e.com");
    expect(used.redeemedAt).toBeInstanceOf(Date);
  });

  it("mã của khoá khác hoặc không có → code_not_found; mã rỗng → validation_failed", async () => {
    const owner = await makeUser("b-owner10@e.com");
    const c1 = await paidCourse(owner, "b-10a");
    const c2 = await paidCourse(owner, "b-10b");
    const { batchId } = await createAccessCodeBatch(c1, owner, { label: "Lô", count: 1 });
    const code = (await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } })).code;
    expect(await errCode(lookupAccessCode(c2, code))).toBe("code_not_found");
    expect(await errCode(lookupAccessCode(c1, "ZZZZ-ZZZZ-ZZZZ"))).toBe("code_not_found");
    expect(await errCode(lookupAccessCode(c1, "  "))).toBe("validation_failed");
  });
});

describe("exportBatchCodesCsv", () => {
  it("mặc định chỉ mã chưa dùng, UTF-8 BOM, cột STT/Mã; không đổi trạng thái mã", async () => {
    const owner = await makeUser("b-owner11@e.com");
    const buyer = await makeUser("b-buyer11@e.com");
    const courseId = await paidCourse(owner, "b-11");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Tái bản 2026 — đợt 1", count: 6 });
    const codes = await prisma.courseAccessCode.findMany({ where: { batchId }, orderBy: { code: "asc" } });
    await redeemAccessCode(buyer, codes[0]!.code);
    await revokeAccessCode(courseId, codes[1]!.id);

    const r = await exportBatchCodesCsv(courseId, batchId, owner);
    expect(r.count).toBe(4);
    expect(r.csv.startsWith("﻿STT,Mã\r\n")).toBe(true);
    const lines = r.csv.trim().split("\r\n");
    expect(lines).toHaveLength(5);
    expect(lines.slice(1).map((l) => l.split(",")[0])).toEqual(["1", "2", "3", "4"]);
    const exported = lines.slice(1).map((l) => l.split(",")[1]!);
    expect(exported.sort()).toEqual(codes.slice(2).map((c) => c.code).sort());
    expect(r.filename).toBe("ma-kich-hoat-Tai-ban-2026-dot-1.csv"); // bỏ dấu, an toàn cho tên file

    // xuất không đổi gì
    expect(await prisma.courseAccessCode.count({ where: { batchId, status: "unused" } })).toBe(4);

    const all = await exportBatchCodesCsv(courseId, batchId, owner, { scope: "all" });
    expect(all.count).toBe(6);
  });

  it("mỗi lần xuất ghi sự kiện với người xuất, chỉ id và số dòng — không mang mã", async () => {
    const owner = await makeUser("b-owner12@e.com");
    const other = await makeUser("b-other12@e.com");
    const courseId = await paidCourse(owner, "b-12");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô", count: 3 });
    await exportBatchCodesCsv(courseId, batchId, other);
    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.CourseAccessBatchExported, courseId } });
    expect(ev.userId).toBe(other);
    expect(ev.payload).toEqual({ batchId, courseId, count: 3 });
  });

  it("lô của khoá khác → batch_not_found, không xuất, không ghi sự kiện", async () => {
    const owner = await makeUser("b-owner13@e.com");
    const c1 = await paidCourse(owner, "b-13a");
    const c2 = await paidCourse(owner, "b-13b");
    const { batchId } = await createAccessCodeBatch(c1, owner, { label: "Lô", count: 2 });
    expect(await errCode(exportBatchCodesCsv(c2, batchId, owner))).toBe("batch_not_found");
    expect(await prisma.learningEvent.count({ where: { eventType: LearningEventType.CourseAccessBatchExported } })).toBe(0);
  });

  it("lô rỗng (mọi mã đã dùng) vẫn xuất được: chỉ có dòng tiêu đề", async () => {
    const owner = await makeUser("b-owner14@e.com");
    const buyer = await makeUser("b-buyer14@e.com");
    const courseId = await paidCourse(owner, "b-14");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô 1 mã", count: 1 });
    await redeemAccessCode(buyer, (await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } })).code);
    const r = await exportBatchCodesCsv(courseId, batchId, owner);
    expect(r.count).toBe(0);
    expect(r.csv).toBe("﻿STT,Mã\r\n");
  });
});

describe("revokeBatch", () => {
  it("thu hồi mọi mã chưa dùng trong một thao tác; mã đã dùng giữ nguyên và học viên không mất quyền", async () => {
    const owner = await makeUser("b-owner15@e.com");
    const buyer = await makeUser("b-buyer15@e.com");
    const courseId = await paidCourse(owner, "b-15");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "In sai", count: 10 });
    const first = await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } });
    await redeemAccessCode(buyer, first.code);

    expect(await revokeBatch(courseId, batchId, owner)).toEqual({ revoked: 9 });
    const stats = (await listAccessCodeBatches(courseId)).batches[0]!.stats;
    expect(stats).toEqual({ unused: 0, redeemed: 1, revoked: 9 });
    expect((await prisma.courseAccessCode.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("redeemed");
    expect(await prisma.enrollment.count({ where: { userId: buyer, courseId } })).toBe(1);

    // mã đã thu hồi không dùng được nữa
    const revoked = await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId, status: "revoked" } });
    const other = await makeUser("b-other15@e.com");
    expect(await errCode(redeemAccessCode(other, revoked.code))).toBe("code_revoked");

    const ev = await prisma.learningEvent.findFirstOrThrow({ where: { eventType: LearningEventType.CourseAccessBatchRevoked, courseId } });
    expect(ev.payload).toEqual({ batchId, courseId, count: 9 });
    // chạy lại không thu hồi thêm gì
    expect(await revokeBatch(courseId, batchId, owner)).toEqual({ revoked: 0 });
  });

  it("lô của khoá khác → batch_not_found và không đụng mã nào", async () => {
    const owner = await makeUser("b-owner16@e.com");
    const c1 = await paidCourse(owner, "b-16a");
    const c2 = await paidCourse(owner, "b-16b");
    const { batchId } = await createAccessCodeBatch(c1, owner, { label: "Lô", count: 3 });
    expect(await errCode(revokeBatch(c2, batchId, owner))).toBe("batch_not_found");
    expect(await prisma.courseAccessCode.count({ where: { batchId, status: "unused" } })).toBe(3);
  });
});

describe("mã thuộc lô vẫn là mã thường khi kích hoạt", () => {
  it("nhập mã trong lô → ghi danh, mã chuyển redeemed, số liệu lô cập nhật", async () => {
    const owner = await makeUser("b-owner17@e.com");
    const buyer = await makeUser("b-buyer17@e.com");
    const courseId = await paidCourse(owner, "b-17");
    const { batchId } = await createAccessCodeBatch(courseId, owner, { label: "Lô", count: 2 });
    const code = (await prisma.courseAccessCode.findFirstOrThrow({ where: { batchId } })).code;
    const r = await redeemAccessCode(buyer, code);
    expect(r.created).toBe(true);
    expect(r.codeConsumed).toBe(true);
    expect((await listAccessCodeBatches(courseId)).batches[0]!.stats).toEqual({ unused: 1, redeemed: 1, revoked: 0 });
  });
});
