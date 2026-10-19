// Đọc bài giảng PowerPoint (.pptx) thành dữ liệu thuần: tiêu đề, các đoạn có cấp, ghi chú giảng, hình, bảng,
// biểu đồ, và cờ cho phần chỉ lấy được chữ. Không đọc màu, phông, vị trí trang trí: Limio dựng lại theo giao diện
// của mình (tiêu chí P3–P11, docs/tieu-chi/nhap-powerpoint.md).
// Hàm thuần + jszip, chạy được trên trình duyệt (xem trước ở bước 1) và máy chủ (đọc lại khi tạo bài).
// Biểu đồ dán từ Excel dạng đối tượng nhúng đọc số từ sổ Excel trong ppt/embeddings (docs/tieu-chi/bieu-do-kho-doc-pptx.md).

import JSZip from "jszip";
import {
  attr,
  child,
  childrenNamed,
  descendants,
  elements,
  firstDescendant,
  localName,
  parseXml,
  path,
  prefixedAttr,
  textOf,
  type XmlEl,
} from "./xmlLite";
import { Pkg, resolvePath, type Rel } from "./ooxmlPackage";
import { openWorkbook, type Workbook } from "./xlsxLite";
import { analyzeShapes, type Box, type LayoutShape, type ShapePara } from "./pptxLayout";

export { resolvePath };

export const PPTX_MAX_BYTES = 50 * 1024 * 1024;

/** Phần chỉ lấy được chữ (hoặc không lấy được) của một slide. */
export type PptxFlag = "smartart" | "shapes" | "equation" | "media" | "object" | "image_unsupported";

export interface PptxParagraph {
  text: string;
  /** 0 = cấp ngoài cùng. */
  level: number;
  /** Đoạn đánh số tự động (buAutoNum). */
  numbered: boolean;
}

/** Cụm chữ được nhấn trong slide gốc (tiêu chí P52): tô màu ("mark"), đậm hoặc nghiêng một phần đoạn. */
export interface PptxEmphasis {
  text: string;
  kind: "mark" | "bold" | "italic";
}

export interface PptxImage {
  /** Đường dẫn trong gói zip (ppt/media/image3.png). */
  target: string;
  ext: string;
  /** Tỉ lệ diện tích so với slide (0–1); 0 khi file không ghi kích thước. */
  area: number;
}

export type PptxChartType = "bar" | "hbar" | "line" | "pie" | "donut" | "other";

export interface PptxChart {
  type: PptxChartType;
  title: string;
  labels: string[];
  series: Array<{ name: string; values: Array<number | null> }>;
  /** "%" khi bộ đệm số định dạng phần trăm (giá trị đã nhân 100). */
  unit: string;
}

export interface PptxSlide {
  /** Số thứ tự trong bài, từ 1. */
  n: number;
  hidden: boolean;
  /** Kiểu layout của slide trong file (title, secHead, obj, twoObj, picTx, titleOnly, blank…); null nếu không rõ. */
  layoutType: string | null;
  title: string;
  /** Có placeholder tiêu đề thật (không phải đoán từ khối chữ). */
  hasTitlePlaceholder: boolean;
  /** Dòng dẫn phía trên tiêu đề ("NỘI DUNG 1", tên đơn vị trên bìa); rỗng nếu không có (tiêu chí P38). */
  kicker: string;
  /** Dòng ghi nguồn hình ("Nguồn ảnh minh hoạ: …"); rỗng nếu không có (tiêu chí P40). */
  credit: string;
  /** Chú thích hình ("Figure 1b: …"); rỗng nếu không có (tiêu chí P49). */
  caption: string;
  /** Cụm từ khoá rải trên slide, mỗi từ một màu (tiêu chí P53); rỗng nếu không có. */
  words: string[];
  /** Cụm chữ được nhấn (tiêu chí P52). */
  emphasis: PptxEmphasis[];
  subtitle: PptxParagraph[];
  paragraphs: PptxParagraph[];
  notes: string;
  /** Hình giữ lại, lớn nhất trước. */
  images: PptxImage[];
  tables: string[][][];
  charts: PptxChart[];
  /** Chữ các nút SmartArt theo cấp. */
  smartArt: PptxParagraph[];
  flags: PptxFlag[];
  /** Số biểu đồ/bảng của slide có số đọc từ sổ Excel nhúng trong file (tiêu chí E8). */
  fromExcel: number;
}

export interface PptxDeck {
  slides: PptxSlide[];
  /** Slide có hiệu ứng chuyển động hoặc chuyển slide (không chuyển được). */
  animatedSlides: number;
  /** Số lần xuất hiện của logo/hình lặp đã bỏ. */
  droppedRepeatedImages: number;
  /** Khối chữ lặp (chân trang tự gõ) đã bỏ. */
  droppedRepeatedText: number;
}

export class PptxError extends Error {
  constructor(public code: "ole_container" | "not_pptx" | "no_slides" | "too_large") {
    super(code);
  }
}

const IMG_OK = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const SKIP_PH = new Set(["dt", "ftr", "sldNum", "hdr", "sldImg"]);
const TITLE_PH = new Set(["title", "ctrTitle"]);
// Trường tự sinh không phải nội dung: số trang, ngày giờ.
const SKIP_FIELDS = new Set(["slidenum", "datetime", "datetime1", "datetime2", "datetime3", "datetime4", "datetime5"]);

/** Lỗi đọc file → mã lỗi cho giao diện (tiêu chí P2): file OLE là .ppt đời cũ hoặc .pptx có mật khẩu, phân biệt theo đuôi. */
export function pptxErrorCode(e: unknown, fileName: string): string {
  if (!(e instanceof PptxError)) return "not_pptx";
  if (e.code === "ole_container") return /\.ppt$/i.test(fileName) ? "legacy_ppt" : "encrypted_pptx";
  if (e.code === "too_large") return "file_too_large";
  return e.code;
}

/** File OLE (.ppt đời cũ, hoặc .pptx có mật khẩu): bắt đầu bằng D0 CF 11 E0. */
export function isOleContainer(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
}

/** Khoảng trắng thừa bỏ đi; chữ giữ nguyên. */
const tidy = (s: string) => s.replace(/[ \s]+/g, " ").trim();

/**
 * Chữ của một đoạn a:p: các run, trường (trừ số trang, ngày), xuống dòng mềm, công thức.
 * `raw` (ghi chú giảng): giữ nguyên khoảng trắng bên trong, chỉ bỏ khoảng trắng cuối dòng.
 */
function paragraphText(p: XmlEl, flags: Set<PptxFlag>, raw = false): string {
  let out = "";
  const walk = (el: XmlEl) => {
    for (const c of elements(el)) {
      const ln = localName(c.name);
      if (ln === "pPr" || ln === "rPr" || ln === "endParaRPr") continue;
      if (ln === "t") out += textOf(c);
      else if (ln === "br") out += raw ? "\n" : " ";
      else if (ln === "fld") {
        if (!SKIP_FIELDS.has(attr(c, "type") ?? "")) walk(c);
      } else if (ln === "oMath" || ln === "oMathPara") {
        flags.add("equation");
        walk(c);
      } else if (ln === "AlternateContent") {
        const choice = child(c, "Choice");
        if (choice) walk(choice);
      } else walk(c);
    }
  };
  walk(p);
  return raw ? out.replace(/[ \t\u00a0]+$/gm, "") : tidy(out);
}

/**
 * Các đoạn của một khối chữ, kèm cỡ chữ, đậm và ký hiệu đầu dòng để đọc bố cục (pptxLayout). `bulletDefault`: placeholder
 * thân kế thừa gạch đầu dòng từ layout, nên coi là có trừ khi đoạn ghi buNone. `emphasis`: nơi gom các cụm chữ nhấn của khối.
 */
function paragraphsOf(txBody: XmlEl | null, flags: Set<PptxFlag>, bulletDefault = false, emphasis?: PptxEmphasis[]): ShapePara[] {
  const out: ShapePara[] = [];
  const paras = childrenNamed(txBody, "p");
  if (emphasis) emphasis.push(...emphasisOf(paras));
  for (const p of paras) {
    const text = paragraphText(p, flags);
    if (!text) continue;
    const pPr = child(p, "pPr");
    const level = Math.max(0, Math.min(8, Number(attr(pPr, "lvl") ?? 0) || 0));
    const runs = childrenNamed(p, "r").filter((r) => textOf(child(r, "t")).trim());
    const sizes = runs.map((r) => Number(attr(child(r, "rPr"), "sz"))).filter((n) => Number.isFinite(n) && n > 0);
    const numbered = !!child(pPr, "buAutoNum");
    const colors = new Set(runs.map((r) => accentColorOf(child(r, "rPr"))));
    const color = colors.size === 1 ? [...colors][0]! : null;
    out.push({
      text,
      level,
      numbered,
      bullet: numbered || !!child(pPr, "buChar") || (bulletDefault && !child(pPr, "buNone")),
      size: sizes.length ? Math.max(...sizes) : null,
      bold: runs.length > 0 && runs.every((r) => attr(child(r, "rPr"), "b") === "1"),
      ...(color ? { color } : {}),
    });
  }
  return out;
}

// ── Chữ nhấn trong đoạn (tiêu chí P52) ──────────────────────────────────────

/** Màu chữ ghi trực tiếp trên run, dạng khoá so sánh được ("srgbClr:C00000", "schemeClr:accent2"); null nếu kế thừa. */
function colorKeyOf(rPr: XmlEl | null): string | null {
  const fill = child(rPr, "solidFill");
  const c = fill ? elements(fill)[0] : null;
  if (!c) return null;
  const mods = elements(c)
    .map((m) => `${localName(m.name)}=${attr(m, "val") ?? ""}`)
    .join(",");
  return `${localName(c.name)}:${attr(c, "val") ?? attr(c, "lastClr") ?? ""}${mods ? `/${mods}` : ""}`;
}

/** Màu trung tính (màu chữ thường, màu nền, đen, trắng, xám) không phải chỗ nhấn. */
function isNeutralColor(key: string): boolean {
  const [kind, rest = ""] = key.split(":");
  const val = rest.split("/")[0]!;
  if (kind === "schemeClr") return /^(tx|dk|bg|lt)\d$/.test(val) || val === "phClr";
  if (kind === "prstClr") return /^(black|white|gray|grey|dkGray|ltGray)$/i.test(val);
  if (kind === "srgbClr" && /^[0-9a-f]{6}$/i.test(val)) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(val.slice(i, i + 2), 16) / 255) as [number, number, number];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    return lum < 0.2 || lum > 0.92 || sat < 0.12;
  }
  return kind !== "srgbClr" && kind !== "schemeClr";
}

/** Màu nhấn của run (không trung tính); null nếu kế thừa hoặc trung tính. */
function accentColorOf(rPr: XmlEl | null): string | null {
  const k = colorKeyOf(rPr);
  return k && !isNeutralColor(k) ? k : null;
}

/**
 * Câu nổi bật của cả slide (P52): vài đoạn (không quá một phần tư) mang màu nhấn riêng trong khi phần lớn các đoạn là màu
 * chữ thường, như câu trích dẫn chốt tô đỏ cuối slide. Đoạn ngắn (nhãn, từ khoá) không tính.
 */
function standoutParagraphs(shapes: LayoutShape[]): PptxEmphasis[] {
  const ps = shapes.flatMap((sh) => sh.paras).filter((p) => p.text.length > 24);
  if (ps.length < 4 || ps.filter((p) => !p.color).length < ps.length / 2) return [];
  const count = new Map<string, number>();
  for (const p of ps) if (p.color) count.set(p.color, (count.get(p.color) ?? 0) + 1);
  const limit = Math.max(1, Math.floor(ps.length / 4));
  return ps.filter((p) => p.color && count.get(p.color)! <= limit).map((p) => ({ text: p.text, kind: "mark" as const }));
}

/**
 * Các cụm chữ được nhấn trong một khối chữ: tô màu nổi (a:highlight) hoặc màu khác màu chủ đạo của khối → "mark";
 * đậm hoặc nghiêng một phần đoạn → "bold"/"italic". Cả đoạn đậm hay nghiêng là kiểu của đoạn, không phải chỗ nhấn.
 */
function emphasisOf(paras: XmlEl[]): PptxEmphasis[] {
  const runsOf = (p: XmlEl) => childrenNamed(p, "r").map((r) => ({ text: textOf(child(r, "t")), rPr: child(r, "rPr") }));
  const weight = new Map<string, number>();
  for (const p of paras)
    for (const r of runsOf(p)) {
      const k = colorKeyOf(r.rPr) ?? "";
      weight.set(k, (weight.get(k) ?? 0) + r.text.trim().length);
    }
  const dominant = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const out: PptxEmphasis[] = [];
  for (const p of paras) {
    const runs = runsOf(p);
    const solid = runs.filter((r) => r.text.trim());
    const allB = solid.every((r) => attr(r.rPr, "b") === "1");
    const allI = solid.every((r) => attr(r.rPr, "i") === "1");
    let cur: { text: string; kind: PptxEmphasis["kind"] } | null = null;
    const flush = () => {
      const t = cur?.text.replace(/\s+/g, " ").trim();
      if (cur && t && t.replace(/[^\p{L}\p{N}]/gu, "").length >= 2 && !out.some((e) => e.text === t)) out.push({ text: t, kind: cur.kind });
      cur = null;
    };
    for (const r of runs) {
      if (!r.text.trim()) {
        if (cur) cur.text += r.text;
        continue;
      }
      const key = colorKeyOf(r.rPr);
      const kind: PptxEmphasis["kind"] | null =
        child(r.rPr, "highlight") || (key && key !== dominant && !isNeutralColor(key))
          ? "mark"
          : attr(r.rPr, "b") === "1" && !allB
            ? "bold"
            : attr(r.rPr, "i") === "1" && !allI
              ? "italic"
              : null;
      if (cur && kind === cur.kind) cur.text += r.text;
      else {
        flush();
        if (kind) cur = { text: r.text, kind };
      }
    }
    flush();
  }
  return out;
}

const plainPara = (p: PptxParagraph): PptxParagraph => ({ text: p.text, level: p.level, numbered: p.numbered });

/** Đổi toạ độ con của nhóm hình sang toạ độ của nhóm cha (tiêu chí P35). */
type Tf = (b: Box) => Box;
const IDENTITY: Tf = (b) => b;
function groupTf(grp: XmlEl, parent: Tf): Tf {
  const x = path(grp, "grpSpPr", "xfrm");
  const n = (el: XmlEl | null, a: string) => Number(attr(el, a)) || 0;
  const off = child(x, "off");
  const ext = child(x, "ext");
  const chOff = child(x, "chOff");
  const chExt = child(x, "chExt");
  if (!off || !ext || !chOff || !chExt) return parent;
  const sx = n(chExt, "cx") ? n(ext, "cx") / n(chExt, "cx") : 1;
  const sy = n(chExt, "cy") ? n(ext, "cy") / n(chExt, "cy") : 1;
  return (b) => parent({ x: n(off, "x") + (b.x - n(chOff, "x")) * sx, y: n(off, "y") + (b.y - n(chOff, "y")) * sy, cx: b.cx * sx, cy: b.cy * sy });
}

/** Vị trí khối trên slide (EMU); null nếu file không ghi (placeholder kế thừa từ layout). */
function boxOf(el: XmlEl): { x: number; y: number; cx: number; cy: number } | null {
  const xfrm = path(el, "spPr", "xfrm") ?? path(el, "xfrm") ?? path(el, "grpSpPr", "xfrm");
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  if (!off || !ext) return null;
  return { x: Number(attr(off, "x")) || 0, y: Number(attr(off, "y")) || 0, cx: Number(attr(ext, "cx")) || 0, cy: Number(attr(ext, "cy")) || 0 };
}

interface TextShape extends LayoutShape {
  kind: "title" | "subtitle" | "body";
  isPlaceholder: boolean;
  /** Hình khối vẽ (không phải placeholder hay hộp chữ) có chữ. */
  isDrawnShape: boolean;
}

interface RawSlide {
  slide: PptxSlide;
  shapes: TextShape[];
  imageRefs: Array<PptxImage>;
  /** Có hiệu ứng chuyển động hoặc chuyển slide. */
  animated: boolean;
}

async function readTable(frame: XmlEl, flags: Set<PptxFlag>, emphasis?: PptxEmphasis[]): Promise<string[][]> {
  const tbl = firstDescendant(frame, "tbl");
  const rows: string[][] = [];
  for (const tr of childrenNamed(tbl, "tr")) {
    rows.push(
      childrenNamed(tr, "tc").map((tc) => {
        if (attr(tc, "hMerge") === "1" || attr(tc, "vMerge") === "1") return "";
        return paragraphsOf(child(tc, "txBody"), flags, false, emphasis)
          .map((p) => p.text)
          .join(" ");
      }),
    );
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const CHART_TYPES: Record<string, PptxChartType> = {
  barChart: "bar",
  bar3DChart: "bar",
  lineChart: "line",
  line3DChart: "line",
  areaChart: "line",
  area3DChart: "line",
  pieChart: "pie",
  pie3DChart: "pie",
  ofPieChart: "pie",
  doughnutChart: "donut",
};

/** Giá trị các ô mà công thức của biểu đồ trỏ tới (đọc từ sổ Excel nhúng); null nếu không đọc được. */
export type FormulaResolver = (formula: string) => { values: string[]; percent: boolean } | null;

const cacheOf = (ref: XmlEl | null) => firstDescendant(ref, "numCache") ?? firstDescendant(ref, "strCache") ?? firstDescendant(ref, "lvl");
const formulaOf = (ref: XmlEl | null) => tidy(textOf(firstDescendant(ref, "f")));

/** Bộ đệm số/chữ của một tham chiếu; không có bộ đệm thì hỏi `resolve` theo công thức (tiêu chí E3, E6). */
function cacheValues(ref: XmlEl | null, resolve?: FormulaResolver): { values: string[]; percent: boolean } {
  const cache = cacheOf(ref) ?? ref;
  const count = Number(attr(child(cache, "ptCount"), "val") ?? 0);
  const pts = childrenNamed(cache, "pt");
  if (!pts.length && resolve) {
    const f = formulaOf(ref);
    const got = f ? resolve(f) : null;
    if (got) return { values: got.values.map(tidy), percent: got.percent };
  }
  const n = Math.max(count, ...pts.map((p) => Number(attr(p, "idx") ?? 0) + 1), 0);
  const values: string[] = Array(n).fill("");
  for (const p of pts) values[Number(attr(p, "idx") ?? 0)] = tidy(textOf(child(p, "v")));
  const fmt = textOf(child(cache, "formatCode"));
  return { values, percent: /%/.test(fmt) };
}

/** Công thức của các tham chiếu không có bộ đệm (tên chuỗi, nhãn, số) — cần sổ Excel nhúng để đọc. */
export function unresolvedFormulas(root: XmlEl | null): string[] {
  const out = new Set<string>();
  for (const ser of descendants(child(child(root, "chart"), "plotArea"), "ser")) {
    for (const ref of [child(ser, "tx"), child(ser, "cat"), child(ser, "xVal"), child(ser, "val"), child(ser, "yVal")]) {
      if (!ref || childrenNamed(cacheOf(ref), "pt").length) continue;
      const f = formulaOf(ref);
      if (f) out.add(f);
    }
  }
  return [...out];
}

export function readChartXml(root: XmlEl | null, resolve?: FormulaResolver): PptxChart | null {
  const chart = child(root, "chart");
  const plot = child(chart, "plotArea");
  if (!plot) return null;
  const groups = elements(plot).filter((e) => localName(e.name).endsWith("Chart"));
  if (!groups.length) return null;
  const first = groups[0]!;
  let type: PptxChartType = CHART_TYPES[localName(first.name)] ?? "other";
  if (type === "bar" && attr(child(first, "barDir"), "val") === "bar") type = "hbar";
  let labels: string[] = [];
  let percent = false;
  const series: PptxChart["series"] = [];
  for (const g of groups) {
    for (const ser of childrenNamed(g, "ser")) {
      const tx = child(ser, "tx");
      // Tên chuỗi: chữ trong bộ đệm hoặc chữ ghi thẳng; không bao giờ lấy chữ của công thức.
      const name = tidy(textOf(firstDescendant(tx, "v"))) || (tx && formulaOf(tx) ? (cacheValues(tx, resolve).values[0] ?? "") : tidy(textOf(tx)));
      const cat = cacheValues(child(ser, "cat") ?? child(ser, "xVal"), resolve);
      if (!labels.length) labels = cat.values;
      const val = cacheValues(child(ser, "val") ?? child(ser, "yVal"), resolve);
      percent ||= val.percent;
      series.push({
        name,
        values: val.values.map((v) => {
          if (!v) return null;
          const num = Number(v);
          return Number.isFinite(num) ? num : null;
        }),
      });
    }
  }
  if (percent) for (const s of series) s.values = s.values.map((v) => (v === null ? null : Math.round(v * 100 * 1e6) / 1e6));
  const title = tidy(descendants(child(chart, "title"), "t").map(textOf).join(""));
  return { type, title, labels, series, unit: percent ? "%" : "" };
}

/** Đọc biểu đồ, lấy số còn thiếu (không có bộ đệm) từ sổ Excel nhúng. `fromWorkbook` = có số lấy từ sổ. */
async function readChartWithWorkbook(root: XmlEl, wb: Workbook | null): Promise<{ chart: PptxChart | null; fromWorkbook: boolean }> {
  const formulas = wb ? unresolvedFormulas(root) : [];
  if (!wb || !formulas.length) return { chart: readChartXml(root), fromWorkbook: false };
  const got = new Map<string, { values: string[]; percent: boolean }>();
  for (const f of formulas) {
    const r = await wb.resolve(f);
    if (r) got.set(f, r);
  }
  return { chart: readChartXml(root, (f) => got.get(f) ?? null), fromWorkbook: got.size > 0 };
}

const hasNumbers = (c: PptxChart | null): c is PptxChart => !!c && c.series.some((s) => s.values.some((v) => v !== null));
const XLSX_EXT = /\.xls[xm]$/i;

/** Sổ Excel trong gói trình chiếu (ppt/embeddings); null nếu không phải .xlsx/.xlsm hoặc không đọc được. */
async function embeddedWorkbook(pkg: Pkg, rel: Rel | undefined): Promise<Workbook | null> {
  if (!rel || rel.external || !XLSX_EXT.test(rel.target)) return null;
  const bytes = await pkg.bytes(rel.target);
  return bytes ? openWorkbook(bytes).catch(() => null) : null;
}

/**
 * Khung đồ hoạ OLE (tiêu chí E1–E4, E7): biểu đồ hoặc vùng ô Excel dán dạng đối tượng nhúng. Biểu đồ của trang đang hiện
 * nếu có, không thì vùng ô đang hiện thành bảng. null = không phải sổ Excel đọc được (giữ cờ "object").
 */
async function readOleFrame(pkg: Pkg, data: XmlEl | null, rels: Map<string, Rel>): Promise<{ chart: PptxChart } | { table: string[][] } | null> {
  const ole = firstDescendant(data, "oleObj");
  const wb = await embeddedWorkbook(pkg, rels.get(prefixedAttr(ole, "id") ?? ""));
  if (!wb) return null;
  try {
    const root = await wb.activeChart();
    if (root) {
      const { chart } = await readChartWithWorkbook(root, wb);
      return hasNumbers(chart) ? { chart } : null;
    }
    const table = await wb.activeTable();
    return table?.length ? { table } : null;
  } catch {
    return null;
  }
}

/** Chữ các nút SmartArt theo cây cha–con của dataModel (bỏ nút trình bày và nút nối). */
export function readSmartArtXml(root: XmlEl | null): PptxParagraph[] {
  const pts = childrenNamed(child(root, "ptLst"), "pt");
  const byId = new Map<string, XmlEl>();
  for (const p of pts) {
    const id = attr(p, "modelId");
    if (id) byId.set(id, p);
  }
  const kids = new Map<string, Array<{ id: string; ord: number }>>();
  for (const c of childrenNamed(child(root, "cxnLst"), "cxn")) {
    const t = attr(c, "type") ?? "parOf";
    if (t !== "parOf") continue;
    const src = attr(c, "srcId");
    const dest = attr(c, "destId");
    if (!src || !dest) continue;
    const list = kids.get(src) ?? [];
    list.push({ id: dest, ord: Number(attr(c, "srcOrd") ?? 0) });
    kids.set(src, list);
  }
  const textOfPt = (p: XmlEl) => tidy(descendants(child(p, "t"), "t").map(textOf).join(" "));
  const isNode = (p: XmlEl | undefined) => {
    const t = attr(p, "type") ?? "node";
    return t === "node" || t === "asst";
  };
  const out: PptxParagraph[] = [];
  const seen = new Set<string>();
  const walk = (id: string, level: number) => {
    for (const k of (kids.get(id) ?? []).sort((a, b) => a.ord - b.ord)) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      const p = byId.get(k.id);
      if (!isNode(p)) continue;
      const text = textOfPt(p!);
      if (text) out.push({ text, level, numbered: false });
      walk(k.id, text ? level + 1 : level);
    }
  };
  const doc = pts.find((p) => attr(p, "type") === "doc");
  const docId = doc ? attr(doc, "modelId") : undefined;
  if (docId) walk(docId, 0);
  // Không có cây (file lạ): lấy chữ các nút theo thứ tự.
  if (!out.length) for (const p of pts) if (isNode(p) && textOfPt(p)) out.push({ text: textOfPt(p), level: 0, numbered: false });
  return out;
}

async function readSlide(pkg: Pkg, part: string, n: number, slideArea: number, slideH: number): Promise<RawSlide> {
  const root = await pkg.xml(part);
  if (!root) throw new PptxError("not_pptx");
  const rels = await pkg.rels(part);
  const flags = new Set<PptxFlag>();
  const shapes: TextShape[] = [];
  const imageRefs: PptxImage[] = [];
  const tables: string[][][] = [];
  const charts: PptxChart[] = [];
  const smartArt: PptxParagraph[] = [];
  const emphasis: PptxEmphasis[] = [];
  let connectors = 0;
  let order = 0;
  let fromExcel = 0;

  const areaOf = (el: XmlEl, tf: Tf) => {
    const raw = boxOf(el);
    const b = raw ? tf(raw) : null;
    return b && slideArea > 0 ? (b.cx * b.cy) / slideArea : 0;
  };

  const visit = async (el: XmlEl, tf: Tf) => {
    for (const s of elements(el)) {
      const ln = localName(s.name);
      if (ln === "grpSp") await visit(s, groupTf(s, tf));
      else if (ln === "AlternateContent") {
        const choice = child(s, "Choice");
        if (choice) await visit(choice, tf);
      } else if (ln === "cxnSp") connectors += 1;
      else if (ln === "sp") {
        const ph = path(s, "nvSpPr", "nvPr", "ph");
        const phType = ph ? (attr(ph, "type") ?? "body") : null;
        if (phType && SKIP_PH.has(phType)) continue;
        const paras = paragraphsOf(child(s, "txBody"), flags, !!ph && (phType === "body" || phType === "obj"), emphasis);
        if (!paras.length) continue;
        const isTextBox = attr(path(s, "nvSpPr", "cNvSpPr"), "txBox") === "1";
        const geom = attr(path(s, "spPr", "prstGeom"), "prst");
        const raw = boxOf(s);
        shapes.push({
          kind: phType && TITLE_PH.has(phType) ? "title" : phType === "subTitle" ? "subtitle" : "body",
          paras,
          name: attr(path(s, "nvSpPr", "cNvPr"), "name") ?? "",
          isPlaceholder: !!ph,
          isDrawnShape: !ph && !isTextBox && !!geom && geom !== "rect",
          box: raw ? tf(raw) : null,
          order: order++,
        });
      } else if (ln === "pic") {
        const nvPr = path(s, "nvPicPr", "nvPr");
        if (child(nvPr, "videoFile") || child(nvPr, "audioFile") || firstDescendant(nvPr, "media")) {
          flags.add("media");
          continue;
        }
        const embed = prefixedAttr(firstDescendant(child(s, "blipFill"), "blip"), "embed");
        const rel = embed ? rels.get(embed) : undefined;
        if (!rel || rel.external) {
          flags.add("image_unsupported");
          continue;
        }
        const ext = (rel.target.split(".").pop() ?? "").toLowerCase();
        if (!IMG_OK.has(ext)) {
          flags.add("image_unsupported");
          continue;
        }
        imageRefs.push({ target: rel.target, ext: ext === "jpeg" ? "jpg" : ext, area: areaOf(s, tf) });
      } else if (ln === "graphicFrame") {
        const data = path(s, "graphic", "graphicData");
        const uri = attr(data, "uri") ?? "";
        if (uri.endsWith("/table")) {
          const t = await readTable(s, flags, emphasis);
          if (t.length) tables.push(t);
        } else if (uri.endsWith("/chart")) {
          const rid = prefixedAttr(child(data, "chart"), "id");
          const rel = rid ? rels.get(rid) : undefined;
          const root = rel && !rel.external ? await pkg.xml(rel.target) : null;
          if (root) {
            // Biểu đồ mất bộ đệm số: lấy số từ sổ Excel nhúng của chính biểu đồ (c:externalData, tiêu chí E6).
            const ext = prefixedAttr(child(root, "externalData"), "id");
            const wb = ext && unresolvedFormulas(root).length ? await embeddedWorkbook(pkg, (await pkg.rels(rel!.target)).get(ext)) : null;
            const { chart: c, fromWorkbook } = await readChartWithWorkbook(root, wb);
            if (c) {
              charts.push(c);
              if (fromWorkbook && hasNumbers(c)) fromExcel += 1;
            }
          }
        } else if (uri.endsWith("/ole")) {
          const got = await readOleFrame(pkg, data, rels);
          if (got && "chart" in got) charts.push(got.chart);
          else if (got) tables.push(got.table);
          else flags.add("object");
          if (got) fromExcel += 1;
        } else if (uri.endsWith("/diagram")) {
          flags.add("smartart");
          const dm = prefixedAttr(child(data, "relIds"), "dm");
          const rel = dm ? rels.get(dm) : undefined;
          if (rel && !rel.external) smartArt.push(...readSmartArtXml(await pkg.xml(rel.target)));
        } else flags.add("object");
      } else if (ln === "contentPart") flags.add("object");
    }
  };
  await visit(path(root, "cSld", "spTree") ?? root, IDENTITY);

  if (shapes.filter((s) => s.isDrawnShape).length >= 3 || connectors > 0) flags.add("shapes");

  // Ghi chú giảng: placeholder thân của notesSlide, giữ xuống dòng.
  let notes = "";
  const notesRel = [...rels.values()].find((r) => r.type.endsWith("/notesSlide") && !r.external);
  if (notesRel) {
    const nroot = await pkg.xml(notesRel.target);
    const lines: string[] = [];
    for (const s of descendants(path(nroot, "cSld", "spTree"), "sp")) {
      const ph = path(s, "nvSpPr", "nvPr", "ph");
      if (attr(ph, "type") !== "body") continue;
      for (const p of childrenNamed(child(s, "txBody"), "p")) lines.push(paragraphText(p, new Set(), true));
    }
    notes = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  const layoutRel = [...rels.values()].find((r) => r.type.endsWith("/slideLayout") && !r.external);
  const layoutType = layoutRel ? (attr(await pkg.xml(layoutRel.target), "type") ?? null) : null;
  const timing = child(root, "timing");
  const animated = descendants(timing, "cTn").some((c) => attr(c, "presetClass")) || !!firstDescendant(root, "transition");

  return {
    slide: {
      n,
      hidden: attr(root, "show") === "0",
      layoutType,
      title: "",
      hasTitlePlaceholder: false,
      kicker: "",
      credit: "",
      caption: "",
      words: [],
      emphasis,
      subtitle: [],
      paragraphs: [],
      notes,
      images: [],
      tables,
      charts,
      smartArt,
      flags: [...flags],
      fromExcel,
    },
    shapes,
    imageRefs,
    animated,
  };
}

/** Lặp ở từ một nửa số slide trở lên (ít nhất 3 slide). */
const repeatThreshold = (slideCount: number) => Math.max(3, Math.ceil(slideCount / 2));

/**
 * Đọc gói .pptx. Ném PptxError: "ole_container" (.ppt đời cũ hoặc .pptx có mật khẩu — nơi gọi phân biệt theo
 * đuôi file), "not_pptx" (không phải trình chiếu hoặc hỏng), "no_slides".
 */
export async function parsePptx(data: ArrayBuffer | Uint8Array): Promise<{ deck: PptxDeck; media: (target: string) => Promise<Uint8Array | null> }> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length > PPTX_MAX_BYTES) throw new PptxError("too_large");
  if (isOleContainer(bytes)) throw new PptxError("ole_container");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new PptxError("not_pptx");
  }
  const pkg = new Pkg(zip);
  if (!pkg.has("ppt/presentation.xml")) throw new PptxError("not_pptx");
  const pres = await pkg.xml("ppt/presentation.xml");
  if (!pres) throw new PptxError("not_pptx");
  const presRels = await pkg.rels("ppt/presentation.xml");
  const sz = child(pres, "sldSz");
  const slideH = Number(attr(sz, "cy")) || 6858000;
  const slideArea = (Number(attr(sz, "cx")) || 12192000) * slideH;
  const parts = childrenNamed(child(pres, "sldIdLst"), "sldId")
    .map((s) => presRels.get(prefixedAttr(s, "id") ?? ""))
    .filter((r): r is Rel => !!r && !r.external && pkg.has(r.target))
    .map((r) => r.target);
  if (!parts.length) throw new PptxError("no_slides");

  const raws: RawSlide[] = [];
  for (const [i, part] of parts.entries()) raws.push(await readSlide(pkg, part, i + 1, slideArea, slideH));

  // Logo và chân trang tự gõ: lặp ở nhiều slide thì là thiết kế, không phải nội dung.
  const threshold = repeatThreshold(raws.length);
  const imgCount = new Map<string, number>();
  const textCount = new Map<string, number>();
  for (const r of raws) {
    for (const t of new Set(r.imageRefs.map((x) => x.target))) imgCount.set(t, (imgCount.get(t) ?? 0) + 1);
    const texts = new Set(r.shapes.filter((s) => !s.isPlaceholder).map((s) => s.paras.map((p) => p.text).join("\n")));
    for (const t of texts) textCount.set(t, (textCount.get(t) ?? 0) + 1);
  }
  let droppedRepeatedImages = 0;
  let droppedRepeatedText = 0;
  let animatedSlides = 0;

  const slides = raws.map((r) => {
    const s = r.slide;
    if (r.animated) animatedSlides += 1;
    const images = r.imageRefs.filter((im) => {
      const logo = raws.length >= 3 && (imgCount.get(im.target) ?? 0) >= threshold && im.area < 0.15;
      if (logo) droppedRepeatedImages += 1;
      return !logo;
    });
    const seen = new Set<string>();
    s.images = images
      .sort((a, b) => b.area - a.area)
      .filter((im) => (seen.has(im.target) ? false : (seen.add(im.target), true)));

    const shapes = r.shapes.filter((sh) => {
      if (sh.isPlaceholder || raws.length < 3) return true;
      const rep = (textCount.get(sh.paras.map((p) => p.text).join("\n")) ?? 0) >= threshold;
      if (rep) droppedRepeatedText += 1;
      return !rep;
    });
    const title = shapes.find((sh) => sh.kind === "title");
    // Không có placeholder tiêu đề: tiêu đề, dòng dẫn, dòng nguồn hình và nhãn đọc theo cỡ chữ và vị trí (pptxLayout).
    const text = analyzeShapes(
      shapes.filter((sh) => sh.kind === "body"),
      { h: slideH },
      title ? title.paras.map((p) => p.text).join(" ") : undefined,
    );
    s.title = text.title;
    s.hasTitlePlaceholder = !!title;
    s.kicker = text.kicker;
    s.credit = text.credit;
    s.caption = text.caption;
    s.words = text.words;
    for (const e of standoutParagraphs(shapes.filter((sh) => sh.kind === "body"))) if (!s.emphasis.some((x) => x.text === e.text)) s.emphasis.push(e);
    s.subtitle = shapes.filter((sh) => sh.kind === "subtitle").flatMap((sh) => sh.paras.map(plainPara));
    s.paragraphs = text.paragraphs;
    // Bảng tự vẽ bằng hộp chữ giữ dạng bảng như bảng thật (đứng trước bảng thật nếu có cả hai).
    s.tables = [...text.tables, ...s.tables];
    s.smartArt = normalizeLevels(s.smartArt);
    return s;
  });

  return {
    deck: { slides, animatedSlides, droppedRepeatedImages, droppedRepeatedText },
    media: (target) => pkg.bytes(target),
  };
}

/** Cấp nhỏ nhất về 0 để khối chữ bắt đầu ở cấp 2 (hộp chữ thụt lề) vẫn là ý chính. */
function normalizeLevels(ps: PptxParagraph[]): PptxParagraph[] {
  if (!ps.length) return ps;
  const min = Math.min(...ps.map((p) => p.level));
  return min ? ps.map((p) => ({ ...p, level: p.level - min })) : ps;
}

/** Thời lượng gợi ý theo số slide (tiêu chí P11). */
// 90 phút chỉ là một lựa chọn để giảng viên tự chọn, không tự gợi ý (người dùng chốt 2026-10-19).
export function suggestMinutes(slideCount: number): 15 | 30 | 45 {
  if (slideCount <= 12) return 15;
  if (slideCount <= 19) return 30;
  return 45;
}
