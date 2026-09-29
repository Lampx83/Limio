import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import {
  findOrphanedFiles,
  OrphanSweepError,
  recordStoredFile,
  runOrphanSweep,
} from "../index";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";

const BASE = "http://localhost:3000";
const OLD = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

let seq = 0;
/** Tên file đúng dạng route upload sinh: <userId>-<unixMs>-<hex>.<ext> */
function name(uid: string, ext = "mp4") {
  seq++;
  return `${uid}-${1790000000000 + seq}-${seq.toString(16).padStart(8, "a")}.${ext}`;
}

async function owner() {
  return registerUser(
    { email: `o-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: "Owner" },
    BASE,
  );
}

async function course(userId: string, description = "x") {
  const c = await createCourse(userId, { title: "K", description });
  const m = await createModule(userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(userId, m.moduleId, { title: "L", orderIndex: 0 });
  return { ...c, lessonId: l.lessonId };
}

async function stored(layer: string, key: string, opts: { old?: boolean; size?: number } = {}) {
  await recordStoredFile({ layer, key, sizeBytes: opts.size ?? 1000 });
  if (opts.old !== false) {
    await prisma.storedFile.updateMany({ where: { layer, key }, data: { updatedAt: OLD } });
  }
}

/** Một file "đang được dùng" để quét luôn có ít nhất một tham chiếu (tránh chốt chặn quét-rỗng). */
async function anchor(userId: string) {
  const c = await course(userId);
  const f = name(userId, "png");
  await stored("public", `lesson-media/images/2026/06/${f}`);
  await prisma.contentItem.create({
    data: { lessonId: c.lessonId, type: "file", orderIndex: 0, payload: { url: `/api/lesson-media/images/${f}` } },
  });
  return c;
}

describe("dọn file mồ côi — quyết định giữ/xoá", () => {
  it("file mồ côi (cũ, không ai dùng) bị chọn; file còn được bài giảng dùng thì giữ", async () => {
    const u = await owner();
    const c = await course(u.userId);
    const used = name(u.userId);
    const orphan = name(u.userId);
    await stored("public", `lesson-media/videos/2026/06/${used}`);
    await stored("public", `lesson-media/videos/2026/06/${orphan}`, { size: 5000 });
    await prisma.contentItem.create({
      data: { lessonId: c.lessonId, type: "video", orderIndex: 0, payload: { url: `/api/lesson-media/videos/${used}` } },
    });

    const scan = await findOrphanedFiles();
    expect(scan.orphans.map((o) => o.key)).toEqual([`lesson-media/videos/2026/06/${orphan}`]);
    expect(scan.orphans[0]!.sizeBytes).toBe(5000);
    expect(scan.referenced).toBe(1);
  });

  it("xoá mục nội dung khỏi bài giảng → file của nó trở thành mồ côi", async () => {
    const u = await owner();
    const c = await course(u.userId);
    const f = name(u.userId);
    await stored("public", `lesson-media/videos/2026/06/${f}`);
    const item = await prisma.contentItem.create({
      data: { lessonId: c.lessonId, type: "video", orderIndex: 0, payload: { url: `/api/lesson-media/videos/${f}` } },
    });
    await anchor(u.userId);

    expect((await findOrphanedFiles()).orphans).toHaveLength(0);
    await prisma.contentItem.delete({ where: { id: item.id } });
    expect((await findOrphanedFiles()).orphans.map((o) => o.key)).toEqual([`lesson-media/videos/2026/06/${f}`]);
  });

  it("tham chiếu ở NƠI BẤT KỲ đều giữ file, kể cả cột chưa từng được liệt kê (mô tả khoá học)", async () => {
    const u = await owner();
    const f = name(u.userId, "png");
    await stored("public", `lesson-media/images/2026/06/${f}`);
    await course(u.userId, `<p>Xem <img src="/api/lesson-media/images/${f}"></p>`);
    await anchor(u.userId);

    expect((await findOrphanedFiles()).orphans).toHaveLength(0);
  });

  it("file mới (chưa đủ số ngày chờ) không bị xét, dù chưa ai dùng — che trường hợp upload rồi chưa lưu bài", async () => {
    const u = await owner();
    await anchor(u.userId);
    const f = name(u.userId);
    await stored("public", `lesson-media/videos/2026/09/${f}`, { old: false });

    const scan = await findOrphanedFiles();
    expect(scan.orphans).toHaveLength(0);
    expect(scan.tooRecent).toBe(1);
  });

  it("ghi đè cùng key làm file 'mới' trở lại (tính theo lần ghi cuối, không theo lần đầu)", async () => {
    const u = await owner();
    await anchor(u.userId);
    const key = `lesson-media/videos/2026/06/${name(u.userId)}`;
    await stored("public", key);
    expect((await findOrphanedFiles()).orphans).toHaveLength(1);
    await recordStoredFile({ layer: "public", key, sizeBytes: 2000 }); // ghi đè
    expect((await findOrphanedFiles()).orphans).toHaveLength(0);
  });

  it("loại file không thuộc diện dọn (avatar, ảnh giám sát thi, tmp) thì không bao giờ bị chọn", async () => {
    const u = await owner();
    await anchor(u.userId);
    await stored("public", `avatars/${u.userId}/${name(u.userId, "png")}`);
    await stored("private", `proctor-snapshots/2026/06/${name(u.userId, "jpg")}`);
    await stored("tmp", `2026-06-01/s/${name(u.userId, "png")}`);

    const scan = await findOrphanedFiles();
    expect(scan.orphans).toHaveLength(0);
    expect(scan.eligible).toBe(1); // chỉ file anchor
  });

  it("tên file không nhận dạng được thì bỏ qua, không đoán", async () => {
    const u = await owner();
    await anchor(u.userId);
    await stored("public", "lesson-media/videos/2026/06/ten-tu-dat.mp4");

    const scan = await findOrphanedFiles();
    expect(scan.orphans).toHaveLength(0);
    expect(scan.unverifiable).toBe(1);
  });

  it("nhắc tới trong bảng lịch sử (nhật ký) KHÔNG giữ file lại", async () => {
    const u = await owner();
    await anchor(u.userId);
    const f = name(u.userId);
    await stored("public", `lesson-media/videos/2026/06/${f}`);
    await prisma.auditLog.create({ data: { action: "x", payload: { url: `/api/lesson-media/videos/${f}` } } });

    expect((await findOrphanedFiles()).orphans).toHaveLength(1);
  });

  it("dừng hẳn khi quét ra 0 tham chiếu mà có file cần xét (dấu hiệu quét hỏng)", async () => {
    // Không tạo user/khoá nào: email/tài khoản sinh ra cũng có thể khớp mẫu token
    // (an toàn — chỉ giữ file nhiều hơn), làm mất tính "rỗng" của DB.
    await stored("public", `lesson-media/videos/2026/06/${name("11111111-2222-4333-8444-555555555555")}`);
    await expect(findOrphanedFiles()).rejects.toBeInstanceOf(OrphanSweepError);
  });

  it("file đã đánh dấu xoá không bị xét lại", async () => {
    const u = await owner();
    await anchor(u.userId);
    const key = `lesson-media/videos/2026/06/${name(u.userId)}`;
    await stored("public", key);
    await prisma.storedFile.updateMany({ where: { key }, data: { deletedAt: new Date() } });
    expect((await findOrphanedFiles()).orphans).toHaveLength(0);
  });
});

describe("runOrphanSweep — chạy thử vs xoá thật", () => {
  async function seed(n: number) {
    const u = await owner();
    await anchor(u.userId);
    const keys: string[] = [];
    for (let i = 0; i < n; i++) {
      const k = `lesson-media/videos/2026/06/${name(u.userId)}`;
      await stored("public", k, { size: 100 });
      keys.push(k);
    }
    return keys;
  }

  it("chạy thử: báo cáo đủ nhưng KHÔNG gọi xoá file nào", async () => {
    await seed(3);
    const del = vi.fn().mockResolvedValue(undefined);
    const r = await runOrphanSweep({ apply: false }, del);
    expect(r).toMatchObject({ mode: "dry-run", orphanCount: 3, orphanBytes: 300, deleted: 0 });
    expect(del).not.toHaveBeenCalled();
    expect(r.sample).toHaveLength(3);
  });

  it("xoá thật: chỉ xoá file mồ côi, không đụng file đang dùng", async () => {
    const keys = await seed(2);
    const del = vi.fn().mockResolvedValue(undefined);
    const r = await runOrphanSweep({ apply: true }, del);
    expect(r).toMatchObject({ mode: "apply", deleted: 2, freedBytes: 200, failed: [] });
    expect(del.mock.calls.map((c) => c[1]).sort()).toEqual([...keys].sort());
  });

  it("trần maxDelete giới hạn số file xoá mỗi lần", async () => {
    await seed(5);
    const del = vi.fn().mockResolvedValue(undefined);
    const r = await runOrphanSweep({ apply: true, maxDelete: 2 }, del);
    expect(r.orphanCount).toBe(5);
    expect(r.deleted).toBe(2);
    expect(del).toHaveBeenCalledTimes(2);
  });

  it("một file xoá lỗi không chặn phần còn lại, và được báo trong kết quả", async () => {
    const keys = await seed(3);
    const del = vi.fn().mockImplementation(async (_l: string, k: string) => {
      if (k === keys[0]) throw new Error("EACCES");
    });
    const r = await runOrphanSweep({ apply: true }, del);
    expect(r.deleted).toBe(2);
    expect(r.failed).toEqual([{ key: `public/${keys[0]}`, error: "EACCES" }]);
  });
});
