// Hàm thuần cho hai bố cục "Bảng" và "Biểu đồ" của Limio-Live: đọc số kiểu Việt Nam, đối chiếu
// số với tài liệu gốc (chống bịa số liệu), vạch chia trục, ngắt dòng chữ SVG và chiều cao khung vẽ.
// Không React, không DB: dùng chung cho bộ vẽ, trình sửa, bước sinh slide bằng AI và bộ test.

export const CHART_TYPES = ["bar", "hbar", "line", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const CHART_TYPE_LABEL: Record<ChartType, string> = {
  bar: "Cột",
  hbar: "Thanh ngang",
  line: "Đường",
  pie: "Tròn",
  donut: "Vành khuyên",
};

/** Số nhãn tối đa mỗi loại để chữ trên slide không nhỏ hơn 26 px. Lưu được tối đa CHART_MAX_STORED_LABELS. */
export const CHART_MAX_LABELS: Record<ChartType, number> = { bar: 8, line: 8, hbar: 6, pie: 6, donut: 6 };
/** Biểu đồ cột hai chuỗi: ít nhãn hơn để số trên đầu hai cột không chồng nhau. */
export const CHART_MAX_LABELS_BAR_TWO = 6;
export const CHART_MIN_LABELS = 2;
export const CHART_MAX_STORED_LABELS = 8;
export const CHART_MAX_SERIES = 2;

export const TABLE_LIMITS = { minCols: 2, maxCols: 5, minRows: 1, maxRows: 6 } as const;

export interface ChartSeries {
  name: string;
  values: Array<number | null>;
}

export interface ChartConfig {
  chartType: ChartType;
  labels: string[];
  series: ChartSeries[];
  unit: string;
}

/** Biểu đồ chỉ có một chuỗi số (tròn, vành khuyên). */
export const isSingleSeries = (t: ChartType): boolean => t === "pie" || t === "donut";

/** Số nhãn được vẽ: theo loại biểu đồ và số chuỗi. Các nhãn sau đó vẫn được lưu nhưng không vẽ. */
export function chartLabelLimit(t: ChartType, seriesCount: number): number {
  return t === "bar" && seriesCount >= 2 ? CHART_MAX_LABELS_BAR_TWO : CHART_MAX_LABELS[t];
}

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Đọc số người dùng gõ hoặc dán từ Excel. Ưu tiên kiểu Việt Nam: dấu phẩy là phần thập phân ("3,5"),
 * dấu chấm chia nhóm nghìn ("1.250"). Có cả hai dấu thì dấu đứng sau là phần thập phân ("1,250.5").
 * Chấp nhận "%" ở cuối và khoảng trắng chia nhóm ("1 250"). Trống → null; không đọc được → NaN.
 */
export function parseNum(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  let t = String(input ?? "")
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(/%$/, "")
    .replace(/^[−–]/, "-");
  if (!t) return null;
  if (!/^[-+]?(\d|[.,]\d)[\d.,]*$/.test(t)) return NaN;
  const dot = t.includes(".");
  const comma = t.includes(",");
  if (dot && comma) {
    const dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",";
    t = t.split(dec === "." ? "," : ".").join("").replace(dec, ".");
  } else if (comma) {
    // Từ hai nhóm nghìn trở lên ("1,250,000") chắc chắn là chia nhóm; còn lại là phần thập phân.
    t = /^[-+]?\d{1,3}(,\d{3}){2,}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (dot) {
    if (/^[-+]?[1-9]\d{0,2}(\.\d{3})+$/.test(t) || /^[-+]?\d{1,3}(\.\d{3}){2,}$/.test(t)) t = t.replace(/\./g, "");
    else if ((t.match(/\./g) ?? []).length > 1) return NaN;
  }
  if ((t.match(/\./g) ?? []).length > 1) return NaN;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}

/** Số → chữ để sửa trong ô (kiểu Việt Nam, không chia nhóm nghìn để đọc lại không nhầm). */
export function numToInput(v: number | null | undefined): string {
  return isNum(v) ? String(v).replace(".", ",") : "";
}

const NF = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
/** Số hiển thị trên slide: "1.250", "3,5"; đơn vị "%" ghi liền sau số. */
export function formatValue(v: number, unit = ""): string {
  return NF.format(v) + (unit.trim() === "%" ? "%" : "");
}

// ── Đối chiếu số với tài liệu gốc ───────────────────────────────────────────

const key = (v: number): string => String(Math.round(Math.abs(v) * 1e6) / 1e6);

/** Mọi cách đọc hợp lý của một cụm số trong văn bản ("1.250" có thể là 1250 hoặc 1,25). */
function readings(token: string): number[] {
  const t = token.replace(/%$/, "");
  const out = new Set<number>();
  const vn = parseNum(t);
  if (isNum(vn)) out.add(vn);
  const en = Number(t.replace(/,/g, ""));
  if (Number.isFinite(en)) out.add(en);
  const vnDec = Number(t.replace(/\./g, "").replace(",", "."));
  if (Number.isFinite(vnDec)) out.add(vnDec);
  return [...out];
}

const NUM_TOKEN = /\d+(?:[.,   ]\d+)*/g;

/** Các con số có trong một đoạn văn bản (không phân biệt dấu, chuẩn hoá theo giá trị). */
export function numbersInText(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of String(text ?? "").matchAll(NUM_TOKEN)) {
    const tok = m[0];
    // Cụm có khoảng trắng ("năm 2020 35") có thể là hai số riêng: đọc cả cụm lẫn từng phần.
    const parts = /[\s  ]/.test(tok) ? [tok.replace(/[\s  ]/g, ""), ...tok.split(/[\s  ]+/)] : [tok];
    for (const p of parts) for (const v of readings(p)) out.add(key(v));
  }
  return out;
}

/** Thêm các số của một config slide (chuỗi và số lồng nhau) vào tập số được phép dùng. */
export function addNumbersOf(found: Set<string>, v: unknown): Set<string> {
  if (typeof v === "number" && Number.isFinite(v)) found.add(key(v));
  else if (typeof v === "string") for (const k of numbersInText(v)) found.add(k);
  else if (Array.isArray(v)) for (const x of v) addNumbersOf(found, x);
  else if (v && typeof v === "object") for (const x of Object.values(v)) addNumbersOf(found, x);
  return found;
}

/** Số này có trong tài liệu không? So theo giá trị tuyệt đối ("giảm 5%" khớp −5). */
export function hasNumber(found: Set<string>, v: number): boolean {
  return found.has(key(v));
}

/** Mọi cụm số trong một ô chữ (vd. "Sau 2 tuần", "30%") đều có trong tài liệu không? */
export function cellNumbersInSource(cell: string, found: Set<string>): boolean {
  for (const m of String(cell ?? "").matchAll(NUM_TOKEN)) {
    if (!readings(m[0].replace(/[\s  ]/g, "")).some((v) => found.has(key(v)))) return false;
  }
  return true;
}

// ── Hình học ────────────────────────────────────────────────────────────────

/** Độ rộng ký tự ước lượng (em), cùng hệ số với fitFontSize của bố cục slide. */
export const CHAR_EM = 0.56;
export const textWidth = (s: string, px: number): number => String(s).length * px * CHAR_EM;

/** Vạch chia "đẹp" cho trục (bước 1, 2, 2,5, 5 × 10^k), phủ trọn [lo, hi]. */
export function niceTicks(lo: number, hi: number, want = 5): number[] {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return [0, 1];
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.5;
  // Bước nhỏ nhất (nên trục ít thừa nhất) mà số vạch không quá want + 1.
  const raw = (hi - lo) / Math.max(1, want - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const count = (s: number) => Math.ceil(hi / s - 1e-9) - Math.floor(lo / s + 1e-9) + 1;
  const step = [1, 2, 2.5, 5].flatMap((m) => [m * mag / 10, m * mag, m * mag * 10]).sort((a, b) => a - b).find((s) => count(s) <= want + 1) ?? 10 * mag;
  const a = Math.floor(lo / step + 1e-9) * step;
  const b = Math.ceil(hi / step - 1e-9) * step;
  const out: number[] = [];
  for (let k = 0; a + k * step <= b + step / 2; k++) out.push(Math.round((a + k * step) / step) * step);
  return out.map((v) => Math.round(v * 1e9) / 1e9);
}

/**
 * Ngắt chữ theo từ cho SVG (SVG không tự xuống dòng). Quá `maxLines` dòng thì dòng cuối kết thúc
 * bằng "…" — giới hạn độ dài nhãn ở trình sửa giữ cho việc này hiếm khi xảy ra.
 */
export function wrapLines(text: string, widthPx: number, px: number, maxLines = 2): string[] {
  const per = Math.max(1, Math.floor(widthPx / (px * CHAR_EM)));
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= per || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const cut = (l: string) => (l.length > per ? `${l.slice(0, Math.max(1, per - 1))}…` : l);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]!.slice(0, Math.max(1, per - 1))}…`;
    return kept;
  }
  return lines.map(cut);
}

/** Đẩy các nhãn trên cùng một cạnh ra xa nhau ít nhất `gap`, giữ trong [top, bottom]. Giữ thứ tự gốc. */
export function spreadLabels(ys: number[], gap: number, top: number, bottom: number): number[] {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < idx.length; k++) if (idx[k]!.y - idx[k - 1]!.y < gap) idx[k]!.y = idx[k - 1]!.y + gap;
  const over = idx.length ? idx[idx.length - 1]!.y - bottom : 0;
  if (over > 0) for (const it of idx) it.y -= over;
  for (let k = 0; k < idx.length; k++) if (idx[k]!.y < top + k * gap) idx[k]!.y = top + k * gap;
  const out: number[] = new Array(ys.length);
  for (const it of idx) out[it.i] = it.y;
  return out;
}

// ── Khung vẽ trên slide 1280 × 720 ──────────────────────────────────────────

export const DATA_SLIDE = {
  width: 1280,
  height: 720,
  padX: 96,
  padY: 72,
  /** Khoảng cách giữa tiêu đề, khung dữ liệu và dòng nguồn. */
  gap: 28,
  titleMaxPx: 60,
  sourcePx: 26,
} as const;
export const DATA_CONTENT_W = DATA_SLIDE.width - 2 * DATA_SLIDE.padX;
/** Cỡ chữ bảng trên khung 1280×720: bảng ít chữ được lớn tới 40 px, bảng dày giảm dần tới sàn 26 px. */
export const TABLE_PX = { min: 26, max: 40 } as const;
/** Đệm trên dưới mỗi ô (px): tối thiểu khi bảng dày, tăng dần khi còn chỗ. */
export const TABLE_PAD_Y = { min: 9.5, max: 22 } as const;

/** Dòng nguồn: tự thêm nhãn ("Nguồn:", hoặc "Source:" ở bài tiếng Anh) nếu giảng viên chưa ghi. */
export function sourceLine(source: unknown, label = "Nguồn"): string {
  const s = typeof source === "string" ? source.trim() : "";
  if (!s) return "";
  return /^(nguồn|source)(?![\p{L}])/iu.test(s) ? s : `${label}: ${s}`;
}

/** Chiều cao còn lại cho bảng hoặc biểu đồ sau tiêu đề (đã biết số dòng) và dòng nguồn. */
export function dataBoxHeight(titleLines: number, titlePx: number, hasSource: boolean): number {
  const { height, padY, gap, sourcePx } = DATA_SLIDE;
  const titleH = titleLines > 0 ? titleLines * titlePx * 1.2 + gap : 0;
  return Math.max(160, height - 2 * padY - titleH - (hasSource ? sourcePx * 1.3 + gap : 0));
}

/** Cột toàn số (bỏ ô trống, cần ít nhất một ô có số) — để căn phải và để chuyển sang biểu đồ. */
export function numericColumns(rows: string[][], cols: number): boolean[] {
  return Array.from({ length: cols }, (_, j) => {
    const cells = rows.map((r) => String(r[j] ?? "").trim()).filter(Boolean);
    return cells.length > 0 && cells.every((c) => isNum(parseNum(c)));
  });
}

/**
 * Cỡ chữ lớn nhất (34 → 26 px) để cả bảng vừa chiều cao `availH`. Ước lượng mỗi cột rộng bằng nhau.
 * `overflow` = true khi ở 26 px vẫn chưa vừa — trình sửa hiện cảnh báo "Slide dài".
 */
export function tableFontSize(
  head: string[],
  rows: string[][],
  widthPx: number,
  availH: number,
): { px: number; padY: number; overflow: boolean } {
  const cols = Math.max(1, head.length, ...rows.map((r) => r.length));
  const colW = widthPx / cols - 40; // đệm trái phải 20 px mỗi bên (slideLayouts.css)
  const showHead = head.some((h) => h.trim());
  const all = showHead ? [head, ...rows] : rows;
  const total = (px: number, padY: number) =>
    all.reduce((sum, r) => {
      const per = Math.max(1, Math.floor(colW / (px * CHAR_EM)));
      const ln = Math.max(1, ...r.map((c) => Math.ceil(String(c ?? "").length / per) || 1));
      return sum + ln * px * 1.25 + 2 * padY + 2; // đệm trên dưới + viền 2 px
    }, 14);
  for (let px = TABLE_PX.max; px >= TABLE_PX.min; px -= 2) {
    const used = total(px, TABLE_PAD_Y.min);
    if (used <= availH) {
      // Bảng ít hàng: chỗ trống còn lại chia đều thành đệm trên dưới của từng ô, để bảng trải hết khung thay vì co ở trên.
      const padY = Math.min(TABLE_PAD_Y.max, TABLE_PAD_Y.min + (availH - used) / (2 * Math.max(all.length, 1)));
      return { px, padY: Math.floor(padY), overflow: false };
    }
  }
  return { px: TABLE_PX.min, padY: TABLE_PAD_Y.min, overflow: true };
}

/** Tách vùng ô chép từ Excel hoặc Google Sheets (dòng theo xuống dòng, ô theo tab). Một ô đơn → null. */
export function parseClipboardGrid(text: string): string[][] | null {
  const rows = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "")
    .split("\n")
    .map((r) => r.split("\t"));
  return rows.length > 1 || (rows[0]?.length ?? 0) > 1 ? rows : null;
}

/** Mô tả cho trình đọc màn hình: loại biểu đồ và từng cặp nhãn – số. */
export function chartAltText(c: ChartConfig): string {
  const kind = { bar: "Biểu đồ cột", hbar: "Biểu đồ thanh ngang", line: "Biểu đồ đường", pie: "Biểu đồ tròn", donut: "Biểu đồ vành khuyên" }[c.chartType];
  const series = isSingleSeries(c.chartType) ? c.series.slice(0, 1) : c.series;
  return `${kind}. ${series
    .map(
      (s) =>
        `${s.name ? `${s.name}: ` : ""}${c.labels
          .map((l, i) => `${l} ${isNum(s.values[i]) ? formatValue(s.values[i] as number, c.unit) : "không có số"}`)
          .join(", ")}`,
    )
    .join(". ")}${c.unit && c.unit !== "%" ? `. Đơn vị: ${c.unit}` : ""}.`;
}

// ── Dán vùng ô vào trình sửa ────────────────────────────────────────────────

/**
 * Dán vùng ô vào lưới bảng (dòng 0 là hàng tiêu đề) bắt đầu từ ô (r0, c0). Lưới tự nở thêm dòng, cột
 * đến giới hạn; phần vượt quá bị bỏ và được đếm để báo cho giảng viên.
 */
export function pasteIntoTable(
  cells: string[][],
  grid: string[][],
  r0: number,
  c0: number,
  cellMax = 60,
): { cells: string[][]; droppedRows: number; droppedCols: number } {
  const maxRows = TABLE_LIMITS.maxRows + 1;
  const maxCols = TABLE_LIMITS.maxCols;
  const out = cells.map((r) => [...r]);
  const width = Math.max(0, ...grid.map((r) => r.length));
  const needCols = Math.min(maxCols, Math.max(out[0]?.length ?? 0, c0 + width));
  for (const r of out) while (r.length < needCols) r.push("");
  let droppedRows = 0;
  grid.forEach((row, i) => {
    const r = r0 + i;
    if (r >= maxRows) {
      droppedRows += 1;
      return;
    }
    while (out.length <= r) out.push(Array.from({ length: needCols }, () => ""));
    row.forEach((cell, j) => {
      if (c0 + j < maxCols) out[r]![c0 + j] = cell.trim().slice(0, cellMax);
    });
  });
  return { cells: out, droppedRows, droppedCols: Math.max(0, c0 + width - maxCols) };
}

export interface ChartDraft {
  labels: string[];
  series: Array<{ name: string; values: string[] }>;
}

/**
 * Dán vùng ô vào lưới biểu đồ. Cột 0 là nhãn, cột 1–2 là hai chuỗi số; `r0 = -1` là hàng tên chuỗi.
 * Dòng đầu vùng dán mà mọi ô số đều là chữ thì lấy làm tên chuỗi. Dán tới cột thứ ba thì tự thêm chuỗi
 * thứ hai; cột sau đó bị bỏ. Lưu tối đa CHART_MAX_STORED_LABELS dòng.
 */
export function pasteIntoChart(
  s: ChartDraft,
  grid: string[][],
  r0: number,
  c0: number,
  labelMax = 40,
): ChartDraft & { usedHeader: boolean; droppedCols: number; droppedRows: number } {
  const labels = [...s.labels];
  const series = s.series.map((x) => ({ name: x.name, values: [...x.values] }));
  let rows = grid;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const lastCol = c0 + width - 1;
  if (lastCol >= 2 && series.length < 2) series.push({ name: "", values: labels.map(() => "") });
  const valueCells = (r: string[]) => (c0 === 0 ? r.slice(1) : r);
  const usedHeader =
    r0 === -1 || (rows.length > 1 && valueCells(rows[0]!).length > 0 && valueCells(rows[0]!).every((x) => x.trim() && !isNum(parseNum(x))));
  if (usedHeader) {
    valueCells(rows[0]!).forEach((nm, k) => {
      const idx = (c0 === 0 ? 0 : c0 - 1) + k;
      if (idx < series.length) series[idx]!.name = nm.trim().slice(0, labelMax);
    });
    rows = rows.slice(1);
  }
  const start = Math.max(0, r0);
  let droppedRows = 0;
  rows.forEach((row, i) => {
    const r = start + i;
    if (r >= CHART_MAX_STORED_LABELS) {
      droppedRows += 1;
      return;
    }
    while (labels.length <= r) {
      labels.push("");
      for (const x of series) x.values.push("");
    }
    row.forEach((cell, j) => {
      const c = c0 + j;
      if (c === 0) labels[r] = cell.trim().slice(0, labelMax);
      else if (c <= series.length) series[c - 1]!.values[r] = cell.trim();
    });
  });
  for (const x of series) while (x.values.length < labels.length) x.values.push("");
  return { labels, series, usedHeader, droppedCols: Math.max(0, lastCol - 2), droppedRows };
}
