/**
 * Import hàng loạt LỚP HỌC của một khoá từ Excel/CSV. Hai bước, giống import thành viên:
 *   1. previewSectionImport — phân loại từng dòng, KHÔNG ghi gì.
 *   2. importCourseSections — thực thi; lỗi ở dòng nào chỉ hỏng dòng đó.
 *
 * Cột: Tên lớp | Kỳ học (chữ tự gõ) | Ghi chú. Chỉ Tên lớp là bắt buộc.
 * Mỗi dòng đi qua createCourseSection nên có đủ kiểm tra như tạo tay.
 */
import * as XLSX from "xlsx";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanGradeCourse } from "./authz";
import { CourseError } from "./courses";
import { createCourseSection } from "./sections";

/** Trần số dòng mỗi lần: mỗi dòng tạo một lớp tuần tự trong 1 request. */
export const SECTION_IMPORT_MAX_ROWS = 200;

export interface SectionImportInputRow {
  /** Số dòng trong file gốc (1-based, tính cả header) để báo lỗi cho người dùng. */
  line: number;
  name: string;
  termLabel?: string;
  note?: string;
}

export type SectionImportRowStatus =
  | "ok"
  | "missing_name"
  | "duplicate_in_file" // trùng tên với một dòng trước trong cùng file
  | "name_exists"; // tên đã có trong khoá

export interface SectionImportPreviewRow extends SectionImportInputRow {
  status: SectionImportRowStatus;
}

export interface SectionImportPreview {
  rows: SectionImportPreviewRow[];
  counts: Record<SectionImportRowStatus, number>;
  /** Số dòng sẽ thực sự tạo lớp. */
  actionable: number;
}

export interface SectionImportResult {
  created: number;
  /** Dòng bị bỏ qua hoặc lỗi lúc tạo (không dừng cả lô). */
  failed: Array<{ line: number; name: string; error: string }>;
}

export class SectionImportError extends Error {
  constructor(public readonly code: "too_many_rows" | "no_rows") {
    super(code);
  }
}

// ── Đọc file ──────────────────────────────────────────────────────────────

const FIELD_ORDER = ["name", "termLabel", "note"] as const;
type Field = (typeof FIELD_ORDER)[number];

const HEADERS: Record<Field, string[]> = {
  name: ["tên lớp", "tên lớp học", "ten lop", "lớp", "lớp học", "class", "class name", "name"],
  termLabel: ["kỳ học", "kì học", "học kỳ", "học kì", "ky hoc", "hoc ky", "term", "semester"],
  note: ["ghi chú", "ghi chu", "mô tả", "note", "notes"],
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Lấy các dòng từ mảng-của-mảng; nhận header theo tên cột, không có header thì theo thứ tự mặc định. */
function rowsFromMatrix(matrix: unknown[][]): SectionImportInputRow[] {
  const first = (matrix[0] ?? []).map(norm);
  const colOf: Partial<Record<Field, number>> = {};
  for (const f of FIELD_ORDER) {
    const idx = first.findIndex((c) => HEADERS[f].includes(c));
    if (idx >= 0) colOf[f] = idx;
  }
  const hasHeader = colOf.name !== undefined;
  const start = hasHeader ? 1 : 0;
  const col = (f: Field) => (hasHeader ? colOf[f] : FIELD_ORDER.indexOf(f));

  const out: SectionImportInputRow[] = [];
  for (let i = start; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const cell = (f: Field) => {
      const c = col(f);
      return c === undefined ? "" : String(r[c] ?? "").trim();
    };
    const row = {
      line: i + 1,
      name: cell("name"),
      termLabel: cell("termLabel") || undefined,
      note: cell("note") || undefined,
    };
    if (!row.name && !row.termLabel && !row.note) continue;
    out.push(row);
  }
  return out;
}

/** Đọc file .xlsx / .xls / .csv (sheet đầu tiên). */
export function parseSectionImportSheet(buf: Buffer): SectionImportInputRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return rowsFromMatrix(matrix);
}

/** File mẫu để tải về: dòng tiêu đề + 2 dòng ví dụ. */
export function generateSectionImportTemplateXlsx(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Tên lớp", "Kỳ học", "Ghi chú"],
    ["K65-CS1", "HK1 2026-27", "Học thứ 7 chiều"],
    ["K65-CS2", "HK1 2026-27", ""],
  ]);
  ws["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 36 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lớp học");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ── Xem trước / thực thi ──────────────────────────────────────────────────

async function classify(
  actorUserId: string,
  courseId: string,
  rows: SectionImportInputRow[],
  db: PrismaClient,
): Promise<SectionImportPreview> {
  await assertCanGradeCourse(actorUserId, courseId, db);
  if (rows.length === 0) throw new SectionImportError("no_rows");
  if (rows.length > SECTION_IMPORT_MAX_ROWS) throw new SectionImportError("too_many_rows");

  const existing = await db.courseSection.findMany({ where: { courseId }, select: { name: true } });
  const taken = new Set(existing.map((e: { name: string }) => e.name));

  const counts: Record<SectionImportRowStatus, number> = {
    ok: 0,
    missing_name: 0,
    duplicate_in_file: 0,
    name_exists: 0,
  };
  const seen = new Set<string>();
  const out = rows.map((r): SectionImportPreviewRow => {
    const name = r.name.trim();
    let status: SectionImportRowStatus = "ok";
    if (!name) status = "missing_name";
    else if (seen.has(name)) status = "duplicate_in_file";
    else if (taken.has(name)) status = "name_exists";
    if (name) seen.add(name);
    counts[status]++;
    return { ...r, name, status };
  });
  return { rows: out, counts, actionable: counts.ok };
}

export async function previewSectionImport(
  actorUserId: string,
  courseId: string,
  rows: SectionImportInputRow[],
  db: PrismaClient = prisma,
): Promise<SectionImportPreview> {
  return classify(actorUserId, courseId, rows, db);
}

export async function importCourseSections(
  actorUserId: string,
  courseId: string,
  rows: SectionImportInputRow[],
  db: PrismaClient = prisma,
): Promise<SectionImportResult> {
  // Phân loại lại ở server — không tin kết quả xem trước mà client gửi lên.
  const preview = await classify(actorUserId, courseId, rows, db);
  const failed: SectionImportResult["failed"] = [];
  let created = 0;
  for (const r of preview.rows) {
    if (r.status !== "ok") {
      failed.push({ line: r.line, name: r.name, error: r.status });
      continue;
    }
    try {
      await createCourseSection(actorUserId, courseId, { name: r.name, termLabel: r.termLabel, description: r.note }, db);
      created++;
    } catch (e) {
      failed.push({
        line: r.line,
        name: r.name,
        error: e instanceof CourseError ? e.code : "unknown_error",
      });
    }
  }
  return { created, failed };
}
