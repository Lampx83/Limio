import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { prisma } from "@feedbackme/db";
import {
  attributeStoredFiles,
  extractEntries,
  findOrphanPackages,
  getUserStorageUsageBytes,
  PackageLimitError,
  runPackageOrphanSweep,
} from "../index";
import { deleteScormPackage, ScormError, uploadScormPackage } from "../../scorm/scorm";
import { deleteH5pPackage, H5pError, uploadH5pPackage } from "../../h5p/h5p";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";

const BASE = "http://localhost:3000";
const OLD = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const root = mkdtempSync(path.join(tmpdir(), "fbm-pkg-test-"));
process.env.SCORM_STORAGE_ROOT = path.join(root, "scorm");
process.env.H5P_STORAGE_ROOT = path.join(root, "h5p");
afterAll(() => rmSync(root, { recursive: true, force: true }));

const MANIFEST = `<manifest><metadata><schemaversion>1.2</schemaversion></metadata>
<organizations default="o1"><organization identifier="o1"><title>Bài SCORM thử</title>
<item identifier="i1" identifierref="r1"><title>x</title></item></organization></organizations>
<resources><resource identifier="r1" href="index.html"/></resources></manifest>`;

// Đếm BYTE (không phải ký tự): manifest có chữ tiếng Việt nhiều byte.
const MANIFEST_BYTES = Buffer.byteLength(MANIFEST);

function scormZip(extra: Record<string, number> = { "index.html": 1000, "assets/a.bin": 5000 }) {
  const z = new AdmZip();
  z.addFile("imsmanifest.xml", Buffer.from(MANIFEST));
  for (const [name, size] of Object.entries(extra)) z.addFile(name, Buffer.alloc(size, 1));
  return z.toBuffer();
}
function h5pZip(extra: Record<string, number> = { "content/content.json": 800 }) {
  const z = new AdmZip();
  z.addFile("h5p.json", Buffer.from(JSON.stringify({ title: "H5P thử", mainLibrary: "H5P.Foo" })));
  for (const [name, size] of Object.entries(extra)) z.addFile(name, Buffer.alloc(size, 1));
  return z.toBuffer();
}

async function user(name: string) {
  return registerUser(
    { email: `u-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    BASE,
  );
}
async function courseWithLesson(ownerId: string) {
  const c = await createCourse(ownerId, { title: "K", description: "x" });
  const m = await createModule(ownerId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(ownerId, m.moduleId, { title: "L", orderIndex: 0 });
  return { courseId: c.courseId, lessonId: l.lessonId };
}
const useIn = (lessonId: string, type: "scorm" | "h5p", packageId: string) =>
  prisma.contentItem.create({ data: { lessonId, type, orderIndex: 0, payload: { packageId } } });
const ledgerRow = (kind: string, id: string) =>
  prisma.storedFile.findUnique({ where: { layer_key: { layer: "package", key: `${kind}/${id}` } } });

beforeEach(() => {
  process.env.SCORM_STORAGE_ROOT = path.join(root, "scorm");
  process.env.H5P_STORAGE_ROOT = path.join(root, "h5p");
});

describe("upload gói: giới hạn giải nén", () => {
  it("gói hợp lệ: ghi vào sổ theo dung lượng SAU giải nén, tính cho người upload", async () => {
    const u = await user("Up");
    const zip = scormZip();
    const pkg = await uploadScormPackage(u.userId, zip, "a.zip");

    const row = await ledgerRow("scorm", pkg.id);
    expect(row?.kind).toBe("scorm_package");
    // manifest + 1000 + 5000 byte thật đã giải nén — lớn hơn kích thước file zip đã nén.
    expect(Number(row!.sizeBytes)).toBe(MANIFEST_BYTES + 6000);
    expect(Number(row!.sizeBytes)).toBeGreaterThan(zip.length);
    expect(await getUserStorageUsageBytes(u.userId)).toBe(MANIFEST_BYTES + 6000);
    expect(existsSync(path.join(process.env.SCORM_STORAGE_ROOT!, pkg.id, "index.html"))).toBe(true);
  });

  it("zip 'phình' bị từ chối TRƯỚC khi ghi DB hay ghi đĩa", async () => {
    const u = await user("Up");
    const zip = scormZip({ "big.bin": 5000 });
    await expect(
      uploadScormPackage(u.userId, zip, "b.zip", prisma, { limits: { maxUnpackedBytes: 1000, maxFiles: 100 } }),
    ).rejects.toMatchObject({ code: "package_unpacked_too_large" });
    expect(await prisma.scormPackage.count()).toBe(0);
    expect(await prisma.storedFile.count({ where: { layer: "package" } })).toBe(0);
  });

  it("quá nhiều file bị từ chối (H5P)", async () => {
    const u = await user("Up");
    const zip = h5pZip({ "a.txt": 1, "b.txt": 1, "c.txt": 1 });
    await expect(
      uploadH5pPackage(u.userId, zip, "c.zip", prisma, { limits: { maxUnpackedBytes: 1e9, maxFiles: 2 } }),
    ).rejects.toBeInstanceOf(H5pError);
    expect(await prisma.h5pPackage.count()).toBe(0);
  });

  it("ghi đĩa lỗi giữa chừng: không để lại dòng DB lẫn dòng sổ", async () => {
    const u = await user("Up");
    // Gốc lưu trữ là một FILE thường → mkdir thất bại (ENOTDIR).
    const blocker = path.join(root, "blocker");
    writeFileSync(blocker, "x");
    process.env.SCORM_STORAGE_ROOT = blocker;
    await expect(uploadScormPackage(u.userId, scormZip(), "d.zip")).rejects.toThrow();
    expect(await prisma.scormPackage.count()).toBe(0);
    expect(await prisma.storedFile.count({ where: { layer: "package" } })).toBe(0);
  });
});

describe("extractEntries (đếm dung lượng THẬT, không tin khai báo)", () => {
  const fake = (name: string, declared: number, real: number) => ({
    entryName: name,
    isDirectory: false,
    header: { size: declared },
    getData: () => Buffer.alloc(real, 1),
  });

  it("khai báo nhỏ nhưng dữ liệu thật lớn → vẫn bị chặn", async () => {
    const dir = path.join(root, "lie");
    await expect(
      extractEntries({
        entries: [fake("a.bin", 10, 5000)],
        stripPrefix: "",
        targetDir: dir,
        limits: { maxUnpackedBytes: 1000, maxFiles: 10 },
      }),
    ).rejects.toBeInstanceOf(PackageLimitError);
  });

  it("tên file lách thư mục ('../', đường dẫn tuyệt đối) không ghi ra ngoài thư mục gói", async () => {
    const dir = path.join(root, "trav", "pkg");
    const r = await extractEntries({
      entries: [fake("../evil.txt", 1, 1), fake("/abs/evil2.txt", 1, 1), fake("ok/a.txt", 1, 1)],
      stripPrefix: "",
      targetDir: dir,
    });
    expect(existsSync(path.join(root, "trav", "evil.txt"))).toBe(false);
    expect(existsSync(path.join(dir, "ok", "a.txt"))).toBe(true);
    // Chỉ ok/a.txt được ghi: tên "../" và tên tuyệt đối đều bị bỏ qua hẳn.
    expect(r.files).toBe(1);
    expect(existsSync("/abs/evil2.txt")).toBe(false);
  });
});

describe("xoá gói: chặn khi còn người dùng", () => {
  it("SCORM: đang được bài học dùng thì KHÔNG xoá; gỡ khỏi bài rồi mới xoá được, và sổ được trả lại", async () => {
    const owner = await user("Owner");
    const { lessonId } = await courseWithLesson(owner.userId);
    const pkg = await uploadScormPackage(owner.userId, scormZip(), "e.zip");
    const dir = path.join(process.env.SCORM_STORAGE_ROOT!, pkg.id);
    const item = await useIn(lessonId, "scorm", pkg.id);

    await expect(deleteScormPackage(pkg.id)).rejects.toMatchObject({ code: "package_in_use" });
    expect(existsSync(dir)).toBe(true);
    expect(await prisma.scormPackage.count({ where: { id: pkg.id } })).toBe(1);

    await prisma.contentItem.delete({ where: { id: item.id } });
    await deleteScormPackage(pkg.id);
    expect(existsSync(dir)).toBe(false);
    expect((await ledgerRow("scorm", pkg.id))?.deletedAt).not.toBeNull();
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(0);
  });

  it("SCORM: đã có học viên học thì KHÔNG xoá (xoá sẽ kéo theo mất điểm và tiến độ)", async () => {
    const owner = await user("Owner");
    const learner = await user("Learner");
    const pkg = await uploadScormPackage(owner.userId, scormZip(), "f.zip");
    await prisma.scormAttempt.create({ data: { packageId: pkg.id, userId: learner.userId } });

    const err = await deleteScormPackage(pkg.id).catch((e) => e);
    expect(err).toBeInstanceOf(ScormError);
    expect(err.code).toBe("package_has_attempts");
    expect(await prisma.scormAttempt.count({ where: { packageId: pkg.id } })).toBe(1);
  });

  it("H5P: cùng quy tắc (đang dùng / có lượt học)", async () => {
    const owner = await user("Owner");
    const learner = await user("Learner");
    const { lessonId } = await courseWithLesson(owner.userId);
    const a = await uploadH5pPackage(owner.userId, h5pZip(), "g.zip");
    await useIn(lessonId, "h5p", a.id);
    await expect(deleteH5pPackage(a.id)).rejects.toMatchObject({ code: "package_in_use" });

    const b = await uploadH5pPackage(owner.userId, h5pZip(), "h.zip");
    await prisma.h5pAttempt.create({ data: { packageId: b.id, userId: learner.userId } });
    await expect(deleteH5pPackage(b.id)).rejects.toMatchObject({ code: "package_has_attempts" });

    const c = await uploadH5pPackage(owner.userId, h5pZip(), "i.zip");
    await deleteH5pPackage(c.id);
    expect(await prisma.h5pPackage.count({ where: { id: c.id } })).toBe(0);
  });
});

describe("D1: gói do đồng giảng upload tính cho chủ khoá", () => {
  it("sau khi bài học dùng gói, dung lượng chuyển từ người upload sang chủ khoá", async () => {
    const owner = await user("Owner");
    const co = await user("Co");
    const { courseId, lessonId } = await courseWithLesson(owner.userId);
    await prisma.courseInstructor.create({ data: { courseId, userId: co.userId, role: "co-instructor" } });

    const pkg = await uploadScormPackage(co.userId, scormZip(), "j.zip");
    const size = MANIFEST_BYTES + 6000;
    expect(await getUserStorageUsageBytes(co.userId)).toBe(size);

    await useIn(lessonId, "scorm", pkg.id);
    await attributeStoredFiles();
    expect(await getUserStorageUsageBytes(co.userId)).toBe(0);
    expect(await getUserStorageUsageBytes(owner.userId)).toBe(size);
    expect((await ledgerRow("scorm", pkg.id))?.courseId).toBe(courseId);
  });
});

describe("dọn gói mồ côi", () => {
  async function seed() {
    const owner = await user("Owner");
    const learner = await user("Learner");
    const { lessonId } = await courseWithLesson(owner.userId);
    const mk = async (kind: "scorm" | "h5p") => {
      const p =
        kind === "scorm"
          ? await uploadScormPackage(owner.userId, scormZip(), "x.zip")
          : await uploadH5pPackage(owner.userId, h5pZip(), "x.zip");
      const table = kind === "scorm" ? prisma.scormPackage : prisma.h5pPackage;
      await (table as typeof prisma.scormPackage).update({ where: { id: p.id }, data: { uploadedAt: OLD } });
      return p.id;
    };
    const used = await mk("scorm");
    await useIn(lessonId, "scorm", used);
    const hasAttempt = await mk("scorm");
    await prisma.scormAttempt.create({ data: { packageId: hasAttempt, userId: learner.userId } });
    const orphanScorm = await mk("scorm");
    const orphanH5p = await mk("h5p");
    // Gói mới, chưa ai dùng: chưa đủ ngày nên chưa xét.
    const young = (await uploadScormPackage(owner.userId, scormZip(), "y.zip")).id;
    return { used, hasAttempt, orphanScorm, orphanH5p, young };
  }
  const deleters = { scorm: (id: string) => deleteScormPackage(id), h5p: (id: string) => deleteH5pPackage(id) };

  it("chỉ chọn gói KHÔNG bài học dùng, KHÔNG học viên học, và đủ cũ", async () => {
    const s = await seed();
    const scan = await findOrphanPackages();
    expect(scan.orphans.map((o) => o.id).sort()).toEqual([s.orphanScorm, s.orphanH5p].sort());
    expect(scan.referenced).toBe(2);
    expect(scan.tooRecent).toBe(1);
  });

  it("chạy thử: không xoá gì", async () => {
    const s = await seed();
    const r = await runPackageOrphanSweep({ apply: false }, deleters);
    expect(r).toMatchObject({ mode: "dry-run", orphanCount: 2, deleted: 0 });
    expect(await prisma.scormPackage.count({ where: { id: s.orphanScorm } })).toBe(1);
    expect(existsSync(path.join(process.env.SCORM_STORAGE_ROOT!, s.orphanScorm))).toBe(true);
  });

  it("xoá thật: xoá gói mồ côi + thư mục + trả sổ; giữ nguyên gói đang dùng, gói có lượt học, gói mới", async () => {
    const s = await seed();
    const r = await runPackageOrphanSweep({ apply: true }, deleters);
    expect(r).toMatchObject({ mode: "apply", deleted: 2, failed: [] });

    expect(await prisma.scormPackage.count({ where: { id: s.orphanScorm } })).toBe(0);
    expect(await prisma.h5pPackage.count({ where: { id: s.orphanH5p } })).toBe(0);
    expect(existsSync(path.join(process.env.SCORM_STORAGE_ROOT!, s.orphanScorm))).toBe(false);
    expect((await ledgerRow("scorm", s.orphanScorm))?.deletedAt).not.toBeNull();

    for (const id of [s.used, s.hasAttempt, s.young]) {
      expect(await prisma.scormPackage.count({ where: { id } })).toBe(1);
      expect(existsSync(path.join(process.env.SCORM_STORAGE_ROOT!, id))).toBe(true);
    }
    expect(await prisma.scormAttempt.count({ where: { packageId: s.hasAttempt } })).toBe(1);
  });

  it("trần maxDelete và một gói xoá lỗi không chặn gói còn lại", async () => {
    await seed();
    const capped = await runPackageOrphanSweep({ apply: true, maxDelete: 1 }, deleters);
    expect(capped.deleted).toBe(1);

    await seed();
    const failing = {
      scorm: async () => {
        throw new Error("EACCES");
      },
      h5p: (id: string) => deleteH5pPackage(id),
    };
    const r = await runPackageOrphanSweep({ apply: true }, failing);
    expect(r.failed.length).toBeGreaterThanOrEqual(1);
    expect(r.failed[0]!.error).toBe("EACCES");
    expect(r.deleted).toBeGreaterThanOrEqual(1);
  });
});
