import { prisma, type PrismaClient } from "@feedbackme/db";
import type { StoredFileKind } from "./ledger";

/**
 * Dọn file mồ côi: file còn trên đĩa nhưng không còn nội dung nào dùng tới
 * (vd đã xoá bài giảng, hoặc upload xong không lưu).
 *
 * Xoá file là KHÔNG HOÀN TÁC, nên mọi quyết định ở đây nghiêng về "giữ lại":
 * - Chỉ xét loại file nằm trong SWEEPABLE_KINDS (avatar, logo, ảnh giám sát thi…
 *   có đường quản lý riêng, không đụng).
 * - Chỉ xét file không đổi trong `olderThanDays` ngày — che trường hợp giảng
 *   viên upload rồi chưa kịp lưu bài (khi upload, bài học chưa tồn tại).
 * - "Có người dùng" = tên file (phần `<thời gian>-<mã>.<đuôi>`) xuất hiện ở BẤT KỲ
 *   cột văn bản/JSON nào trong DB, không chỉ vài nơi đã biết. Lý do: ảnh nhúng
 *   trong câu hỏi, mô tả khoá, ghi chú… đều là tham chiếu thật. Sai theo hướng
 *   "tưởng có người dùng" chỉ khiến file ở lại lâu hơn; sai ngược lại là mất dữ liệu.
 * - Tên file không có dạng nhận dạng được thì bỏ qua (không đoán).
 * - Dừng hẳn nếu quét ra 0 tham chiếu trong khi có file cần xét: gần như chắc
 *   chắn là quét hỏng, không phải "không ai dùng gì cả".
 */

export const SWEEPABLE_KINDS: StoredFileKind[] = [
  "lesson_video",
  "lesson_audio",
  "lesson_image",
  "lesson_pdf",
  "lesson_html",
  "lesson_file",
  "lesson_transcript",
  "submission",
  "exam_asset",
  "oral_material",
  "whiteboard_page",
  "board_attachment",
  "live_slide",
  "live_resource",
];

// Bảng lịch sử (sự kiện, nhật ký): nhắc tới file không có nghĩa là còn dùng file.
// Loại ra để đường dẫn trong sự kiện cũ không giữ file mồ côi ở lại mãi.
const HISTORY_TABLES = ["LearningEvent", "AuditLog"];

// Phần đuôi tên file do các route upload sinh: `<unixMs>-<hex>.<ext>`. Đủ
// ngẫu nhiên để coi là duy nhất; dùng phần đuôi (thay vì cả tên) để chịu được
// mọi kiểu tiền tố mà từng route đặt.
const REF_TOKEN = String.raw`(\d{10,}-[A-Za-z0-9]+\.[A-Za-z0-9]+)`;
const LEAF_TOKEN = new RegExp(String.raw`${REF_TOKEN}$`);

export class OrphanSweepError extends Error {
  constructor(public readonly code: "reference_scan_empty" | "reference_scan_failed") {
    super(code);
  }
}

function quoteIdent(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export interface ScanColumn {
  table_name: string;
  column_name: string;
}

/**
 * Mọi cột văn bản/JSON của các bảng thật trong DB, trừ các bảng loại ra. Dùng
 * chung cho mọi job dọn để "còn ai dùng không" luôn được trả lời cùng một cách.
 */
export async function listScannableColumns(
  db: PrismaClient,
  excludeTables: string[],
): Promise<ScanColumn[]> {
  return db.$queryRaw<ScanColumn[]>`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'jsonb', 'json', 'ARRAY')
      AND c.table_name <> ALL(${excludeTables}::text[])`;
}

/**
 * Các chuỗi khớp `pattern` (regex Postgres, đúng 1 nhóm bắt) trong các cột đã
 * chọn, chữ thường.
 */
export async function scanColumnsForMatches(
  db: PrismaClient,
  cols: ScanColumn[],
  pattern: string,
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const { table_name, column_name } of cols) {
    // Định danh lấy từ danh mục hệ thống rồi mới quote — không có đầu vào người dùng.
    const rows = await db.$queryRawUnsafe<Array<{ ref: string }>>(
      `SELECT DISTINCT lower(m[1]) AS ref
       FROM ${quoteIdent(table_name)} t,
            regexp_matches(t.${quoteIdent(column_name)}::text, $1, 'g') AS m`,
      pattern,
    );
    for (const r of rows) found.add(r.ref);
  }
  return found;
}

/** Mọi token tên file xuất hiện trong các cột văn bản/JSON của DB (chữ thường). */
export async function collectReferencedTokens(db: PrismaClient = prisma): Promise<Set<string>> {
  const cols = await listScannableColumns(db, [
    ...HISTORY_TABLES,
    "StoredFile",
    "_prisma_migrations",
  ]);
  return scanColumnsForMatches(db, cols, REF_TOKEN);
}

export interface OrphanCandidate {
  id: string;
  layer: string;
  key: string;
  kind: string;
  sizeBytes: number;
  ageDays: number;
}

export interface OrphanScan {
  orphans: OrphanCandidate[];
  /** Tổng số file đủ điều kiện xét (đúng loại, đủ cũ). */
  eligible: number;
  referenced: number;
  /** Đủ điều kiện nhưng tên file không nhận dạng được → không đụng. */
  unverifiable: number;
  /** File chưa đủ `olderThanDays` ngày — chưa xét. */
  tooRecent: number;
  referencedTokens: number;
}

const DAY = 24 * 60 * 60 * 1000;

export async function findOrphanedFiles(
  opts: { olderThanDays?: number; limit?: number; now?: Date } = {},
  db: PrismaClient = prisma,
): Promise<OrphanScan> {
  const days = opts.olderThanDays ?? 30;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - days * DAY);

  const base = { deletedAt: null, layer: { not: "tmp" }, kind: { in: SWEEPABLE_KINDS as string[] } };
  const [rows, tooRecent] = await Promise.all([
    // updatedAt (không phải createdAt): ghi đè cùng key làm file "mới" trở lại.
    db.storedFile.findMany({
      where: { ...base, updatedAt: { lt: cutoff } },
      select: { id: true, layer: true, key: true, kind: true, sizeBytes: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
    }),
    db.storedFile.count({ where: { ...base, updatedAt: { gte: cutoff } } }),
  ]);

  const tokens = await collectReferencedTokens(db);
  if (rows.length > 0 && tokens.size === 0) throw new OrphanSweepError("reference_scan_empty");

  const orphans: OrphanCandidate[] = [];
  let referenced = 0;
  let unverifiable = 0;
  for (const r of rows) {
    const leaf = r.key.slice(r.key.lastIndexOf("/") + 1);
    const token = LEAF_TOKEN.exec(leaf)?.[1]?.toLowerCase();
    if (!token) {
      unverifiable++;
      continue;
    }
    if (tokens.has(token)) {
      referenced++;
      continue;
    }
    orphans.push({
      id: r.id,
      layer: r.layer,
      key: r.key,
      kind: r.kind,
      sizeBytes: Number(r.sizeBytes),
      ageDays: Math.floor((now.getTime() - r.updatedAt.getTime()) / DAY),
    });
  }

  return {
    orphans: orphans.slice(0, opts.limit ?? Number.MAX_SAFE_INTEGER),
    eligible: rows.length,
    referenced,
    unverifiable,
    tooRecent,
    referencedTokens: tokens.size,
  };
}

export interface OrphanSweepResult extends Omit<OrphanScan, "orphans"> {
  mode: "dry-run" | "apply";
  /** Tổng số file mồ côi tìm thấy (chưa bị cắt theo maxDelete). */
  orphanCount: number;
  orphanBytes: number;
  deleted: number;
  freedBytes: number;
  failed: Array<{ key: string; error: string }>;
  /** Mẫu vài file (để xem nhanh trong log). */
  sample: Array<{ key: string; kind: string; sizeBytes: number; ageDays: number }>;
}

/**
 * Quét rồi (nếu `apply`) xoá. `deleteFile` do tầng gọi cung cấp (adapter lưu
 * trữ thật) để module này không phụ thuộc apps/web; adapter đã bọc sổ nên tự
 * đánh dấu `deletedAt` cho từng file xoá được.
 */
export async function runOrphanSweep(
  opts: { apply: boolean; olderThanDays?: number; maxDelete?: number; now?: Date },
  deleteFile: (layer: string, key: string) => Promise<void>,
  db: PrismaClient = prisma,
): Promise<OrphanSweepResult> {
  const scan = await findOrphanedFiles({ olderThanDays: opts.olderThanDays, now: opts.now }, db);
  const maxDelete = opts.maxDelete ?? 500;
  const { orphans, ...counts } = scan;

  const result: OrphanSweepResult = {
    ...counts,
    mode: opts.apply ? "apply" : "dry-run",
    orphanCount: orphans.length,
    orphanBytes: orphans.reduce((s, o) => s + o.sizeBytes, 0),
    deleted: 0,
    freedBytes: 0,
    failed: [],
    sample: orphans.slice(0, 10).map((o) => ({
      key: `${o.layer}/${o.key}`,
      kind: o.kind,
      sizeBytes: o.sizeBytes,
      ageDays: o.ageDays,
    })),
  };
  if (!opts.apply) return result;

  // Một lỗi ở 1 file không được chặn phần còn lại; trần maxDelete giới hạn thiệt
  // hại nếu logic tham chiếu có lỗi mà test chưa bắt được.
  for (const o of orphans.slice(0, maxDelete)) {
    try {
      await deleteFile(o.layer, o.key);
      result.deleted++;
      result.freedBytes += o.sizeBytes;
    } catch (e) {
      result.failed.push({ key: `${o.layer}/${o.key}`, error: (e as Error).message });
    }
  }
  return result;
}
