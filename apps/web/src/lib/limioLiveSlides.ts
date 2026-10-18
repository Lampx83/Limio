// Bố cục slide "Nội dung" của Limio-Live. Module thuần (không React, không DB) để
// dùng chung cho trình soạn, trình chiếu, ảnh thu nhỏ và bộ test.
//
// Nguyên tắc: slide lưu theo TRƯỜNG có cấu trúc (tiêu đề, thẻ, bước...), còn hình
// thức (cỡ chữ, màu, bố cục) do bố cục + giao diện tự vẽ. Nhờ vậy sửa chữ không
// làm vỡ hình thức, và đổi bố cục không mất nội dung.

import {
  CHART_MAX_SERIES,
  CHART_MAX_STORED_LABELS,
  CHART_TYPES,
  DATA_CONTENT_W,
  DATA_SLIDE,
  TABLE_LIMITS,
  dataBoxHeight,
  formatValue,
  isNum,
  numericColumns,
  numToInput,
  parseNum,
  tableFontSize,
  type ChartSeries,
  type ChartType,
} from "./limioLiveCharts";

import { isSlideMotifChoice } from "./limioLiveMotifs";

export const SLIDE_LAYOUTS = [
  "classic", // slide cũ: tiêu đề + phụ đề + ý chính + ảnh (mọi bài giảng có sẵn)
  "cover",
  "section",
  "image",
  "cards",
  "compare",
  "steps",
  "stats",
  "quote",
  "summary",
  "table",
  "chart",
] as const;
export type SlideLayoutId = (typeof SLIDE_LAYOUTS)[number];

export const LAYOUT_META: Record<SlideLayoutId, { label: string; hint: string }> = {
  classic: { label: "Chữ và ảnh (cũ)", hint: "Tiêu đề, ý chính và ảnh minh hoạ như trước" },
  cover: { label: "Bìa", hint: "Slide đầu: tiêu đề lớn, mô tả ngắn, tên giảng viên" },
  section: { label: "Tiêu đề mục", hint: "Mở đầu mỗi phần lớn của bài" },
  image: { label: "Chữ và hình", hint: "Ba ý chính kèm hình minh hoạ" },
  cards: { label: "Ba thẻ", hint: "Các ý song song, mỗi ý một biểu tượng" },
  compare: { label: "So sánh hai cột", hint: "Đối chiếu hai cách làm" },
  steps: { label: "Các bước", hint: "Quy trình hoặc dòng thời gian" },
  stats: { label: "Số liệu", hint: "Con số lớn kèm câu giải thích" },
  quote: { label: "Trích dẫn", hint: "Một ý chính cần nhấn mạnh" },
  summary: { label: "Tóm tắt", hint: "Slide cuối: các điều cần ghi nhớ" },
  table: { label: "Bảng", hint: "Thông tin đối chiếu theo hàng và cột" },
  chart: { label: "Biểu đồ", hint: "Cột, thanh ngang, đường hoặc tròn từ số liệu có thật" },
};

export const SLIDE_ICONS = ["target", "compass", "route", "chat", "book", "sparkle", "users", "chart"] as const;
export type SlideIconId = (typeof SLIDE_ICONS)[number];

export interface LayoutItem {
  heading: string; // tiêu đề thẻ / tên bước / con số / nội dung dòng tóm tắt
  body: string; // câu giải thích (không dùng ở slide tóm tắt)
  icon?: SlideIconId; // chỉ dùng ở slide ba thẻ
}

export interface LayoutColumn {
  heading: string;
  points: string[];
  note: string;
  tone: "bad" | "good";
}

/** Số mục cho phép của từng bố cục có danh sách. */
export const ITEM_RANGE: Partial<Record<SlideLayoutId, { min: number; max: number }>> = {
  cards: { min: 2, max: 4 },
  steps: { min: 2, max: 5 },
  stats: { min: 2, max: 4 },
  summary: { min: 2, max: 5 },
};

/** Số phần tối đa trên mục lục của bìa phần (vừa khung 720 px với chữ ≥ 26 px). */
export const MAX_TOC = 6;

/** Số ý chính tối đa của slide chữ và hình. */
export const MAX_BULLETS: Partial<Record<SlideLayoutId, number>> = { image: 3, classic: 3 };

/** Giới hạn độ dài từng trường (ký tự). Cắt ở máy chủ; trình soạn hiện cảnh báo trước khi chạm trần. */
export const MAX_LEN = {
  title: 120,
  subtitle: 200,
  byline: 80,
  sectionNumber: 4,
  tocItem: 80,
  bullet: 140,
  itemHeading: 60,
  itemBody: 140,
  statValue: 10,
  columnHeading: 40,
  columnPoint: 140,
  columnNote: 140,
  footnote: 80,
  quote: 200,
  source: 80,
  tableCell: 60,
  chartLabel: 40,
  seriesName: 40,
  unit: 20,
  notes: 2000,
} as const;

/** Cỡ chữ nhỏ nhất trên khung thiết kế 1280×720 (tương đương 39 px ở màn 1920×1080). */
export const MIN_FONT_PX = 26;

export function resolveLayout(config: unknown): SlideLayoutId {
  const l = (config as { layout?: unknown } | null | undefined)?.layout;
  return typeof l === "string" && (SLIDE_LAYOUTS as readonly string[]).includes(l) ? (l as SlideLayoutId) : "classic";
}

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function sanitizeItems(raw: unknown, layout: SlideLayoutId): LayoutItem[] {
  const range = ITEM_RANGE[layout];
  if (!range || !Array.isArray(raw)) return [];
  const items: LayoutItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const isStat = layout === "stats";
    const heading = clip(o.heading, isStat ? MAX_LEN.statValue : MAX_LEN.itemHeading);
    const body = layout === "summary" ? "" : clip(o.body, MAX_LEN.itemBody);
    if (!heading && !body) continue;
    const icon =
      layout === "cards" && typeof o.icon === "string" && (SLIDE_ICONS as readonly string[]).includes(o.icon)
        ? (o.icon as SlideIconId)
        : undefined;
    items.push({ heading, body, ...(icon ? { icon } : {}) });
    if (items.length >= range.max) break;
  }
  return items;
}

function sanitizeColumns(raw: unknown): LayoutColumn[] {
  if (!Array.isArray(raw)) return [];
  const cols: LayoutColumn[] = [];
  for (const r of raw.slice(0, 2)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    cols.push({
      heading: clip(o.heading, MAX_LEN.columnHeading),
      points: (Array.isArray(o.points) ? o.points : [])
        .map((p) => clip(p, MAX_LEN.columnPoint))
        .filter(Boolean)
        .slice(0, 3),
      note: clip(o.note, MAX_LEN.columnNote),
      tone: o.tone === "bad" ? "bad" : "good",
    });
  }
  return cols;
}

/**
 * Bảng: hàng tiêu đề + tối đa 6 dòng × 5 cột. Số cột = cột dài nhất (sau khi bỏ các cột trống ở cuối);
 * dòng trống bị bỏ, dòng ngắn được bù ô rỗng. Hàng tiêu đề để trống thì slide không vẽ hàng đó.
 */
function sanitizeTable(rawHead: unknown, rawRows: unknown): { head: string[]; rows: string[][] } {
  const cell = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : clip(v, MAX_LEN.tableCell));
  const head0 = (Array.isArray(rawHead) ? rawHead : []).slice(0, TABLE_LIMITS.maxCols).map(cell);
  const rows0 = (Array.isArray(rawRows) ? rawRows : [])
    .filter(Array.isArray)
    .map((r) => (r as unknown[]).slice(0, TABLE_LIMITS.maxCols).map(cell))
    .filter((r) => r.some(Boolean))
    .slice(0, TABLE_LIMITS.maxRows);
  let cols = Math.max(head0.length, ...rows0.map((r) => r.length), 0);
  while (cols > 0 && !head0[cols - 1] && rows0.every((r) => !r[cols - 1])) cols -= 1;
  const fit = (r: string[]) => Array.from({ length: cols }, (_, j) => r[j] ?? "");
  return { head: fit(head0), rows: rows0.map(fit) };
}

/**
 * Biểu đồ: loại, nhãn, 1–2 chuỗi số, đơn vị. Số được đọc cả khi là chữ kiểu Việt Nam ("3,5") vì trình
 * sửa giữ chữ đang gõ; ô không đọc được thành null (không vẽ). Lưu tối đa 8 nhãn và giữ chuỗi thứ hai
 * cả khi đang là biểu đồ tròn, để đổi qua lại giữa các loại không mất dữ liệu; bộ vẽ tự bớt theo loại.
 */
function sanitizeChart(raw: Record<string, unknown>): { chartType: ChartType; labels: string[]; series: ChartSeries[]; unit: string } {
  const chartType: ChartType = (CHART_TYPES as readonly string[]).includes(raw.chartType as string) ? (raw.chartType as ChartType) : "bar";
  const labels0 = (Array.isArray(raw.labels) ? raw.labels : []).slice(0, CHART_MAX_STORED_LABELS).map((l) => clip(l, MAX_LEN.chartLabel));
  const series0 = (Array.isArray(raw.series) ? raw.series : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .slice(0, CHART_MAX_SERIES)
    .map((s) => ({
      name: clip(s.name, MAX_LEN.seriesName),
      values: (Array.isArray(s.values) ? s.values : []).slice(0, CHART_MAX_STORED_LABELS).map((v) => {
        const n = parseNum(v);
        return isNum(n) ? n : null;
      }),
    }));
  // Bỏ dòng không có nhãn lẫn số; giữ thẳng hàng nhãn và số của mọi chuỗi.
  const n = Math.max(labels0.length, ...series0.map((s) => s.values.length), 0);
  const keep = Array.from({ length: n }, (_, i) => !!labels0[i] || series0.some((s) => isNum(s.values[i])));
  const labels = labels0.concat(Array(Math.max(0, n - labels0.length)).fill("")).filter((_, i) => keep[i]);
  let series = series0.map((s) => ({ name: s.name, values: Array.from({ length: n }, (_, i) => s.values[i] ?? null).filter((_, i) => keep[i]) }));
  // Chuỗi thứ hai không tên, không số thì bỏ; luôn giữ ít nhất một chuỗi.
  series = series.filter((s, k) => k === 0 || s.name || s.values.some(isNum));
  if (!series.length) series = [{ name: "", values: labels.map(() => null) }];
  return { chartType, labels, series, unit: clip(raw.unit, MAX_LEN.unit) };
}

/**
 * Chuẩn hoá config của slide có bố cục mới: chỉ giữ các trường bố cục dùng, cắt độ
 * dài, bỏ mục rỗng. Các khoá không thuộc bố cục (vd. ghi chú giảng `presenterNote`,
 * hẹn giờ) do nơi gọi giữ riêng. Bố cục "classic" không đi qua hàm này.
 */
export function sanitizeLayoutConfig(layout: SlideLayoutId, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { layout };
  const title = clip(raw.title, MAX_LEN.title);
  if (title) out.title = title;
  const subtitle = clip(raw.subtitle, MAX_LEN.subtitle);
  if (subtitle && (layout === "cover" || layout === "section")) out.subtitle = subtitle;
  if (layout === "cover") {
    const byline = clip(raw.byline, MAX_LEN.byline);
    if (byline) out.byline = byline;
  }
  if (layout === "section") {
    const n = clip(raw.sectionNumber, MAX_LEN.sectionNumber);
    if (n) out.sectionNumber = n;
    // Mục lục của bìa phần: tên các phần Nội dung, do hệ thống tính từ dàn ý (không do AI viết).
    const toc = (Array.isArray(raw.toc) ? raw.toc : []).map((t) => clip(t, MAX_LEN.tocItem)).filter(Boolean).slice(0, MAX_TOC);
    const cur = Number(raw.tocCurrent);
    if (toc.length >= 2 && Number.isInteger(cur) && cur >= 1 && cur <= toc.length) {
      out.toc = toc;
      out.tocCurrent = cur;
    }
  }
  if (layout === "image") {
    const bullets = (Array.isArray(raw.bullets) ? raw.bullets : [])
      .map((b) => clip(b, MAX_LEN.bullet))
      .filter(Boolean)
      .slice(0, MAX_BULLETS.image);
    if (bullets.length) out.bullets = bullets;
    const img = clip(raw.imageUrl, 2000);
    if (img) out.imageUrl = img;
  }
  if (ITEM_RANGE[layout]) out.items = sanitizeItems(raw.items, layout);
  if (layout === "steps") {
    const f = clip(raw.footnote, MAX_LEN.footnote);
    if (f) out.footnote = f;
  }
  if (layout === "compare") out.columns = sanitizeColumns(raw.columns);
  if (layout === "quote") {
    const q = clip(raw.quote, MAX_LEN.quote);
    if (q) out.quote = q;
    const s = clip(raw.source, MAX_LEN.source);
    if (s) out.source = s;
    delete out.title;
  }
  if (layout === "table") Object.assign(out, sanitizeTable(raw.head, raw.rows));
  if (layout === "chart") Object.assign(out, sanitizeChart(raw));
  if (layout === "table" || layout === "chart") {
    const s = clip(raw.source, MAX_LEN.source);
    if (s) out.source = s;
  }
  return out;
}

/** Nội dung trống để giảng viên bắt đầu điền khi chọn một bố cục. */
export function emptyLayoutConfig(layout: SlideLayoutId): Record<string, unknown> {
  const blank = (n: number): LayoutItem[] => Array.from({ length: n }, () => ({ heading: "", body: "" }));
  switch (layout) {
    case "cover":
      return { layout, title: "", subtitle: "", byline: "" };
    case "section":
      return { layout, sectionNumber: "01", title: "", subtitle: "" };
    case "image":
      return { layout, title: "", bullets: ["", "", ""] };
    case "cards":
      return {
        layout,
        title: "",
        items: [
          { heading: "", body: "", icon: "target" },
          { heading: "", body: "", icon: "compass" },
          { heading: "", body: "", icon: "route" },
        ],
      };
    case "compare":
      return {
        layout,
        title: "",
        columns: [
          { heading: "", points: [""], note: "", tone: "bad" },
          { heading: "", points: [""], note: "", tone: "good" },
        ],
      };
    case "steps":
      return { layout, title: "", items: blank(4), footnote: "" };
    case "stats":
      return { layout, title: "", items: blank(3) };
    case "quote":
      return { layout, quote: "", source: "" };
    case "summary":
      return { layout, title: "", items: blank(3) };
    case "table":
      return { layout, title: "", head: ["", "", ""], rows: [["", "", ""], ["", "", ""]], source: "" };
    case "chart":
      return { layout, title: "", chartType: "bar", labels: ["", "", ""], series: [{ name: "", values: [null, null, null] }], unit: "", source: "" };
    default:
      return { title: "", subtitle: "", bullets: [] };
  }
}

/**
 * Tách tiêu đề thành phần thường + phần nhấn (nhóm từ cuối, chữ chuyển màu).
 * Chỉ nhấn khi tiêu đề từ 4 từ trở lên để tiêu đề ngắn không bị chia vụn.
 */
export function accentTail(title: string): { head: string; tail: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return { head: words.join(" "), tail: "" };
  const n = Math.ceil(words.length / 3);
  return { head: words.slice(0, words.length - n).join(" "), tail: words.slice(words.length - n).join(" ") };
}

/**
 * Ước lượng cỡ chữ lớn nhất (≤ maxPx) để đoạn chữ vừa `maxLines` dòng trong khung
 * rộng `widthPx`, nhưng không nhỏ hơn `minPx`. Dùng hệ số 0,56 em cho độ rộng ký tự
 * (font Be Vietnam Pro rộng hơn phần lớn font hệ thống). `overflow` = true khi đã
 * xuống đáy mà vẫn không vừa — lúc đó trình soạn gợi ý tách slide.
 */
export function fitFontSize(
  text: string,
  o: { maxPx: number; minPx?: number; widthPx: number; maxLines: number },
): { px: number; overflow: boolean } {
  const minPx = Math.max(o.minPx ?? MIN_FONT_PX, MIN_FONT_PX);
  const len = text.trim().length;
  if (len === 0) return { px: o.maxPx, overflow: false };
  for (let px = o.maxPx; px >= minPx; px -= 2) {
    const perLine = Math.max(1, Math.floor(o.widthPx / (px * 0.56)));
    if (Math.ceil(len / perLine) <= o.maxLines) return { px, overflow: false };
  }
  return { px: minPx, overflow: true };
}

/** Các trường chữ của slide, kèm khung chứa ước lượng; dùng để cảnh báo "Slide này dài". */
export function layoutTextProblems(layout: SlideLayoutId, c: Record<string, any>): string[] {
  const problems: string[] = [];
  const check = (label: string, text: unknown, o: Parameters<typeof fitFontSize>[1]) => {
    if (typeof text === "string" && text && fitFontSize(stripInline(text), o).overflow) problems.push(label);
  };
  const items: LayoutItem[] = Array.isArray(c.items) ? c.items : [];
  switch (layout) {
    case "cards":
      items.forEach((it, i) => check(`Thẻ ${i + 1}`, it.body, { maxPx: 30, widthPx: 290, maxLines: 4 }));
      break;
    case "steps":
      items.forEach((it, i) => check(`Bước ${i + 1}`, it.body, { maxPx: 28, widthPx: 240, maxLines: 4 }));
      break;
    case "stats":
      items.forEach((it, i) => check(`Số liệu ${i + 1}`, it.body, { maxPx: 32, widthPx: 300, maxLines: 4 }));
      break;
    case "summary":
      items.forEach((it, i) => check(`Dòng ${i + 1}`, it.heading, { maxPx: 40, widthPx: 880, maxLines: 2 }));
      break;
    case "image":
      (Array.isArray(c.bullets) ? c.bullets : []).forEach((b: string, i: number) =>
        check(`Ý ${i + 1}`, b, { maxPx: 38, widthPx: 560, maxLines: 3 }),
      );
      break;
    case "quote":
      check("Câu trích dẫn", c.quote, { maxPx: 66, widthPx: 1000, maxLines: 4 });
      break;
    case "compare":
      (Array.isArray(c.columns) ? c.columns : []).forEach((col: LayoutColumn, i: number) =>
        col.points.forEach((p) => check(`Cột ${i + 1}`, p, { maxPx: 32, widthPx: 480, maxLines: 3 })),
      );
      break;
    case "table": {
      const head: string[] = Array.isArray(c.head) ? c.head : [];
      const rows: string[][] = Array.isArray(c.rows) ? c.rows : [];
      if (tableFontSize(head, rows, DATA_CONTENT_W - 20, dataSlideMetrics(c).boxH).overflow) problems.push("Bảng");
      break;
    }
    default:
      break;
  }
  if (layout === "table" || layout === "chart") check("Tiêu đề", c.title, { maxPx: DATA_SLIDE.titleMaxPx, widthPx: DATA_CONTENT_W, maxLines: 2 });
  else check("Tiêu đề", c.title, { maxPx: 72, widthPx: 1088, maxLines: 2 });
  return Array.from(new Set(problems));
}

/**
 * Kích thước chung của slide Bảng và Biểu đồ: cỡ chữ và số dòng của tiêu đề, chiều cao còn lại cho
 * bảng hoặc biểu đồ. Bộ vẽ và cảnh báo "Slide dài" cùng dùng hàm này để không lệch nhau.
 */
export function dataSlideMetrics(c: Record<string, any>): { titlePx: number; titleLines: number; boxH: number } {
  const title = stripInline(typeof c.title === "string" ? c.title : "").trim();
  const { px } = fitFontSize(title, { maxPx: DATA_SLIDE.titleMaxPx, widthPx: DATA_CONTENT_W, maxLines: 2 });
  const per = Math.max(1, Math.floor(DATA_CONTENT_W / (px * 0.56)));
  const lines = title ? Math.min(3, Math.ceil(title.length / per)) : 0;
  const hasSource = typeof c.source === "string" && c.source.trim().length > 0;
  return { titlePx: px, titleLines: lines, boxH: dataBoxHeight(lines, px, hasSource) };
}

// ── Đổi bố cục mà không mất nội dung ───────────────────────────────────────

const joinSentence = (a: string, b: string): string => {
  const h = a.trim();
  const t = b.trim();
  if (!h) return t;
  if (!t) return h;
  return /[.!?…:;]$/.test(h) ? `${h} ${t}` : `${h}. ${t}`;
};

type Pieces = { title: string; subtitle: string; texts: Array<{ heading: string; body: string }>; imageUrl: string };

/** Gom nội dung của mọi bố cục về các mảnh chung: tiêu đề, phụ đề, danh sách ý, ảnh. */
function toPieces(c: Record<string, any>): Pieces {
  const layout = resolveLayout(c);
  const texts: Pieces["texts"] = [];
  if (Array.isArray(c.items)) for (const it of c.items) texts.push({ heading: String(it?.heading ?? ""), body: String(it?.body ?? "") });
  if (Array.isArray(c.bullets)) for (const b of c.bullets) texts.push({ heading: String(b ?? ""), body: "" });
  if (Array.isArray(c.columns)) {
    for (const col of c.columns) {
      const points: string[] = Array.isArray(col?.points) ? col.points : [];
      texts.push({ heading: String(col?.heading ?? ""), body: [...points, col?.note ?? ""].filter(Boolean).join(" ") });
    }
  }
  if (layout === "table" && Array.isArray(c.rows)) {
    // Mỗi dòng thành một ý: ô đầu là tiêu đề, các ô sau ghép kèm tên cột.
    const head: string[] = Array.isArray(c.head) ? c.head : [];
    for (const r of c.rows as string[][]) {
      const rest = r
        .slice(1)
        .map((cell, j) => (cell && head[j + 1] ? `${head[j + 1]}: ${cell}` : cell))
        .filter(Boolean);
      texts.push({ heading: String(r[0] ?? ""), body: rest.join("; ") });
    }
  }
  if (layout === "chart" && Array.isArray(c.labels)) {
    const series: ChartSeries[] = Array.isArray(c.series) ? c.series : [];
    const unit = typeof c.unit === "string" ? c.unit : "";
    (c.labels as string[]).forEach((l, i) => {
      const vals = series
        .filter((s) => isNum(s.values?.[i]))
        .map((s) => `${series.length > 1 && s.name ? `${s.name}: ` : ""}${formatValue(s.values[i] as number, unit)}${unit && unit !== "%" ? ` ${unit}` : ""}`);
      texts.push({ heading: String(l ?? ""), body: vals.join("; ") });
    });
  }
  const title = String(c.title ?? c.quote ?? "");
  const subtitle = String(c.subtitle ?? (layout === "quote" ? c.source ?? "" : "") ?? "");
  return { title, subtitle, texts: texts.filter((t) => t.heading.trim() || t.body.trim()), imageUrl: String(c.imageUrl ?? "") };
}

/**
 * Chuyển nội dung sang bố cục khác: tiêu đề, phụ đề, các ý và ảnh được mang theo; trường mà
 * bố cục đích không có thì gộp vào trường gần nghĩa nhất (vd. ý của thẻ gộp thành một câu khi
 * sang danh sách ý). Kết quả đã qua sanitizeLayoutConfig.
 */
export function convertLayoutConfig(from: Record<string, any>, to: SlideLayoutId): Record<string, unknown> {
  if (to === "classic") {
    const p = toPieces(from);
    return {
      title: p.title,
      subtitle: p.subtitle,
      bullets: p.texts.map((t) => joinSentence(t.heading, t.body)).slice(0, MAX_BULLETS.classic),
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
    };
  }
  const p = toPieces(from);
  const base: Record<string, unknown> = emptyLayoutConfig(to);
  switch (to) {
    case "cover":
      base.title = p.title;
      base.subtitle = p.subtitle || p.texts.map((t) => joinSentence(t.heading, t.body))[0] || "";
      break;
    case "section":
      base.title = p.title;
      base.subtitle = p.subtitle;
      break;
    case "image":
      base.title = p.title;
      base.bullets = p.texts.map((t) => joinSentence(t.heading, t.body)).slice(0, MAX_BULLETS.image);
      if (p.imageUrl) base.imageUrl = p.imageUrl;
      break;
    case "cards":
    case "steps":
    case "stats":
    case "summary": {
      base.title = p.title;
      const range = ITEM_RANGE[to]!;
      const base_items = emptyLayoutConfig(to).items as LayoutItem[];
      const fromTexts = p.texts.slice(0, range.max);
      const n = Math.max(fromTexts.length, base_items.length);
      base.items = Array.from({ length: n }, (_, i) => ({
        ...(base_items[i] ?? { heading: "", body: "" }),
        heading: fromTexts[i]?.heading ?? "",
        body: to === "summary" ? "" : fromTexts[i]?.body ?? "",
        ...(to === "summary" && fromTexts[i]?.body ? { heading: joinSentence(fromTexts[i]!.heading, fromTexts[i]!.body) } : {}),
      }));
      break;
    }
    case "compare": {
      base.title = p.title;
      const cols = base.columns as LayoutColumn[];
      p.texts.slice(0, 2).forEach((t, i) => {
        cols[i] = { ...cols[i]!, heading: t.heading, points: t.body ? [t.body] : [""] };
      });
      break;
    }
    case "quote":
      base.quote = p.title;
      base.source = p.subtitle;
      break;
    case "table":
      Object.assign(base, toTable(from, p));
      break;
    case "chart":
      Object.assign(base, toChart(from, p));
      break;
    default:
      break;
  }
  if (to === "stats" && resolveLayout(from) === "chart") base.items = chartToStats(from);
  if ((to === "table" || to === "chart") && typeof from.source === "string" && resolveLayout(from) !== "quote") base.source = from.source;
  return sanitizeLayoutConfig(to, base);
}

/** Sang Bảng: biểu đồ thành nhãn + từng chuỗi số; so sánh hai cột giữ hai cột; bố cục khác thành hai cột ý – giải thích. */
function toTable(from: Record<string, any>, p: Pieces): { title: string; head: string[]; rows: string[][] } {
  const layout = resolveLayout(from);
  if (layout === "chart") {
    const series: ChartSeries[] = Array.isArray(from.series) ? from.series : [];
    const unit = typeof from.unit === "string" ? from.unit.trim() : "";
    const unitHead = unit && unit !== "%" ? unit.charAt(0).toUpperCase() + unit.slice(1) : "";
    const labels: string[] = Array.isArray(from.labels) ? from.labels : [];
    return {
      title: p.title,
      head: ["", ...series.map((s, k) => s.name || unitHead || (series.length > 1 ? `Chuỗi ${k + 1}` : "Số liệu"))],
      rows: labels.map((l, i) => [l, ...series.map((s) => (isNum(s.values?.[i]) ? numToInput(s.values[i]) + (unit === "%" ? "%" : "") : ""))]),
    };
  }
  if (layout === "compare" && Array.isArray(from.columns)) {
    const cols: LayoutColumn[] = from.columns;
    const n = Math.max(...cols.map((c) => c.points?.length ?? 0), 0);
    const rows = Array.from({ length: n }, (_, i) => cols.map((c) => c.points?.[i] ?? ""));
    if (cols.some((c) => c.note)) rows.push(cols.map((c) => c.note ?? ""));
    return { title: p.title, head: cols.map((c) => c.heading ?? ""), rows };
  }
  return { title: p.title, head: ["", ""], rows: p.texts.map((t) => [t.heading, t.body]) };
}

/** Sang Biểu đồ: bảng lấy cột đầu làm nhãn và tối đa hai cột toàn số; Số liệu lấy số làm cột; còn lại chỉ giữ nhãn. */
function toChart(from: Record<string, any>, p: Pieces): Record<string, unknown> {
  const layout = resolveLayout(from);
  if (layout === "table") {
    const head: string[] = Array.isArray(from.head) ? from.head : [];
    const rows: string[][] = Array.isArray(from.rows) ? from.rows : [];
    const cols = Math.max(head.length, ...rows.map((r) => r.length), 0);
    const numeric = numericColumns(rows, cols)
      .map((ok, j) => (ok && j > 0 ? j : -1))
      .filter((j) => j > 0)
      .slice(0, CHART_MAX_SERIES);
    const pct = numeric.length > 0 && numeric.every((j) => rows.every((r) => !String(r[j] ?? "").trim() || /%\s*$/.test(String(r[j]))));
    return {
      title: p.title,
      labels: rows.map((r) => r[0] ?? ""),
      series: numeric.length ? numeric.map((j) => ({ name: head[j] ?? "", values: rows.map((r) => r[j] ?? null) })) : [{ name: "", values: rows.map(() => null) }],
      unit: pct ? "%" : "",
    };
  }
  if (layout === "stats" && Array.isArray(from.items)) {
    const items: LayoutItem[] = from.items;
    const nums = items.map((it) => /[-−]?\d[\d.,]*/.exec(it.heading ?? "")?.[0] ?? "");
    return {
      title: p.title,
      labels: items.map((it) => it.body || it.heading),
      series: [{ name: "", values: nums }],
      unit: items.length > 0 && items.every((it) => /%/.test(it.heading ?? "")) ? "%" : "",
    };
  }
  return { title: p.title, labels: p.texts.map((t) => t.heading), series: [{ name: "", values: p.texts.map(() => null) }] };
}

/** Biểu đồ sang Số liệu: tối đa 4 cặp nhãn – số đầu tiên của chuỗi đầu. */
function chartToStats(from: Record<string, any>): LayoutItem[] {
  const labels: string[] = Array.isArray(from.labels) ? from.labels : [];
  const s: ChartSeries | undefined = Array.isArray(from.series) ? from.series[0] : undefined;
  const unit = typeof from.unit === "string" ? from.unit : "";
  return labels
    .map((l, i) => ({ l, v: s?.values?.[i] }))
    .filter((x): x is { l: string; v: number } => isNum(x.v))
    .slice(0, ITEM_RANGE.stats!.max)
    .map((x) => ({ heading: formatValue(x.v, unit).slice(0, MAX_LEN.statValue), body: x.l }));
}

/**
 * Bù ô trống cho đủ số mục mặc định của bố cục để trình soạn luôn có ô để điền
 * (config đã lưu bỏ mục rỗng nên có thể ít hơn).
 */
export function padForEditing(layout: SlideLayoutId, c: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...c, layout };
  const range = ITEM_RANGE[layout];
  if (range) {
    const items: LayoutItem[] = Array.isArray(c.items) ? [...c.items] : [];
    const seed = (emptyLayoutConfig(layout).items as LayoutItem[]) ?? [];
    while (items.length < Math.max(range.min, seed.length)) items.push({ ...(seed[items.length] ?? { heading: "", body: "" }) });
    out.items = items;
  }
  if (layout === "compare") {
    const cols: LayoutColumn[] = Array.isArray(c.columns) ? [...c.columns] : [];
    const seed = emptyLayoutConfig("compare").columns as LayoutColumn[];
    while (cols.length < 2) cols.push({ ...seed[cols.length]!, points: [""] });
    out.columns = cols.map((col) => ({ ...col, points: col.points?.length ? col.points : [""] }));
  }
  if (layout === "table") {
    const head: string[] = Array.isArray(c.head) ? [...c.head] : [];
    const rows: string[][] = Array.isArray(c.rows) ? c.rows.map((r: string[]) => [...r]) : [];
    const cols = Math.max(TABLE_LIMITS.minCols, head.length, ...rows.map((r) => r.length));
    if (!rows.length) rows.push([]);
    const fit = (r: string[]) => Array.from({ length: cols }, (_, j) => r[j] ?? "");
    out.head = fit(head);
    out.rows = rows.map(fit);
  }
  if (layout === "chart") {
    // Ô số được sửa dưới dạng chữ ("3,5") để gõ dở không bị mất; sanitizeLayoutConfig đọc lại thành số.
    const labels: string[] = Array.isArray(c.labels) ? [...c.labels] : [];
    while (labels.length < 2) labels.push("");
    const series: ChartSeries[] = Array.isArray(c.series) && c.series.length ? c.series : [{ name: "", values: [] }];
    out.labels = labels;
    out.series = series.map((s) => ({ name: s.name ?? "", values: labels.map((_, i) => (typeof s.values?.[i] === "string" ? s.values[i] : numToInput(s.values?.[i]))) }));
    out.chartType = (CHART_TYPES as readonly string[]).includes(c.chartType) ? c.chartType : "bar";
    out.unit = c.unit ?? "";
  }
  if (layout === "image") {
    const b: string[] = Array.isArray(c.bullets) ? [...c.bullets] : [];
    while (b.length < (MAX_BULLETS.image ?? 3)) b.push("");
    out.bullets = b;
  }
  return out;
}

/**
 * Khoá "meta" đi kèm mọi slide, không thuộc bố cục: ghi chú giảng, cờ ẩn khi trình chiếu, hoa văn trang trí chọn
 * riêng cho slide ("none", mã hoa văn hoặc mã hình minh hoạ, xem limioLiveMotifs), và dấu vết sinh bằng AI (id dòng dàn ý, slide do
 * AI sinh, đã được giảng viên sửa tay). Hoa văn là meta để AI sửa slide hay đổi bố cục không làm mất lựa chọn.
 * Bộ lọc bố cục phải giữ chúng, nếu không việc ẩn slide hay ghi chú sẽ mất lặng lẽ.
 */
export function pickMeta(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const c = config ?? {};
  const out: Record<string, unknown> = {};
  if (typeof c.presenterNote === "string" && c.presenterNote.trim()) out.presenterNote = c.presenterNote.trim().slice(0, MAX_LEN.notes);
  if (c.hidden === true) out.hidden = true;
  if (isSlideMotifChoice(c.motif)) out.motif = c.motif;
  if (typeof c.outlineId === "string" && c.outlineId) out.outlineId = c.outlineId.slice(0, 60);
  if (c.aiGenerated === true) out.aiGenerated = true;
  if (c.editedByUser === true) out.editedByUser = true;
  return out;
}

/**
 * Chuẩn hoá config của slide Nội dung ở máy chủ. Slide có bố cục mới được lọc theo
 * sanitizeLayoutConfig (giữ các khoá meta); slide cũ và slide chèn học liệu giữ nguyên.
 */
export function normalizeContentSlideConfig(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const c = config as Record<string, unknown>;
  const layout = resolveLayout(c);
  if (layout === "classic" || c.resource) return config;
  return { ...sanitizeLayoutConfig(layout, c), ...pickMeta(c) };
}

// ── Dấu vết sinh bằng AI và việc "đã sửa tay" ───────────────────────────────

// Đổi hoa văn là đổi trang trí, không phải sửa nội dung: không tính là "đã sửa tay".
const IDENTITY_KEYS = ["outlineId", "aiGenerated", "hidden", "editedByUser", "motif"] as const;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Phần nội dung của config (bỏ các khoá nhận diện/cờ) — để so xem giảng viên có đổi chữ không. */
function contentOf(c: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(c ?? {}) };
  for (const k of IDENTITY_KEYS) delete out[k];
  if (typeof out.presenterNote === "string") out.presenterNote = out.presenterNote.trim();
  if (!out.presenterNote) delete out.presenterNote;
  return out;
}

/**
 * Khi lưu config mới của một slide: giữ dấu vết nhận diện mà trình soạn có thể làm rơi
 * (slide quiz/poll/cũ dựng lại config chỉ từ ô của mình), và đánh dấu `editedByUser` khi
 * giảng viên sửa tay nội dung một slide do AI sinh — để lần cập nhật theo dàn ý sau không ghi đè.
 * - `outlineId`, `aiGenerated`: luôn giữ từ bản cũ nếu bản mới thiếu;
 * - `hidden`: giữ khi bản mới không nhắc đến (bật/tắt ẩn luôn ghi tường minh true/false);
 * - `editedByUser`: đã đặt thì giữ; chưa đặt thì đặt khi nội dung đổi và không phải do AI sửa.
 */
export function mergeSlideMeta(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  opts: { fromAi?: boolean } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...next };
  const old = existing ?? {};
  for (const k of ["outlineId", "aiGenerated"] as const) if (out[k] === undefined && old[k] !== undefined) out[k] = old[k];
  if (out.hidden === undefined && old.hidden === true) out.hidden = true;
  const wasAi = old.aiGenerated === true || out.aiGenerated === true;
  if (old.editedByUser === true || out.editedByUser === true) out.editedByUser = true;
  else if (wasAi && !opts.fromAi && stable(contentOf(old)) !== stable(contentOf(out))) out.editedByUser = true;
  return out;
}

// ── In đậm và in nghiêng trong dòng (tiêu chí H3) ──────────────────────────
// Chỉ hai dấu: **in đậm** và *in nghiêng*. Không có cỡ chữ, font, màu tuỳ chọn.

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Tách chuỗi thành các đoạn có định dạng. Dấu không có cặp đóng được giữ nguyên là chữ thường. */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const push = (t: string, bold: boolean, italic: boolean) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && !!last.bold === bold && !!last.italic === italic) last.text += t;
    else runs.push({ text: t, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
  };
  let i = 0;
  let bold = false;
  let italic = false;
  let buf = "";
  // Có dấu đóng phía sau chưa? Với "*" chỉ tính dấu đơn (không thuộc một cặp "**").
  const closes = (marker: string, from: number) => {
    if (marker === "**") return text.indexOf("**", from) > -1;
    for (let k = from; k < text.length; k++) {
      if (text[k] !== "*") continue;
      if (text[k + 1] === "*") {
        k += 1;
        continue;
      }
      return true;
    }
    return false;
  };
  while (i < text.length) {
    if (text.startsWith("**", i) && (bold || closes("**", i + 2))) {
      push(buf, bold, italic);
      buf = "";
      bold = !bold;
      i += 2;
    } else if (text[i] === "*" && !text.startsWith("**", i) && (italic || closes("*", i + 1))) {
      push(buf, bold, italic);
      buf = "";
      italic = !italic;
      i += 1;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  push(buf, bold, italic);
  return runs;
}

/** Chữ thuần (đã bỏ dấu định dạng) — dùng để ước lượng độ dài khi chọn cỡ chữ. */
export function stripInline(text: string): string {
  return parseInline(text)
    .map((r) => r.text)
    .join("");
}

/**
 * Bọc (hoặc gỡ) dấu định dạng quanh đoạn đang chọn trong ô nhập. Không có đoạn chọn thì giữ nguyên.
 * Trả về chuỗi mới và vùng chọn mới để giữ con trỏ.
 */
export function toggleInlineMarker(
  value: string,
  start: number,
  end: number,
  marker: "**" | "*",
): { value: string; start: number; end: number } {
  if (start >= end) return { value, start, end };
  const m = marker.length;
  const wrapped = value.slice(Math.max(0, start - m), start) === marker && value.slice(end, end + m) === marker;
  // Với "*", đừng nhầm "**" đang bọc đoạn chọn thành một cặp "*".
  const doubleAround = marker === "*" && value.slice(Math.max(0, start - 2), start) === "**" && value.slice(end, end + 2) === "**";
  if (wrapped && !doubleAround) {
    return { value: value.slice(0, start - m) + value.slice(start, end) + value.slice(end + m), start: start - m, end: end - m };
  }
  return { value: value.slice(0, start) + marker + value.slice(start, end) + marker + value.slice(end), start: start + m, end: end + m };
}

// ── Tách một slide quá dài thành hai (tiêu chí H4) ──────────────────────────

/**
 * Tách slide thành hai slide cùng bố cục, chia đều các mục. Chỉ tách được khi mỗi nửa vẫn đủ
 * số mục tối thiểu của bố cục: danh sách từ 4 mục trở lên (thẻ, bước, số liệu, tóm tắt) và
 * slide chữ và hình có từ 2 ý; bảng có từ 2 dòng thì chia đôi các dòng, hai slide cùng hàng tiêu đề.
 * Slide thứ hai giữ tiêu đề kèm "(tiếp)", không có ghi chú giảng
 * và không còn gắn với dòng dàn ý. Trả null khi không tách được.
 */
export function splitSlideConfig(config: Record<string, any>): [Record<string, unknown>, Record<string, unknown>] | null {
  const layout = resolveLayout(config);
  const range = ITEM_RANGE[layout];
  const title: string = typeof config.title === "string" ? config.title : "";
  const cont = title ? (/\(tiếp\)\s*$/.test(title) ? title : `${title} (tiếp)`.slice(0, MAX_LEN.title)) : "";
  const meta = pickMeta(config);
  const firstMeta = { ...meta, editedByUser: true };
  // Slide thứ hai là slide mới của giảng viên: không mang ghi chú, dàn ý hay dấu AI.
  const secondMeta: Record<string, unknown> = { editedByUser: true, ...(meta.hidden ? { hidden: true } : {}) };

  if (range && Array.isArray(config.items)) {
    const items: LayoutItem[] = config.items;
    if (items.length < 4) return null;
    const cut = Math.ceil(items.length / 2);
    const a = items.slice(0, cut);
    const b = items.slice(cut);
    if (a.length < range.min || b.length < range.min) return null;
    return [
      { ...sanitizeLayoutConfig(layout, { ...config, items: a }), ...firstMeta },
      { ...sanitizeLayoutConfig(layout, { ...config, title: cont, items: b, footnote: "" }), ...secondMeta },
    ];
  }
  if (layout === "table" && Array.isArray(config.rows) && config.rows.length >= 2) {
    // Bảng dài: chia đôi các dòng, slide sau lặp lại hàng tiêu đề.
    const rows: string[][] = config.rows;
    const cut = Math.ceil(rows.length / 2);
    return [
      { ...sanitizeLayoutConfig(layout, { ...config, rows: rows.slice(0, cut) }), ...firstMeta },
      { ...sanitizeLayoutConfig(layout, { ...config, title: cont, rows: rows.slice(cut) }), ...secondMeta },
    ];
  }
  if (layout === "image" && Array.isArray(config.bullets) && config.bullets.length >= 2) {
    const bullets: string[] = config.bullets;
    const cut = Math.ceil(bullets.length / 2);
    return [
      { ...sanitizeLayoutConfig(layout, { ...config, bullets: bullets.slice(0, cut) }), ...firstMeta },
      { ...sanitizeLayoutConfig(layout, { ...config, title: cont, bullets: bullets.slice(cut), imageUrl: "" }), ...secondMeta },
    ];
  }
  return null;
}

/** Hai config slide có giống hệt nhau không (không phân biệt thứ tự khoá). */
/**
 * Slide kế bên của slide đang sửa (delta -1 / +1) để nút ‹ › trong cửa sổ sửa chuyển sang đó.
 * `layoutSlide` cho biết slide đích có dùng được trình sửa bố cục mới không; nếu không (quiz, bảng...)
 * thì cửa sổ phải đóng, vì các loại đó có trình sửa riêng.
 */
export function adjacentSlide(
  slides: Array<{ id: string; type: string; config?: unknown }>,
  currentId: string,
  delta: -1 | 1,
): { id: string; layoutSlide: boolean } | null {
  const i = slides.findIndex((s) => s.id === currentId);
  const t = i < 0 ? undefined : slides[i + delta];
  if (!t) return null;
  const cfg = (t.config ?? {}) as { resource?: unknown };
  return { id: t.id, layoutSlide: t.type === "content" && resolveLayout(t.config) !== "classic" && !cfg.resource };
}

/** Mức thu phóng cho phép khi trình chiếu (khớp các nút thu phóng của màn chiếu). */
export const SLIDE_ZOOM_MIN = 0.5;
export const SLIDE_ZOOM_MAX = 2;

/**
 * Tỉ lệ vẽ cuối cùng của slide bố cục: tỉ lệ vừa khung nhân với mức thu phóng của người trình chiếu.
 * Slide bố cục tự co vừa khung chứa nên KHÔNG dùng CSS zoom của khung ngoài (nó bị triệt tiêu khi tự co lại).
 */
export function layoutRenderScale(fitScale: number, zoom: number | undefined): number {
  const z = Number.isFinite(zoom) ? Math.min(SLIDE_ZOOM_MAX, Math.max(SLIDE_ZOOM_MIN, zoom as number)) : 1;
  return fitScale * z;
}

export function slideConfigsEqual(a: unknown, b: unknown): boolean {
  return stable(a ?? {}) === stable(b ?? {});
}
