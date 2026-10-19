/**
 * Đọc bảng giáo viên dán từ Excel / Google Sheets (tab), hoặc CSV (; hay ,).
 * Dòng đầu là tiêu đề cột; cột được nhận theo TÊN (bỏ dấu, không phân biệt hoa
 * thường), nên thứ tự cột tuỳ ý và cột lạ bị bỏ qua.
 */

/** Bỏ dấu, hạ chữ thường, gộp mọi ký tự không phải chữ/số thành một dấu cách. */
export const normHeader = (h: string) =>
  h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Tên cột chấp nhận cho thông tin một người (đã chuẩn hoá bằng normHeader). */
export const PERSON_HEADERS = {
  displayName: ["ho ten", "ho va ten", "ten", "ten thi sinh", "name", "full name", "display name"],
  email: ["email", "email thi sinh", "email sv", "email sinh vien"],
  mssv: ["mssv", "ma sv", "ma sinh vien", "student id", "student code", "ma so sinh vien"],
} as const;

/** Mã lớp học / mã lớp thi của thí sinh (cùng tên cột với hộp "Nhập từ danh sách"). */
export const CLASS_HEADERS = {
  cohortCode: ["ma lop hoc", "lop hoc", "lop", "ma lop", "cohort", "cohort code"],
  examClassCode: ["ma lop thi", "lop thi", "exam class", "examclass"],
} as const;

export type PastedRow<F extends string> = Partial<Record<F, string>> & {
  /** Số dòng trong bảng gốc, tính cả dòng tiêu đề (dòng dữ liệu đầu = 2). */
  line: number;
};

export function parsePastedTable<F extends string>(
  raw: string,
  headers: Record<F, readonly string[]>,
): { rows: PastedRow<F>[]; fields: F[] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], fields: [] };
  const head = lines[0]!;
  const delim = head.includes("\t") ? "\t" : head.includes(";") ? ";" : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim());

  const keys = Object.keys(headers) as F[];
  const colField = split(head)
    .map(normHeader)
    .map((h) => keys.find((f) => headers[f].includes(h)) ?? null);
  const fields = Array.from(new Set(colField.filter((f): f is F => f !== null)));

  const rows = lines.slice(1).map((l, i) => {
    const cells = split(l);
    const r = { line: i + 2 } as PastedRow<F>;
    colField.forEach((f, c) => {
      if (f && cells[c]) (r as Record<string, unknown>)[f] = cells[c];
    });
    return r;
  });
  return { rows, fields };
}
