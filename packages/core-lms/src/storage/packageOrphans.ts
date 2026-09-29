import { prisma, type PrismaClient } from "@feedbackme/db";
import { listScannableColumns, OrphanSweepError, scanColumnsForMatches } from "./orphans";

/**
 * Dọn gói SCORM/H5P mồ côi: gói còn nằm trong thư viện + trên đĩa nhưng không
 * bài học nào dùng nữa.
 *
 * Khác dọn file thường ở chỗ xoá gói là xoá THẬT DỮ LIỆU HỌC VIÊN: lượt học
 * (ScormAttempt/H5pAttempt) có onDelete: Cascade — mất tiến độ và điểm. Nên:
 * - "còn dùng" = id gói xuất hiện ở BẤT KỲ cột văn bản nào trong DB. Điều này gồm
 *   cả bài học lẫn bảng lượt học (cột packageId), nên gói đã có ai học thì
 *   không bao giờ bị chọn, kể cả khi bài học đã bị xoá.
 * - Loại 2 bảng gói và sổ ghi khỏi việc quét: id của chính nó nằm ở đó, không
 *   thì gói nào cũng tự "còn dùng".
 */

const EXCLUDED = [
  "ScormPackage",
  "H5pPackage",
  "StoredFile",
  "LearningEvent",
  "AuditLog",
  "_prisma_migrations",
];
const DAY = 24 * 60 * 60 * 1000;
const CHUNK = 200;

export interface OrphanPackage {
  type: "scorm" | "h5p";
  id: string;
  title: string;
  /** Dung lượng file zip (không phải dung lượng sau giải nén). */
  zipBytes: number;
  ageDays: number;
}

export interface PackageOrphanScan {
  orphans: OrphanPackage[];
  /** Số gói đủ cũ để xét. */
  eligible: number;
  referenced: number;
  /** Chưa đủ ngày (chưa xét). */
  tooRecent: number;
}

export async function findOrphanPackages(
  opts: { olderThanDays?: number; now?: Date } = {},
  db: PrismaClient = prisma,
): Promise<PackageOrphanScan> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - (opts.olderThanDays ?? 30) * DAY);
  const select = { id: true, title: true, sizeBytes: true, uploadedAt: true } as const;

  const [scorm, h5p, scormRecent, h5pRecent] = await Promise.all([
    db.scormPackage.findMany({ where: { uploadedAt: { lt: cutoff } }, select }),
    db.h5pPackage.findMany({ where: { uploadedAt: { lt: cutoff } }, select }),
    db.scormPackage.count({ where: { uploadedAt: { gte: cutoff } } }),
    db.h5pPackage.count({ where: { uploadedAt: { gte: cutoff } } }),
  ]);
  const candidates = [
    ...scorm.map((p) => ({ ...p, type: "scorm" as const })),
    ...h5p.map((p) => ({ ...p, type: "h5p" as const })),
  ];
  const tooRecent = scormRecent + h5pRecent;
  if (candidates.length === 0) return { orphans: [], eligible: 0, referenced: 0, tooRecent };

  const cols = await listScannableColumns(db, EXCLUDED);
  // Chốt chặn quét hỏng: nếu không thấy cả cột payload của nội dung bài học thì
  // danh sách cột sai (đổi schema, nhầm schema…) — thà dừng còn hơn tưởng không ai dùng.
  if (!cols.some((c) => c.table_name === "ContentItem" && c.column_name === "payload")) {
    throw new OrphanSweepError("reference_scan_failed");
  }

  const used = new Set<string>();
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const ids = candidates.slice(i, i + CHUNK).map((c) => c.id);
    const hits = await scanColumnsForMatches(db, cols, `(${ids.join("|")})`);
    for (const h of hits) used.add(h);
  }

  const orphans: OrphanPackage[] = [];
  let referenced = 0;
  for (const c of candidates) {
    if (used.has(c.id.toLowerCase())) {
      referenced++;
      continue;
    }
    orphans.push({
      type: c.type,
      id: c.id,
      title: c.title,
      zipBytes: c.sizeBytes,
      ageDays: Math.floor((now.getTime() - c.uploadedAt.getTime()) / DAY),
    });
  }
  return { orphans, eligible: candidates.length, referenced, tooRecent };
}

export interface PackageSweepResult extends Omit<PackageOrphanScan, "orphans"> {
  mode: "dry-run" | "apply";
  orphanCount: number;
  orphanZipBytes: number;
  deleted: number;
  failed: Array<{ id: string; error: string }>;
  sample: Array<{ type: string; id: string; title: string; zipBytes: number; ageDays: number }>;
}

export async function runPackageOrphanSweep(
  opts: { apply: boolean; olderThanDays?: number; maxDelete?: number; now?: Date },
  deleters: { scorm: (id: string) => Promise<void>; h5p: (id: string) => Promise<void> },
  db: PrismaClient = prisma,
): Promise<PackageSweepResult> {
  const { orphans, ...counts } = await findOrphanPackages(
    { olderThanDays: opts.olderThanDays, now: opts.now },
    db,
  );
  const result: PackageSweepResult = {
    ...counts,
    mode: opts.apply ? "apply" : "dry-run",
    orphanCount: orphans.length,
    orphanZipBytes: orphans.reduce((s, o) => s + o.zipBytes, 0),
    deleted: 0,
    failed: [],
    sample: orphans.slice(0, 10).map(({ type, id, title, zipBytes, ageDays }) => ({
      type,
      id,
      title,
      zipBytes,
      ageDays,
    })),
  };
  if (!opts.apply) return result;

  for (const o of orphans.slice(0, opts.maxDelete ?? 50)) {
    try {
      // Hàm xoá của từng loại tự từ chối nếu gói lại có người dùng ngay lúc này
      // (package_in_use / package_has_attempts) — lớp bảo vệ thứ hai sau lần quét.
      await deleters[o.type](o.id);
      result.deleted++;
    } catch (e) {
      result.failed.push({ id: o.id, error: (e as Error).message });
    }
  }
  return result;
}
