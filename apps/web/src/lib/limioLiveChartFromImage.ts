// Vẽ lại biểu đồ là hình chụp thành bố cục Biểu đồ: kiểm kết quả AI đọc ảnh, luật đối chiếu theo dòng, dựng slide.
// Tiêu chí V1–V11, docs/tieu-chi/bieu-do-kho-doc-pptx.md. Module thuần, dùng cả ở máy chủ (kiểm kết quả AI) lẫn
// trình sửa slide (màn đối chiếu).
//
// Nguyên tắc: số AI đọc chỉ là đề xuất. Nó sống trong bản nháp đối chiếu; chỉ `applyRedraw` dựng được cấu hình slide, và
// hàm đó trả null khi còn dòng chưa đối chiếu — nên số chưa được giảng viên nhìn qua không có đường nào lên slide.

import { CHART_MAX_SERIES, CHART_MAX_STORED_LABELS, CHART_MIN_LABELS, CHART_TYPES, isNum, numToInput, parseNum, type ChartType } from "./limioLiveCharts";
import { MAX_LEN, pickMeta, resolveLayout, sanitizeLayoutConfig } from "./limioLiveSlides";
import { slideText } from "./limioLiveLanguage";

type Cfg = Record<string, unknown>;

/** Hình đã lưu trong Limio (hình nhập từ PowerPoint, hình giảng viên tải lên): /api/limio-live-media/<tệp>. */
const LIVE_IMAGE = /^\/api\/limio-live-media\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|gif))$/i;

/** Tên tệp của hình lưu trong Limio; null với địa chỉ ngoài hoặc đường dẫn lạ. */
export function liveImageFile(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = LIVE_IMAGE.exec(url.trim());
  return m && !m[1]!.includes("..") ? m[1]! : null;
}

/** V1: slide Chữ và hình có hình lưu trong Limio thì có nút "Vẽ lại thành biểu đồ". */
export function canRedraw(config: Cfg | null | undefined): boolean {
  return !!config && resolveLayout(config) === "image" && !config.resource && liveImageFile(config.imageUrl) !== null;
}

// ── Kết quả AI đọc ảnh (V4) ─────────────────────────────────────────────────

export interface ChartReading {
  chartType: ChartType;
  title: string;
  unit: string;
  labels: string[];
  /** `printed[i]` = số i ghi trên hình; false = AI ước lượng theo vạch chia của trục. */
  series: Array<{ name: string; values: Array<number | null>; printed: boolean[] }>;
}

export type ReadingFailure = "not_chart" | "too_many_labels" | "too_many_series";
export type ReadingResult = { ok: true; reading: ChartReading } | { ok: false; reason: ReadingFailure };

const TYPE_ALIASES: Record<string, ChartType> = { column: "bar", col: "bar", doughnut: "donut", ring: "donut", area: "line" };
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Kiểm và chuẩn hoá JSON AI trả về; không qua kiểm thì trả lý do, giao diện báo và slide giữ hình. */
export function sanitizeChartReading(raw: unknown): ReadingResult {
  const fail = (reason: ReadingFailure): ReadingResult => ({ ok: false, reason });
  if (!raw || typeof raw !== "object") return fail("not_chart");
  const o = raw as Record<string, unknown>;
  if (o.isChart === false) return fail("not_chart");
  const t = str(o.chartType, 20).toLowerCase();
  const chartType = (CHART_TYPES as readonly string[]).includes(t) ? (t as ChartType) : TYPE_ALIASES[t];
  if (!chartType) return fail("not_chart");
  const labels = (Array.isArray(o.labels) ? o.labels : []).map((l) => (typeof l === "number" ? String(l) : str(l, MAX_LEN.chartLabel)));
  if (labels.length > CHART_MAX_STORED_LABELS) return fail("too_many_labels");
  if (labels.length < CHART_MIN_LABELS) return fail("not_chart");
  const rawSeries = (Array.isArray(o.series) ? o.series : []).filter((s): s is Record<string, unknown> => !!s && typeof s === "object");
  if (rawSeries.length > CHART_MAX_SERIES) return fail("too_many_series");
  const series = rawSeries.map((s) => {
    const vals = Array.isArray(s.values) ? s.values : [];
    const printed = Array.isArray(s.printed) ? s.printed : [];
    return {
      name: str(s.name, MAX_LEN.seriesName),
      values: labels.map((_, i) => {
        const n = parseNum(vals[i]);
        return isNum(n) ? n : null;
      }),
      printed: labels.map((_, i) => printed[i] === true),
    };
  });
  if (!series.length || !series.some((s) => s.values.some(isNum))) return fail("not_chart");
  return { ok: true, reading: { chartType, title: str(o.title, MAX_LEN.title), unit: str(o.unit, MAX_LEN.unit), labels, series } };
}

// ── Bản nháp đối chiếu (V5–V8) ──────────────────────────────────────────────

export interface RedrawRow {
  label: string;
  /** Ô số của từng chuỗi, ở dạng chữ để sửa ("71,5"). */
  values: string[];
  /** Số của ô là AI ước lượng theo trục (hình không ghi số). Sửa ô thì hết là ước lượng. */
  estimated: boolean[];
  /** Giảng viên đã đối chiếu dòng này với hình gốc. */
  ok: boolean;
}

export interface RedrawDraft {
  chartType: ChartType;
  title: string;
  unit: string;
  seriesNames: string[];
  rows: RedrawRow[];
}

/** V5: điền sẵn từ kết quả AI; mọi dòng chưa đối chiếu; tiêu đề giữ tiêu đề slide hiện tại. */
export function initRedraw(r: ChartReading, slideTitle: string): RedrawDraft {
  return {
    chartType: r.chartType,
    title: slideTitle.trim() || r.title,
    unit: r.unit,
    seriesNames: r.series.map((s) => s.name),
    rows: r.labels.map((label, i) => ({
      label,
      values: r.series.map((s) => numToInput(s.values[i])),
      estimated: r.series.map((s) => isNum(s.values[i]) && !s.printed[i]),
      ok: false,
    })),
  };
}

const setRow = (d: RedrawDraft, i: number, f: (r: RedrawRow) => RedrawRow): RedrawDraft => ({ ...d, rows: d.rows.map((r, k) => (k === i ? f(r) : r)) });

/** Nút Khớp / Đã khớp. */
export const toggleRow = (d: RedrawDraft, i: number): RedrawDraft => setRow(d, i, (r) => ({ ...r, ok: !r.ok }));
/** Enter trong một ô: dòng đó tính là đã đối chiếu. */
export const confirmRow = (d: RedrawDraft, i: number): RedrawDraft => setRow(d, i, (r) => ({ ...r, ok: true }));

/** Sửa nhãn hoặc một ô số: dòng tính là đã đối chiếu, ô sửa không còn là ước lượng (giảng viên tự gõ). */
export function editCell(d: RedrawDraft, i: number, patch: { label?: string; value?: [number, string] }): RedrawDraft {
  return setRow(d, i, (r) => {
    const next: RedrawRow = { ...r, ok: true };
    if (patch.label !== undefined) next.label = patch.label.slice(0, MAX_LEN.chartLabel);
    if (patch.value) {
      const [k, v] = patch.value;
      next.values = r.values.map((x, j) => (j === k ? v : x));
      next.estimated = r.estimated.map((x, j) => (j === k ? false : x));
    }
    return next;
  });
}

/** Dòng mới do giảng viên tự gõ nên tính là đã đối chiếu. */
export function addRow(d: RedrawDraft): RedrawDraft {
  if (d.rows.length >= CHART_MAX_STORED_LABELS) return d;
  return { ...d, rows: [...d.rows, { label: "", values: d.seriesNames.map(() => ""), estimated: d.seriesNames.map(() => false), ok: true }] };
}

export const removeRow = (d: RedrawDraft, i: number): RedrawDraft => ({ ...d, rows: d.rows.filter((_, k) => k !== i) });
export const setChartType = (d: RedrawDraft, chartType: ChartType): RedrawDraft => ({ ...d, chartType });

export const pendingRows = (d: RedrawDraft) => d.rows.filter((r) => !r.ok).length;
const num = (s: string) => {
  const n = parseNum(s);
  return isNum(n) ? n : null;
};
const usable = (d: RedrawDraft) => d.rows.filter((r) => r.label.trim() || r.values.some((v) => num(v) !== null));

/** V8: mọi dòng đã đối chiếu, và còn ít nhất hai dòng có số. */
export function canApply(d: RedrawDraft): boolean {
  if (pendingRows(d) > 0) return false;
  return usable(d).filter((r) => r.values.some((v) => num(v) !== null)).length >= CHART_MIN_LABELS;
}

/**
 * V7: cấu hình biểu đồ cho bản xem trong màn đối chiếu. Số chỉ lấy ở dòng đã đối chiếu; dòng chưa đối chiếu giữ nhãn,
 * ô trống. Tròn và vành khuyên (cả khối là một tổng) chỉ vẽ khi đã đối chiếu hết: null = chưa vẽ.
 */
export function previewChart(d: RedrawDraft): Cfg | null {
  if ((d.chartType === "pie" || d.chartType === "donut") && pendingRows(d) > 0) return null;
  return sanitizeLayoutConfig("chart", {
    title: d.title,
    chartType: d.chartType,
    unit: d.unit,
    labels: d.rows.map((r) => r.label),
    series: d.seriesNames.map((name, k) => ({ name, values: d.rows.map((r) => (r.ok ? num(r.values[k] ?? "") : null)) })),
  });
}

/** Tiêu đề slide nối tiếp, đuôi theo ngôn ngữ của bài. */
const contTitle = (t: string, lang?: string | null) => {
  const cont = slideText(lang).cont;
  return t.length + cont.length <= MAX_LEN.title ? t + cont : t;
};

/**
 * V9: slide Biểu đồ với đúng số đã đối chiếu (dòng nguồn trống, ghi chú và meta giữ, `fromImage` = hình gốc), cùng
 * slide "(tiếp)" mang các ý của slide cũ nếu có. null khi chưa đối chiếu hết — không có cách nào khác dựng ra slide.
 */
export function applyRedraw(d: RedrawDraft, old: Cfg, lang?: string | null): { chart: Cfg; cont: Cfg | null } | null {
  if (!canApply(d)) return null;
  const rows = usable(d);
  const chart: Cfg = {
    ...sanitizeLayoutConfig("chart", {
      title: d.title,
      chartType: d.chartType,
      unit: d.unit,
      source: "",
      labels: rows.map((r) => r.label),
      series: d.seriesNames.map((name, k) => ({ name, values: rows.map((r) => num(r.values[k] ?? "")) })),
    }),
    ...pickMeta(old),
  };
  const img = liveImageFile(old.imageUrl) ? (old.imageUrl as string) : null;
  if (img) chart.fromImage = img;
  const bullets = (Array.isArray(old.bullets) ? old.bullets : []).filter((b): b is string => typeof b === "string" && !!b.trim());
  const cont = bullets.length ? sanitizeLayoutConfig("image", { title: contTitle(d.title || str(old.title, MAX_LEN.title), lang), bullets }) : null;
  return { chart, cont };
}

/** V11: slide Biểu đồ vẽ lại từ hình → Chữ và hình với hình gốc và tiêu đề hiện tại. null nếu slide không có hình gốc. */
export function restoreImage(config: Cfg): Cfg | null {
  const img = liveImageFile(config.fromImage) ? (config.fromImage as string) : null;
  if (!img) return null;
  const meta = pickMeta(config);
  delete meta.fromImage;
  return { ...sanitizeLayoutConfig("image", { title: config.title, imageUrl: img, imageFit: "contain" }), ...meta };
}
