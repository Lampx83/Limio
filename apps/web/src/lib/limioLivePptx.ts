// Bài giảng nhập từ PowerPoint: dữ liệu lưu kèm bài (LiveDeck.importSource), cách "Giữ ý, làm đẹp lại" (mỗi slide gốc
// thành slide Limio theo quy tắc, không AI) và việc dựng slide của dòng dàn ý lấy từ slide gốc.
// Tiêu chí: docs/tieu-chi/nhap-powerpoint.md (M1–M3, P14–P23). Module thuần, không DB.
//
// Nguyên tắc: chữ của giảng viên không bao giờ bị cắt mất. Bố cục Limio chứa ít chữ hơn slide PowerPoint, nên chữ
// thừa đi sang slide "(tiếp)" và ý quá dài được tách ở ranh giới câu, không cắt cụt.

import {
  CHART_MAX_SERIES,
  CHART_MIN_LABELS,
  DATA_CONTENT_W,
  TABLE_LIMITS,
  chartLabelLimit,
  formatValue,
  isNum,
  tableFontSize,
  type ChartType,
} from "./limioLiveCharts";
import { configFromOutline, estimateGenerationTokens, type GeneratedSlide } from "./limioLiveGenerate";
import {
  OUTLINE_LIMITS,
  finalizeParts,
  inferParts,
  isImportedRow,
  listVi,
  newOutlineId,
  normalizeOutline,
  stripEmoji,
  type Outline,
  type OutlineLayout,
  type OutlineOrigin,
  type OutlineSlide,
} from "./limioLiveOutline";
import {
  ITEM_RANGE,
  MAX_LEN,
  SLIDE_ICONS,
  convertLayoutConfig,
  dataSlideMetrics,
  normalizeContentSlideConfig,
  sanitizeLayoutConfig,
} from "./limioLiveSlides";
import type { PptxChart, PptxDeck, PptxFlag, PptxParagraph, PptxSlide } from "./pptxImport";

// ── Dữ liệu lưu kèm bài ─────────────────────────────────────────────────────

export interface ImportedSlide {
  n: number;
  hidden: boolean;
  layoutType: string | null;
  title: string;
  subtitle: string[];
  paragraphs: PptxParagraph[];
  notes: string;
  /** Hình lớn nhất của slide (đã lưu); null nếu không có hoặc bố cục không dùng hình. */
  imageUrl: string | null;
  /** Số hình giữ được của slide gốc (đã bỏ logo); lớn hơn 1 nghĩa là có hình chưa đưa lên slide. */
  imageCount: number;
  tables: string[][][];
  charts: PptxChart[];
  smartArt: PptxParagraph[];
  flags: PptxFlag[];
}

export interface ImportSource {
  format: "pptx";
  fileName: string;
  slides: ImportedSlide[];
}

/** Ghi chú giảng giữ tối đa bấy nhiêu ký tự (MAX_LEN.notes). */
export const NOTES_MAX = MAX_LEN.notes;

export function toImportedSlide(s: PptxSlide, imageUrl: string | null): ImportedSlide {
  return {
    n: s.n,
    hidden: s.hidden,
    layoutType: s.layoutType,
    title: s.title,
    subtitle: s.subtitle.map((p) => p.text),
    paragraphs: s.paragraphs,
    notes: s.notes,
    imageUrl,
    imageCount: s.images.length,
    tables: s.tables,
    charts: s.charts,
    smartArt: s.smartArt,
    flags: s.flags,
  };
}

const str = (v: unknown, max = 20_000) => (typeof v === "string" ? v.slice(0, max) : "");
const paras = (v: unknown): PptxParagraph[] =>
  (Array.isArray(v) ? v : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ text: str(p.text, 4000), level: Math.max(0, Math.min(8, Number(p.level) || 0)), numbered: p.numbered === true }))
    .filter((p) => p.text);

/** Đọc lại cột LiveDeck.importSource (JSON) — không tin hình dạng dữ liệu cũ. */
export function sanitizeImportSource(raw: unknown): ImportSource | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== "pptx" || !Array.isArray(o.slides)) return null;
  const slides = o.slides
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map(
      (s): ImportedSlide => ({
        n: Number(s.n) || 0,
        hidden: s.hidden === true,
        layoutType: typeof s.layoutType === "string" ? s.layoutType : null,
        title: str(s.title, 1000),
        subtitle: (Array.isArray(s.subtitle) ? s.subtitle : []).map((x) => str(x, 2000)).filter(Boolean),
        paragraphs: paras(s.paragraphs),
        notes: str(s.notes),
        imageUrl: typeof s.imageUrl === "string" && s.imageUrl.startsWith("/api/") ? s.imageUrl.slice(0, 500) : null,
        imageCount: Number(s.imageCount) || 0,
        tables: (Array.isArray(s.tables) ? s.tables : []).filter(Array.isArray).map((t) =>
          (t as unknown[]).filter(Array.isArray).map((r) => (r as unknown[]).map((c) => str(c, 2000))),
        ),
        charts: (Array.isArray(s.charts) ? s.charts : []).filter((c): c is PptxChart => !!c && typeof c === "object" && Array.isArray((c as PptxChart).series)),
        smartArt: paras(s.smartArt),
        flags: (Array.isArray(s.flags) ? s.flags : []).filter((f): f is PptxFlag => typeof f === "string"),
      }),
    )
    .filter((s) => s.n > 0);
  return { format: "pptx", fileName: str(o.fileName, 200), slides };
}

/** Chữ của cả bài cho AI đọc và để đối chiếu số liệu (LiveDeck.sourceText). */
export function importSourceText(src: Pick<ImportSource, "slides">): string {
  return src.slides
    .map((s) => {
      const lines = [`Slide ${s.n}: ${s.title}`];
      for (const t of s.subtitle) lines.push(t);
      for (const p of [...s.paragraphs, ...s.smartArt]) lines.push(`${"  ".repeat(p.level)}- ${p.text}`);
      for (const t of s.tables) for (const r of t) lines.push(`| ${r.join(" | ")} |`);
      for (const c of s.charts) {
        lines.push(`Biểu đồ${c.title ? ` "${c.title}"` : ""}:`);
        for (const se of c.series) lines.push(`${se.name || "Số liệu"}: ${c.labels.map((l, i) => `${l} ${se.values[i] ?? ""}${c.unit}`).join("; ")}`);
      }
      if (s.notes) lines.push(`Ghi chú giảng: ${s.notes}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

// ── Tách chữ không mất chữ ──────────────────────────────────────────────────

function pack(parts: string[], max: number, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    const next = cur ? cur + sep + p : p;
    if (next.length <= max) cur = next;
    else {
      if (cur) out.push(cur);
      cur = p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Chia một đoạn dài thành các đoạn ≤ max: ở ranh giới câu, rồi dấu phẩy/chấm phẩy, rồi khoảng trắng; ghép lại đủ chữ. */
export function splitText(text: string, max: number): string[] {
  const t = text.trim();
  if (t.length <= max) return t ? [t] : [];
  const levels: Array<[RegExp, string]> = [
    [/(?<=[.!?…])\s+/, " "],
    [/(?<=[,;:])\s+/, " "],
    [/\s+/, " "],
  ];
  const go = (s: string, lv: number): string[] => {
    if (s.length <= max) return [s];
    if (lv >= levels.length) {
      const out: string[] = [];
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
      return out;
    }
    const [re, sep] = levels[lv]!;
    const parts = s.split(re).filter(Boolean);
    if (parts.length <= 1) return go(s, lv + 1);
    return pack(parts.flatMap((p) => go(p, lv + 1)), max, sep);
  };
  return go(t, 0);
}

/** Chia mảng thành các nhóm ≤ max, cỡ đều nhau (7 → 3+2+2 thay vì 3+3+1). */
export function chunkBalanced<T>(arr: T[], max: number): T[][] {
  if (!arr.length) return [];
  const k = Math.ceil(arr.length / max);
  const base = Math.floor(arr.length / k);
  let extra = arr.length % k;
  const out: T[][] = [];
  let i = 0;
  for (let g = 0; g < k; g++) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    out.push(arr.slice(i, i + size));
    i += size;
  }
  return out;
}

// ── Từ slide gốc sang slide Limio ───────────────────────────────────────────

interface Item {
  text: string;
  children: string[];
  numbered: boolean;
}

/** Đoạn cấp 0 mở một mục; đoạn cấp sâu hơn là ý con của mục đang mở. */
export function itemsOf(ps: PptxParagraph[]): Item[] {
  const out: Item[] = [];
  for (const p of ps) {
    const last = out[out.length - 1];
    if (p.level > 0 && last) last.children.push(p.text);
    else out.push({ text: p.text, children: [], numbered: p.numbered });
  }
  return out;
}

/** Một slide Limio dựng từ (một phần của) slide gốc. */
export interface ImportPiece {
  layout: OutlineLayout;
  /** Đã qua sanitizeLayoutConfig; chưa có meta (ghi chú, dòng dàn ý). */
  config: Record<string, unknown>;
}

const CONT = " (tiếp)";
const contTitle = (t: string) => (t.length + CONT.length <= MAX_LEN.title ? t + CONT : t);
const ICONS = SLIDE_ICONS.slice(0, 6);

/** Ý con nối vào câu của mục ("Mục: ý 1; ý 2"); ngắn thì giữ một ý, dài thì mỗi ý con một dòng. */
function flattenItem(it: Item, max: number): string[] {
  if (!it.children.length) return splitText(it.text, max);
  const joined = `${it.text}${/[:：]$/.test(it.text) ? "" : ":"} ${it.children.join("; ")}`;
  if (joined.length <= max) return [joined];
  return [...splitText(it.text, max), ...it.children.flatMap((c) => splitText(c, max))];
}

const bodyOf = (it: Item) => it.children.join("; ");
const fits = (s: string, max: number) => s.length <= max;

function bulletPieces(title: string, bullets: string[], imageUrl: string | null, first: boolean): ImportPiece[] {
  const groups = chunkBalanced(bullets, 3);
  if (!groups.length) groups.push([]);
  return groups.map((g, k) => ({
    layout: "image" as const,
    config: sanitizeLayoutConfig("image", {
      title: k === 0 && first ? title : contTitle(title),
      bullets: g,
      ...(k === 0 && imageUrl ? { imageUrl, imageFit: "contain" } : {}),
    }),
  }));
}

/** Danh sách mục (chữ, SmartArt) → Các bước / Ba thẻ / Tóm tắt / Chữ và hình. */
function itemPieces(title: string, items: Item[], imageUrl: string | null, opts: { first: boolean; preferSteps: boolean }): ImportPiece[] {
  const n = items.length;
  const stepsRange = ITEM_RANGE.steps!;
  const cardsRange = ITEM_RANGE.cards!;
  const head = MAX_LEN.itemHeading;
  const body = MAX_LEN.itemBody;
  const t0 = opts.first ? title : contTitle(title);
  if (!imageUrl && opts.preferSteps && n >= stepsRange.min && n <= stepsRange.max && items.every((it) => fits(it.text, head) && fits(bodyOf(it), body))) {
    return [{ layout: "steps", config: sanitizeLayoutConfig("steps", { title: t0, items: items.map((it) => ({ heading: it.text, body: bodyOf(it) })) }) }];
  }
  if (
    !imageUrl &&
    n >= cardsRange.min &&
    n <= cardsRange.max &&
    items.every((it) => it.children.length > 0 && fits(it.text, head) && fits(bodyOf(it), body))
  ) {
    return [
      {
        layout: "cards",
        config: sanitizeLayoutConfig("cards", { title: t0, items: items.map((it, i) => ({ heading: it.text, body: bodyOf(it), icon: ICONS[i % ICONS.length] })) }),
      },
    ];
  }
  const summaryMax = ITEM_RANGE.summary!.max;
  if (!imageUrl && n >= 4 && items.every((it) => !it.children.length && fits(it.text, head))) {
    return chunkBalanced(items, summaryMax).map((g, k) => ({
      layout: "summary" as const,
      config: sanitizeLayoutConfig("summary", { title: k === 0 ? t0 : contTitle(title), items: g.map((it) => ({ heading: it.text })) }),
    }));
  }
  return bulletPieces(title, items.flatMap((it) => flattenItem(it, MAX_LEN.bullet)), imageUrl, opts.first);
}

/** Số trên bảng dựng từ biểu đồ: kiểu Việt Nam, đơn vị % ghi liền. */
const cellNum = (v: number | null, unit: string) => (isNum(v) ? formatValue(v, unit) : "");

/** Bảng → các slide Bảng (lặp hàng tiêu đề, số hàng mỗi slide theo chỗ trống) hoặc danh sách nếu không vừa khung. */
function tablePieces(title: string, table: string[][], first: boolean): ImportPiece[] {
  const [head0, ...rows0] = table;
  const head = head0 ?? [];
  const cols = Math.max(head.length, ...rows0.map((r) => r.length));
  const fitsGrid =
    cols >= TABLE_LIMITS.minCols && cols <= TABLE_LIMITS.maxCols && table.every((r) => r.every((c) => c.length <= MAX_LEN.tableCell));
  if (!fitsGrid) {
    const line = (r: string[]) => {
      const cells = r.filter((c) => c.trim());
      return cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(" · ")}` : (cells[0] ?? "");
    };
    return bulletPieces(title, table.map(line).filter(Boolean).flatMap((l) => splitText(l, MAX_LEN.bullet)), null, first);
  }
  const rows = rows0.length ? rows0 : [];
  const out: ImportPiece[] = [];
  let i = 0;
  do {
    const t = out.length === 0 && first ? title : contTitle(title);
    const availH = dataSlideMetrics({ title: t }).boxH;
    let take = Math.min(TABLE_LIMITS.maxRows, rows.length - i);
    while (take > 1 && tableFontSize(head, rows.slice(i, i + take), DATA_CONTENT_W, availH).overflow) take -= 1;
    out.push({ layout: "table", config: sanitizeLayoutConfig("table", { title: t, head, rows: rows.slice(i, i + Math.max(take, 0)) }) });
    i += Math.max(take, 1);
  } while (i < rows.length);
  return out;
}

const CHART_TYPE_OF: Record<PptxChart["type"], ChartType> = { bar: "bar", hbar: "hbar", line: "line", pie: "pie", donut: "donut", other: "bar" };

/** Biểu đồ vừa khung → Biểu đồ (số giữ nguyên); không vừa → Bảng số liệu (hoặc danh sách). */
function chartPieces(title: string, c: PptxChart, first: boolean): ImportPiece[] {
  const type = CHART_TYPE_OF[c.type];
  const series = c.series.filter((s) => s.values.some(isNum));
  const n = c.labels.length;
  const t = first ? title || c.title : contTitle(title || c.title);
  const ok =
    series.length >= 1 &&
    series.length <= CHART_MAX_SERIES &&
    n >= CHART_MIN_LABELS &&
    n <= chartLabelLimit(type, series.length) &&
    c.labels.every((l) => l.length <= MAX_LEN.chartLabel) &&
    series.every((s) => s.name.length <= MAX_LEN.seriesName) &&
    (!(type === "pie" || type === "donut") || (series.length === 1 && series[0]!.values.every((v) => v === null || v >= 0)));
  if (ok) {
    return [{ layout: "chart", config: sanitizeLayoutConfig("chart", { title: t, chartType: type, labels: c.labels, series, unit: c.unit }) }];
  }
  const head = ["", ...series.map((s) => s.name || "Số liệu")];
  const rows = c.labels.map((l, i) => [l, ...series.map((s) => cellNum(s.values[i] ?? null, c.unit))]);
  return tablePieces(t, [head, ...rows], true);
}

/** Bìa / Mở phần: dòng đầu (hoặc các dòng ghép bằng " · " nếu vừa) làm phụ đề, phần còn lại sang slide sau. */
function headPiece(layout: "cover" | "section", title: string, lines: string[]): { piece: ImportPiece; rest: string[] } {
  let subtitle = "";
  let used = 0;
  for (const l of lines) {
    const next = subtitle ? `${subtitle} · ${l}` : l;
    if (next.length > MAX_LEN.subtitle) break;
    subtitle = next;
    used += 1;
  }
  return { piece: { layout, config: sanitizeLayoutConfig(layout, { title, subtitle }) }, rest: lines.slice(used) };
}

/**
 * Quy tắc chọn bố cục cho một slide gốc (tiêu chí P15–P20). `first`: slide đầu của bài.
 * Luôn trả ít nhất một slide; mọi chữ của slide gốc có mặt trong các slide trả về.
 */
export function piecesFor(s: ImportedSlide, opts: { first: boolean }): ImportPiece[] {
  let title = s.title.trim();
  const lead: PptxParagraph[] = [];
  if (title.length > MAX_LEN.title) {
    const [head, ...rest] = splitText(title, MAX_LEN.title);
    title = head!;
    lead.push(...rest.map((text) => ({ text, level: 0, numbered: false })));
  }
  if (!title) title = s.charts[0]?.title || `Slide ${s.n}`;
  const items = itemsOf([...lead, ...s.paragraphs]);
  const hasData = s.tables.length > 0 || s.charts.length > 0;
  const titleOnly = !items.length && !s.subtitle.length && !hasData && !s.smartArt.length && !s.imageUrl;
  const out: ImportPiece[] = [];
  const restAsBullets = (lines: string[], img: string | null = null) => {
    if (!lines.length) return;
    out.push(...bulletPieces(title, lines.flatMap((l) => splitText(l, MAX_LEN.bullet)), img, false));
  };

  // Slide "Section Header" luôn là slide mở phần, kể cả khi chỉ có tiêu đề.
  const isSection = !opts.first && s.layoutType === "secHead" && !hasData;
  if (!isSection && (opts.first || s.layoutType === "title" || titleOnly)) {
    const lines = [...s.subtitle, ...items.flatMap((it) => [it.text, ...it.children])];
    const { piece, rest } = headPiece("cover", title, lines);
    out.push(piece);
    restAsBullets(rest);
  } else if (isSection) {
    const lines = [...s.subtitle, ...items.flatMap((it) => [it.text, ...it.children])];
    const { piece, rest } = headPiece("section", title, lines);
    out.push(piece);
    restAsBullets(rest, s.imageUrl);
  } else if (hasData) {
    let first = true;
    for (const t of s.tables) {
      out.push(...tablePieces(title, t, first));
      first = false;
    }
    for (const c of s.charts) {
      out.push(...chartPieces(title, c, first));
      first = false;
    }
    const more = [...s.subtitle.map((text) => ({ text, children: [], numbered: false })), ...items, ...itemsOf(s.smartArt)];
    if (more.length) out.push(...itemPieces(title, more, s.imageUrl, { first: false, preferSteps: false }));
  } else {
    const smart = itemsOf(s.smartArt);
    const sub = s.subtitle.map((text) => ({ text, children: [] as string[], numbered: false }));
    if (smart.length) {
      out.push(...itemPieces(title, smart, null, { first: true, preferSteps: true }));
      const more = [...sub, ...items];
      if (more.length || s.imageUrl) out.push(...itemPieces(title, more, s.imageUrl, { first: false, preferSteps: false }));
    } else {
      const all = [...sub, ...items];
      const numbered = all.length > 0 && all.every((it) => it.numbered);
      out.push(...itemPieces(title, all, s.imageUrl, { first: true, preferSteps: numbered }));
    }
  }
  return out;
}

// ── Dàn ý của cách "Giữ ý" ──────────────────────────────────────────────────

/** Các ý hiện trong dòng dàn ý (tóm nội dung slide; tối đa 5 ý như dàn ý thường). */
export function pointsOf(p: ImportPiece): string[] {
  const c = p.config as Record<string, any>;
  let pts: string[] = [];
  switch (p.layout) {
    case "cover":
    case "section":
      pts = c.subtitle ? [c.subtitle] : [];
      break;
    case "image":
      pts = c.bullets ?? [];
      break;
    case "cards":
    case "steps":
      pts = (c.items ?? []).map((it: { heading: string; body: string }) => (it.body ? `${it.heading}: ${it.body}` : it.heading));
      break;
    case "summary":
      pts = (c.items ?? []).map((it: { heading: string }) => it.heading);
      break;
    case "table":
      pts = [c.head, ...(c.rows ?? [])].filter((r: string[] | undefined) => r?.some((x) => x.trim())).map((r: string[]) => r.filter(Boolean).join(" · "));
      break;
    case "chart":
      pts = (c.labels ?? []).map((l: string, i: number) =>
        `${l}: ${(c.series ?? []).map((s: { values: Array<number | null> }) => cellNum(s.values[i] ?? null, c.unit ?? "")).join(" / ")}`,
      );
      break;
    default:
      pts = [];
  }
  // Cùng cách lọc với sanitizeOutline để dấu `sig` so được sau khi giảng viên lưu dàn ý.
  return pts
    .map((x) => stripEmoji(String(x)).slice(0, OUTLINE_LIMITS.point))
    .filter(Boolean)
    .slice(0, OUTLINE_LIMITS.points);
}

/** Dấu ngắn của các ý (FNV-1a 32 bit, hệ 36). */
export function pointsSig(points: string[]): string {
  let h = 0x811c9dc5;
  const s = JSON.stringify(points);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Các dòng dàn ý dựng từ một slide gốc (một dòng mỗi slide Limio). */
export function rowsForSlide(s: ImportedSlide, opts: { first: boolean; how?: "same" | "back" }): OutlineSlide[] {
  const pieces = piecesFor(s, opts);
  return pieces.map((p, k) => {
    const points = pointsOf(p);
    const c = p.config as Record<string, unknown>;
    return {
      id: newOutlineId(),
      kind: "content" as const,
      layout: p.layout,
      title: stripEmoji(String(c.title ?? c.quote ?? s.title)).slice(0, OUTLINE_LIMITS.slideTitle) || `Slide ${s.n}`,
      points,
      origin: {
        slides: [s.n],
        how: opts.how ?? "same",
        ...(pieces.length > 1 ? { piece: k + 1, pieces: pieces.length } : {}),
        sig: pointsSig(points),
      },
    };
  });
}

/** Cách "Giữ ý": mỗi slide gốc thành (các) dòng dàn ý theo đúng thứ tự, chia phần như dàn ý cũ (P14, P21). */
export function keepOutline(src: Pick<ImportSource, "slides">, title: string): Outline {
  const slides = src.slides.flatMap((s, i) => rowsForSlide(s, { first: i === 0 }));
  const o = finalizeParts(inferParts({ title: stripEmoji(title).slice(0, OUTLINE_LIMITS.title), slides }));
  // Phần Nội dung không mở bằng slide Mở phần được đặt tên chung ("Phần 1"); tên đó sẽ hiện trên mục lục của bìa phần,
  // nên lấy tiêu đề slide đầu của phần (chữ của giảng viên) thay cho tên tự đặt.
  const content = o.parts.filter((p) => p.role === "content");
  if (content.length > 1) {
    for (const p of content) {
      const first = o.slides.find((x) => x.partId === p.id);
      if (first && first.layout !== "section") p.name = first.title.slice(0, OUTLINE_LIMITS.partName);
    }
  }
  return finalizeParts(o);
}

// ── Tạo slide cho dòng lấy từ slide gốc (không AI) ──────────────────────────

/** Ghi chú giảng gốc của các slide, nối theo thứ tự slide; nguyên chữ. */
export function joinedNotes(src: Pick<ImportSource, "slides">, nums: number[]): string {
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => src.slides.find((s) => s.n === n)?.notes.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, NOTES_MAX);
}

/**
 * Slide của một dòng dàn ý lấy nguyên từ một slide gốc ("same" hoặc "back"), dựng không qua AI (P22).
 * Trả null nếu dòng không thuộc loại này (AI viết như thường).
 * - Giảng viên sửa tiêu đề: dùng tiêu đề mới, thân vẫn từ slide gốc.
 * - Giảng viên sửa các ý (dấu `sig` khác): dựng từ các ý đã sửa, vẫn giữ hình và ghi chú gốc.
 * - Giảng viên đổi bố cục: đổi nội dung gốc sang bố cục đó.
 */
export function importedSlideFor(row: OutlineSlide, src: Pick<ImportSource, "slides"> | null, sectionNo = ""): GeneratedSlide | null {
  const o = row.origin;
  if (!src || !o || !isImportedRow(row)) return null;
  const idx = src.slides.findIndex((s) => s.n === o.slides[0]);
  if (idx < 0) return null;
  const s = src.slides[idx]!;
  const pieces = piecesFor(s, { first: idx === 0 && o.how === "same" });
  const k = Math.min(Math.max((o.piece ?? 1) - 1, 0), pieces.length - 1);
  const piece = pieces[k]!;
  const notes = k === 0 ? joinedNotes(src, [s.n]) : "";
  const meta = {
    outlineId: row.id,
    aiGenerated: true,
    ...(notes ? { presenterNote: notes } : {}),
    ...(s.hidden ? { hidden: true } : {}),
  };

  let config: Record<string, unknown>;
  const layout = row.layout ?? piece.layout;
  if (o.sig && pointsSig(row.points) !== o.sig) {
    const g = configFromOutline({ ...row, layout }, sectionNo);
    config = { ...g.config };
    if (layout === "image" && s.imageUrl && k === 0) Object.assign(config, { imageUrl: s.imageUrl, imageFit: "contain" });
  } else {
    config = layout === piece.layout ? { ...piece.config } : { ...convertLayoutConfig(piece.config, layout) };
    if (layout === "section" && sectionNo) config.sectionNumber = sectionNo;
    if (row.title.trim() && layout !== "quote") config.title = row.title.trim();
  }
  for (const key of ["outlineId", "aiGenerated", "presenterNote"]) delete config[key];
  return {
    type: "content",
    config: normalizeContentSlideConfig({ ...config, ...meta }) as Record<string, unknown>,
    usedFallback: false,
  };
}

// ── Cách "Soạn lại mạch" (AI đề xuất dàn ý, mốc 2) ─────────────────────────

const validNums = (v: unknown, max: number): number[] =>
  [...new Set((Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);

/**
 * Đổi "from"/"basis" AI trả về thành nguồn của dòng (tiêu chí P25): số ngoài khoảng bị bỏ; một slide gốc → "same"
 * (nếu cùng slide gốc đứng một mình ở nhiều dòng thì đó là tách slide: "split"); nhiều slide → "merge"; không có →
 * "new" kèm các slide làm căn cứ. Slide tương tác lấy nội dung từ slide gốc vẫn là "new" (dựa trên).
 */
export function originsFromAi(raw: unknown, slideCount: number): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { slides?: unknown }).slides)) return raw;
  const o = raw as { slides: unknown[] };
  const rows = o.slides.map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null));
  const froms = rows.map((r) => validNums(r?.from, slideCount));
  const alone = new Map<number, number>();
  rows.forEach((r, i) => {
    if (r && (r.kind ?? "content") === "content" && froms[i]!.length === 1) alone.set(froms[i]![0]!, (alone.get(froms[i]![0]!) ?? 0) + 1);
  });
  const slides = rows.map((r, i) => {
    if (!r) return r;
    const from = froms[i]!;
    const basis = validNums(r.basis, slideCount).filter((n) => !from.includes(n));
    const interactive = (r.kind ?? "content") !== "content";
    let origin: OutlineOrigin;
    if (!from.length || interactive) origin = { slides: [...new Set([...from, ...basis])].sort((a, b) => a - b), how: "new" };
    else if (from.length > 1) origin = { slides: from, how: "merge" };
    else origin = { slides: from, how: (alone.get(from[0]!) ?? 0) > 1 ? "split" : "same" };
    const { from: _f, basis: _b, ...rest } = r;
    return { ...rest, origin };
  });
  return { ...o, slides };
}

/** Dòng "same": thay bằng (các) dòng dựng nguyên từ slide gốc như cách "Giữ ý" — chữ gốc, không để AI viết lại (P26). */
export function expandVerbatim(o: Outline, src: Pick<ImportSource, "slides">): Outline {
  const slides: OutlineSlide[] = [];
  for (const row of o.slides) {
    const n = row.origin?.how === "same" ? row.origin.slides[0] : undefined;
    const idx = n === undefined ? -1 : src.slides.findIndex((s) => s.n === n);
    if (idx < 0) {
      slides.push(row);
      continue;
    }
    const rows = rowsForSlide(src.slides[idx]!, { first: idx === 0 && slides.length === 0 });
    rows.forEach((r, k) => slides.push({ ...r, id: k === 0 ? row.id : r.id, partId: row.partId }));
  }
  return finalizeParts({ ...o, slides });
}

/** Dàn ý "Soạn lại mạch" từ đầu ra thô của AI. */
export function restructureOutline(raw: unknown, src: Pick<ImportSource, "slides">, minutes: number): { outline: Outline; warnings: string[] } {
  const { outline, warnings } = normalizeOutline(originsFromAi(raw, src.slides.length), minutes, {
    sourceKind: "document",
    sourceText: importSourceText(src),
  });
  return { outline: expandVerbatim(outline, src), warnings };
}

/**
 * Slide AI viết cho dòng gộp hoặc tách (P26): ghi chú giảng là ghi chú gốc nối theo thứ tự slide, AI không viết lại.
 * Dòng tách: ghi chú gốc chỉ ở dòng tách đầu tiên (`firstOfSplit`), các dòng sau giữ ghi chú AI viết cho phần của mình.
 * Slide Chữ và hình chưa có hình thì nhận hình của slide gốc đầu tiên có hình.
 */
export function withOriginalNotes(g: GeneratedSlide, row: OutlineSlide, src: Pick<ImportSource, "slides"> | null, firstOfSplit = true): GeneratedSlide {
  const o = row.origin;
  if (!src || !o || (o.how !== "merge" && o.how !== "split")) return g;
  if (o.how === "split" && !firstOfSplit) return g;
  const config: Record<string, unknown> = { ...g.config };
  const notes = joinedNotes(src, o.slides);
  if (notes) config.presenterNote = notes;
  else delete config.presenterNote;
  if (g.type === "content" && config.layout === "image" && !config.imageUrl) {
    const img = o.slides.map((n) => src.slides.find((s) => s.n === n)?.imageUrl).find(Boolean);
    if (img) Object.assign(config, { imageUrl: img, imageFit: "contain" });
  }
  return { ...g, config: g.type === "content" ? (normalizeContentSlideConfig(config) as Record<string, unknown>) : config };
}

/** Dòng tách đầu tiên của mỗi slide gốc (theo thứ tự dàn ý). */
export function firstSplitRows(slides: OutlineSlide[]): Set<string> {
  const seen = new Set<number>();
  const out = new Set<string>();
  for (const s of slides) {
    if (s.origin?.how !== "split") continue;
    const n = s.origin.slides[0]!;
    if (!seen.has(n)) out.add(s.id);
    seen.add(n);
  }
  return out;
}

/**
 * Ước lượng token của cách "Soạn lại mạch" (hiện ở bước 2): một lần lập dàn ý (đọc cả bài) và viết các slide AI soạn
 * (khoảng một nửa số slide của thời lượng; slide giữ nguyên không tốn token).
 */
export function estimateRestructureTokens(sourceChars: number, maxSlides: number): number {
  const outline = 1500 + Math.round(Math.min(sourceChars, 24_000) / 2.4) + 2500;
  return outline + estimateGenerationTokens({ sourceChars, slideCount: Math.ceil(maxSlides / 2) }).total;
}

// ── Màn đối chiếu (bước 3) ─────────────────────────────────────────────────

/** Slide gốc nào đã có trong dàn ý (nguồn trực tiếp; "dựa trên" không tính là đã dùng). */
export function coverage(o: Pick<Outline, "slides">, slideCount: number): { used: Set<number>; unused: number[] } {
  const used = new Set<number>();
  for (const s of o.slides) if (s.origin && s.origin.how !== "new") for (const n of s.origin.slides) used.add(n);
  const unused = Array.from({ length: slideCount }, (_, i) => i + 1).filter((n) => !used.has(n));
  return { used, unused };
}

/** Các dòng dàn ý dùng hoặc dựa trên slide gốc n. */
export function rowsUsingSlide(o: Pick<Outline, "slides">, n: number): OutlineSlide[] {
  return o.slides.filter((s) => s.origin?.slides.includes(n));
}

/** "Thêm lại vào dàn ý" (P30): slide gốc chưa dùng thành (các) dòng cuối phần cuối bài, dựng như cách "Giữ ý". */
export function appendBack(o: Outline, src: Pick<ImportSource, "slides">, n: number): Outline {
  const s = src.slides.find((x) => x.n === n);
  if (!s) return o;
  const last = o.parts[o.parts.length - 1]?.id;
  const rows = rowsForSlide(s, { first: false, how: "back" }).map((r) => ({ ...r, partId: last }));
  return finalizeParts({ ...o, slides: [...o.slides, ...rows] });
}

/** Ghi chú giảng của dòng sẽ ra sao, để màn đối chiếu nói rõ (P29). */
export function notesPlan(row: OutlineSlide, src: Pick<ImportSource, "slides">): "kept" | "joined" | "ai" | "empty" {
  const o = row.origin;
  const withNotes = (o?.slides ?? []).filter((n) => src.slides.find((s) => s.n === n)?.notes.trim());
  if (!o || o.how === "new") return "ai";
  if (o.how === "merge") return withNotes.length > 1 ? "joined" : withNotes.length ? "kept" : "empty";
  return withNotes.length ? "kept" : o.how === "split" ? "ai" : "empty";
}

// ── Báo cáo bước 1 ──────────────────────────────────────────────────────────

const PLACEHOLDER_URL = "/api/limio-live-media/__placeholder__";

/** Slide nào cần lưu hình: hình lớn nhất của slide có bố cục chứa hình (bìa, mở phần, bảng không dùng hình). */
export function slidesNeedingImage(slides: PptxSlide[]): boolean[] {
  return slides.map((s, i) => {
    if (!s.images.length) return false;
    return piecesFor(toImportedSlide(s, PLACEHOLDER_URL), { first: i === 0 }).some((p) => (p.config as { imageUrl?: string }).imageUrl === PLACEHOLDER_URL);
  });
}

export interface ImportReport {
  slides: number;
  withNotes: number;
  images: number;
  droppedLogos: number;
  tables: number;
  charts: number;
  /** Số bảng/biểu đồ có số đọc từ sổ Excel nhúng trong file (tiêu chí E8). */
  fromExcel: number;
  /** Các dòng "chỉ lấy được chữ" và điều không chuyển được (tiêu chí P9, P10). */
  warnings: string[];
}

const slideList = (ns: number[]) => `Slide ${listVi(ns)}`;

/** Tóm tắt những gì đã đọc được, để giảng viên biết trước khi chuyển. */
export function importReport(deck: PptxDeck): ImportReport {
  const need = slidesNeedingImage(deck.slides);
  const with_ = (f: PptxFlag) => deck.slides.filter((s) => s.flags.includes(f)).map((s) => s.n);
  const w: string[] = [];
  const smart = with_("smartart");
  if (smart.length) w.push(`${slideList(smart)} có SmartArt: lấy được phần chữ, hình vẽ được dựng lại bằng bố cục Các bước hoặc danh sách.`);
  const shapes = with_("shapes");
  if (shapes.length) w.push(`${slideList(shapes)} có sơ đồ vẽ bằng hình khối: lấy được phần chữ, hình vẽ không được chuyển.`);
  const eq = with_("equation");
  if (eq.length) w.push(`${slideList(eq)} có công thức: chỉ lấy được chữ của công thức, thầy/cô nên kiểm tra lại.`);
  const media = with_("media");
  if (media.length) w.push(`${slideList(media)} có video hoặc âm thanh: chưa chuyển được, thầy/cô có thể chèn lại trong trình sửa slide.`);
  const vec = with_("image_unsupported");
  if (vec.length) w.push(`${slideList(vec)} có hình dạng vẽ (EMF, WMF, SVG) hoặc hình liên kết ngoài: chưa chuyển được.`);
  const obj = with_("object");
  if (obj.length) w.push(`${slideList(obj)} có đối tượng nhúng (bảng tính, tệp đính kèm): chưa chuyển được.`);
  const multi = deck.slides.filter((s, i) => need[i] && s.images.length > 1).map((s) => s.n);
  if (multi.length) w.push(`${slideList(multi)} có nhiều hình: slide Limio dùng hình lớn nhất.`);
  const hidden = deck.slides.filter((s) => s.hidden).map((s) => s.n);
  if (hidden.length) w.push(`${slideList(hidden)} đang ẩn trong file: vẫn được chuyển và giữ trạng thái ẩn khi trình chiếu.`);
  const longNotes = deck.slides.filter((s) => s.notes.length > NOTES_MAX).map((s) => s.n);
  if (longNotes.length) w.push(`${slideList(longNotes)} có ghi chú giảng dài hơn ${NOTES_MAX.toLocaleString("vi-VN")} ký tự: phần sau bị lược bớt.`);
  w.push(
    deck.animatedSlides
      ? "Hiệu ứng chuyển động, chuyển slide và phông chữ riêng của file không được chuyển."
      : "Màu, phông chữ và cách trình bày riêng của file không được chuyển; Limio dựng lại theo giao diện của bài giảng.",
  );
  return {
    slides: deck.slides.length,
    withNotes: deck.slides.filter((s) => s.notes.trim()).length,
    images: need.filter(Boolean).length,
    droppedLogos: deck.droppedRepeatedImages,
    tables: deck.slides.reduce((n, s) => n + s.tables.length, 0),
    charts: deck.slides.reduce((n, s) => n + s.charts.length, 0),
    fromExcel: deck.slides.reduce((n, s) => n + s.fromExcel, 0),
    warnings: w,
  };
}
