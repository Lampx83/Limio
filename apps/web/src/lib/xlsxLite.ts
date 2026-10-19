// Đọc sổ Excel (.xlsx) nhúng trong trình chiếu: biểu đồ của trang đang hiện, vùng ô đang hiện thành bảng, và giá trị các ô
// mà công thức của biểu đồ trỏ tới. Chỉ đọc giá trị đã lưu trong file (không tính lại công thức). Tiêu chí E1–E7,
// docs/tieu-chi/bieu-do-kho-doc-pptx.md. Chạy được cả trên trình duyệt lẫn máy chủ (như pptxImport).

import { Pkg } from "./ooxmlPackage";
import { attr, child, childrenNamed, descendants, firstDescendant, prefixedAttr, textOf, type XmlEl } from "./xmlLite";

/** Bảng dựng từ vùng ô: tối đa bấy nhiêu hàng × cột (E4). */
export const XLSX_TABLE_MAX_ROWS = 200;
export const XLSX_TABLE_MAX_COLS = 12;
/** Trang tính dài hơn chừng này ký tự XML thì không đọc (một slide không chứa nổi). */
const SHEET_MAX_CHARS = 8_000_000;

interface Cell {
  /** Kiểu ô: s (chuỗi dùng chung), str (chuỗi của công thức), inlineStr, b, e, n (mặc định). */
  t: string;
  v: string;
  style: number;
}

interface Sheet {
  name: string;
  part: string;
  kind: "worksheet" | "chartsheet";
}

/** "AB" → 27 (cột đánh số từ 1). */
export function colNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** "B12" → { col: 2, row: 12 }. */
function addr(a: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a.trim());
  return m ? { col: colNumber(m[1]!), row: Number(m[2]) } : null;
}

/** Vùng "A1:D5" (hoặc một ô) → hàng, cột từ 1. */
export function parseRange(ref: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [a, b] = ref.split(":");
  const p = a ? addr(a) : null;
  const q = b ? addr(b) : p;
  if (!p || !q) return null;
  return { r1: Math.min(p.row, q.row), c1: Math.min(p.col, q.col), r2: Math.max(p.row, q.row), c2: Math.max(p.col, q.col) };
}

/** Công thức tham chiếu của biểu đồ: "'Số liệu'!$B$2:$B$6" → tên trang + vùng. Công thức khác (nhiều vùng, tên đặt) → null. */
export function parseFormulaRef(f: string): { sheet: string; ref: string } | null {
  const m = /^\(?\s*(?:'((?:[^']|'')+)'|([^'!(),]+))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)\s*\)?$/.exec(f.trim());
  if (!m) return null;
  return { sheet: m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]!.trim(), ref: m[3]! };
}

// ── Định dạng số như Excel hiện ─────────────────────────────────────────────

const BUILTIN_FMT: Record<number, string> = {
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  14: "dd/mm/yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  22: "dd/mm/yyyy hh:mm",
  37: "#,##0",
  38: "#,##0",
  39: "#,##0.00",
  40: "#,##0.00",
};

/** Bỏ phần chữ trong ngoặc kép và ký tự thoát, lấy phần cho số dương. */
const fmtCore = (code: string) => (code.split(";")[0] ?? "").replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");

export const isPercentFormat = (code: string) => /%/.test(fmtCore(code));
const isDateFormat = (code: string) => /[dy]/i.test(fmtCore(code)) && !/[0#]/.test(fmtCore(code));

/** Bỏ nhiễu dấu phẩy động (0,1 + 0,2 = 0,30000000000000004). */
export const clean = (v: number) => Number(v.toPrecision(15));

/** Giá trị số của một ô → chữ như Excel hiện, kiểu Việt Nam (dấu phẩy thập phân, chấm chia nhóm khi định dạng có chia nhóm). */
export function formatCell(v: number, code: string): string {
  const core = fmtCore(code);
  if (!core || /^general$/i.test(core) || core === "@") return String(clean(v)).replace(".", ",");
  if (isDateFormat(code)) {
    // Ngày Excel: số ngày kể từ 30/12/1899.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000));
    if (Number.isNaN(d.getTime())) return String(clean(v));
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  const pct = isPercentFormat(code);
  const decimals = (/\.([0#]+)/.exec(core)?.[1] ?? "").length;
  const grouping = /[#0],[#0]/.test(core);
  const nf = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping });
  return nf.format(clean(pct ? v * 100 : v)) + (pct ? "%" : "");
}

// ── Sổ ──────────────────────────────────────────────────────────────────────

export interface Workbook {
  /** Chart XML của trang đang hiện; trang đang hiện không rõ thì biểu đồ đầu tiên của sổ. */
  activeChart(): Promise<XmlEl | null>;
  /** Vùng ô đang hiện (oleSize, không có thì vùng có dữ liệu) của trang đang hiện thành bảng chữ; null nếu trống. */
  activeTable(): Promise<string[][] | null>;
  /** Giá trị các ô mà công thức trỏ tới: số ghi bằng chữ số thường ("7.25"), chữ giữ nguyên; `percent` khi ô số định dạng %. */
  resolve(formula: string): Promise<{ values: string[]; percent: boolean } | null>;
}

/** Mở gói .xlsx; null nếu không phải sổ Excel đọc được. */
export async function openWorkbook(bytes: Uint8Array): Promise<Workbook | null> {
  const pkg = await Pkg.open(bytes);
  if (!pkg) return null;
  const wbPart = "xl/workbook.xml";
  const wb = await pkg.xml(wbPart);
  if (!wb) return null;
  const wbRels = await pkg.rels(wbPart);
  const sheets: Sheet[] = [];
  for (const s of childrenNamed(child(wb, "sheets"), "sheet")) {
    const rel = wbRels.get(prefixedAttr(s, "id") ?? "");
    if (!rel || rel.external) continue;
    const kind = rel.type.endsWith("/chartsheet") ? "chartsheet" : rel.type.endsWith("/worksheet") ? "worksheet" : null;
    if (kind) sheets.push({ name: attr(s, "name") ?? "", part: rel.target, kind });
  }
  if (!sheets.length) return null;
  const activeTab = Number(attr(firstDescendant(child(wb, "bookViews"), "workbookView"), "activeTab") ?? 0) || 0;
  const active = sheets[activeTab] ?? null;
  const oleSize = attr(child(wb, "oleSize"), "ref");

  const relOfType = (rels: Awaited<ReturnType<Pkg["rels"]>>, suffix: string) =>
    [...rels.values()].find((r) => !r.external && r.type.endsWith(suffix)) ?? null;

  let shared: string[] | null = null;
  const sharedStrings = async () => {
    if (shared) return shared;
    const rel = relOfType(wbRels, "/sharedStrings");
    const root = rel ? await pkg.xml(rel.target) : null;
    // Chuỗi có định dạng (<r>) ghép các <t>; bỏ phần phiên âm (<rPh>).
    shared = childrenNamed(root, "si").map(elementsText);
    return shared;
  };

  let formats: string[] | null = null;
  const styleFormats = async () => {
    if (formats) return formats;
    const rel = relOfType(wbRels, "/styles");
    const root = rel ? await pkg.xml(rel.target) : null;
    const custom = new Map<number, string>();
    for (const f of childrenNamed(child(root, "numFmts"), "numFmt")) custom.set(Number(attr(f, "numFmtId")), attr(f, "formatCode") ?? "");
    formats = childrenNamed(child(root, "cellXfs"), "xf").map((xf) => {
      const id = Number(attr(xf, "numFmtId") ?? 0);
      return custom.get(id) ?? BUILTIN_FMT[id] ?? "";
    });
    return formats;
  };

  const cellCache = new Map<string, Map<string, Cell> | null>();
  const cellsOf = async (sheet: Sheet): Promise<Map<string, Cell> | null> => {
    if (cellCache.has(sheet.part)) return cellCache.get(sheet.part)!;
    let out: Map<string, Cell> | null = null;
    const root = sheet.kind === "worksheet" ? await pkg.xml(sheet.part, SHEET_MAX_CHARS) : null;
    if (root) {
      out = new Map();
      for (const row of childrenNamed(child(root, "sheetData"), "row")) {
        for (const c of childrenNamed(row, "c")) {
          const r = attr(c, "r");
          if (!r) continue;
          const t = attr(c, "t") ?? "n";
          const v = t === "inlineStr" ? elementsText(child(c, "is")) : textOf(child(c, "v"));
          out.set(r.toUpperCase(), { t, v, style: Number(attr(c, "s") ?? 0) || 0 });
        }
      }
    }
    cellCache.set(sheet.part, out);
    return out;
  };

  /** Ô → chữ hiện (bảng) và giá trị thô (biểu đồ). */
  const read = async (cell: Cell | undefined): Promise<{ text: string; raw: string; num: boolean; percent: boolean }> => {
    if (!cell) return { text: "", raw: "", num: false, percent: false };
    if (cell.t === "s") {
      const s = (await sharedStrings())[Number(cell.v)] ?? "";
      return { text: s, raw: s, num: false, percent: false };
    }
    if (cell.t === "b") {
      const s = cell.v === "1" ? "TRUE" : "FALSE";
      return { text: s, raw: s, num: false, percent: false };
    }
    if (cell.t === "e") return { text: cell.v, raw: "", num: false, percent: false };
    const n = Number(cell.v);
    if (cell.t !== "n" || cell.v === "" || !Number.isFinite(n)) return { text: cell.v, raw: cell.v, num: false, percent: false };
    const code = (await styleFormats())[cell.style] ?? "";
    return { text: formatCell(n, code), raw: String(clean(n)), num: true, percent: isPercentFormat(code) };
  };

  const sheetByName = (name: string) => sheets.find((s) => s.name === name) ?? sheets.find((s) => s.name.toLowerCase() === name.toLowerCase());

  const chartsOf = async (sheet: Sheet): Promise<XmlEl[]> => {
    const drawing = relOfType(await pkg.rels(sheet.part), "/drawing");
    if (!drawing) return [];
    const root = await pkg.xml(drawing.target);
    const rels = await pkg.rels(drawing.target);
    const out: XmlEl[] = [];
    for (const c of descendants(root, "chart")) {
      const rel = rels.get(prefixedAttr(c, "id") ?? "");
      const chart = rel && !rel.external ? await pkg.xml(rel.target) : null;
      if (chart) out.push(chart);
    }
    return out;
  };

  return {
    async activeChart() {
      if (active) return (await chartsOf(active))[0] ?? null;
      for (const s of sheets) {
        const c = (await chartsOf(s))[0];
        if (c) return c;
      }
      return null;
    },

    async activeTable() {
      const sheet = active?.kind === "worksheet" ? active : sheets.find((s) => s.kind === "worksheet");
      const cells = sheet ? await cellsOf(sheet) : null;
      if (!cells?.size) return null;
      let range = oleSize ? parseRange(oleSize) : null;
      if (!range) {
        const at = [...cells.entries()].filter(([, c]) => c.v !== "").map(([k]) => addr(k)).filter((a): a is { col: number; row: number } => !!a);
        if (!at.length) return null;
        range = {
          r1: Math.min(...at.map((a) => a.row)),
          c1: Math.min(...at.map((a) => a.col)),
          r2: Math.max(...at.map((a) => a.row)),
          c2: Math.max(...at.map((a) => a.col)),
        };
      }
      const r2 = Math.min(range.r2, range.r1 + XLSX_TABLE_MAX_ROWS * 4);
      const c2 = Math.min(range.c2, range.c1 + XLSX_TABLE_MAX_COLS * 4);
      let grid: string[][] = [];
      for (let r = range.r1; r <= r2; r++) {
        const row: string[] = [];
        for (let c = range.c1; c <= c2; c++) row.push((await read(cells.get(colLetters(c) + r))).text.replace(/\s+/g, " ").trim());
        grid.push(row);
      }
      // Bỏ hàng và cột trống ở rìa, rồi mới giới hạn kích thước.
      while (grid.length && grid[0]!.every((x) => !x)) grid.shift();
      while (grid.length && grid[grid.length - 1]!.every((x) => !x)) grid.pop();
      if (!grid.length) return null;
      const colEmpty = (i: number) => grid.every((r) => !r[i]);
      let first = 0;
      let last = grid[0]!.length - 1;
      while (first <= last && colEmpty(first)) first++;
      while (last >= first && colEmpty(last)) last--;
      grid = grid.map((r) => r.slice(first, last + 1).slice(0, XLSX_TABLE_MAX_COLS)).slice(0, XLSX_TABLE_MAX_ROWS);
      return grid;
    },

    async resolve(formula: string) {
      const f = parseFormulaRef(formula);
      const sheet = f ? sheetByName(f.sheet) : undefined;
      const range = f ? parseRange(f.ref) : null;
      const cells = sheet ? await cellsOf(sheet) : null;
      if (!range || !cells) return null;
      const rows = range.r2 - range.r1 + 1;
      const cols = range.c2 - range.c1 + 1;
      if (rows * cols > 5000) return null;
      let percent = false;
      const at = async (r: number, c: number) => {
        const x = await read(cells.get(colLetters(c) + r));
        percent ||= x.percent;
        return x.raw;
      };
      const values: string[] = [];
      if (rows > 1 && cols > 1) {
        // Nhãn nhiều cấp: mỗi hàng là một nhãn, ghép các ô của hàng.
        for (let r = range.r1; r <= range.r2; r++) {
          const parts: string[] = [];
          for (let c = range.c1; c <= range.c2; c++) parts.push(await at(r, c));
          values.push(parts.filter(Boolean).join(" "));
        }
      } else {
        for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) values.push(await at(r, c));
      }
      return { values, percent };
    },
  };
}

/** 27 → "AA". */
function colLetters(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Chữ của một chuỗi Excel (<si>/<is>): các <t> trực tiếp hoặc trong <r>, bỏ phiên âm <rPh>. */
function elementsText(el: XmlEl | null): string {
  if (!el) return "";
  let out = "";
  for (const c of el.children) {
    if (typeof c === "string") continue;
    const n = c.name.slice(c.name.indexOf(":") + 1);
    if (n === "t") out += textOf(c);
    else if (n === "r") out += textOf(child(c, "t"));
  }
  return out;
}
