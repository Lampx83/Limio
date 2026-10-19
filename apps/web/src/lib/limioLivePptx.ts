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
  LIST_MAX_LINES,
  LIST_MAX_WORDS,
  LIST_WORD_MAX_LEN,
  MAX_BULLETS,
  MAX_LEN,
  SLIDE_ICONS,
  convertLayoutConfig,
  dataSlideMetrics,
  listFontSize,
  type ListLine,
  normalizeContentSlideConfig,
  sanitizeLayoutConfig,
  stripInline,
} from "./limioLiveSlides";
import { GROUPS_MAX, GROUP_POINTS_MAX, STATS_LIMITS, contrastTones, groupsFit, numericPoints, type SlideGroup } from "./limioLiveGroups";
import type { PptxChart, PptxDeck, PptxEmphasis, PptxFlag, PptxParagraph, PptxSlide } from "./pptxImport";
import { SECTION_KICKER } from "./pptxLayout";
import { localizeCont } from "./limioLiveLanguage";

// ── Dữ liệu lưu kèm bài ─────────────────────────────────────────────────────

export interface ImportedSlide {
  n: number;
  hidden: boolean;
  layoutType: string | null;
  title: string;
  /** Dòng dẫn phía trên tiêu đề ("NỘI DUNG 1", tên đơn vị trên bìa); rỗng nếu không có. */
  kicker: string;
  /** Dòng ghi nguồn hình; thành dòng nguồn ở chân ô hình. */
  credit: string;
  /** Chú thích hình ("Figure 1b: …"); thành mô tả của ảnh. */
  caption: string;
  /** Cụm từ khoá rải trên slide (P53); thành cụm từ của slide Danh sách. Không có ở dữ liệu nhập trước P53. */
  words?: string[];
  /** Cụm chữ được nhấn (P52); đánh dấu lại trên chữ của slide Limio. Không có ở dữ liệu nhập trước P52. */
  emphasis?: PptxEmphasis[];
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
    kicker: s.kicker,
    credit: s.credit,
    caption: s.caption,
    words: s.words,
    emphasis: s.emphasis,
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
        kicker: str(s.kicker, 500),
        credit: str(s.credit, 500),
        caption: str(s.caption, 500),
        words: (Array.isArray(s.words) ? s.words : []).map((w) => str(w, 100)).filter(Boolean).slice(0, 40),
        emphasis: (Array.isArray(s.emphasis) ? s.emphasis : [])
          .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
          .map((e) => ({ text: str(e.text, 500), kind: (["mark", "bold", "italic"] as const).find((k) => k === e.kind) ?? "mark" }))
          .filter((e) => e.text)
          .slice(0, 60),
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
/** Chữ của các slide gốc để nhận ngôn ngữ của bài: tiêu đề, phụ đề, ý, bảng; không tính ghi chú giảng (ngon-ngu-slide L3). */
export function importLanguageText(src: Pick<ImportSource, "slides">): string {
  return src.slides
    .flatMap((s) => [s.title, ...s.subtitle, ...[...s.paragraphs, ...s.smartArt].map((p) => p.text), ...s.tables.flat(2)])
    .join("\n");
}

export function importSourceText(src: Pick<ImportSource, "slides">): string {
  return src.slides
    .map((s) => {
      // Dòng dẫn ("NỘI DUNG 1") cho AI biết slide mở phần; dòng nguồn hình không cần cho AI (tiêu chí P45).
      const lines = [`Slide ${s.n}: ${s.kicker ? `${s.kicker} — ` : ""}${s.title}`];
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
  /** Dòng nguồn ở chân slide (nguồn hình của slide gốc). */
  cite?: string;
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
  if (!imageUrl && n >= 4 && n <= summaryMax && items.every((it) => !it.children.length && fits(it.text, head))) {
    return [{ layout: "summary", config: sanitizeLayoutConfig("summary", { title: t0, items: items.map((it) => ({ heading: it.text })) }) }];
  }
  // Vừa ô "Chữ và hình" (tối đa 3 ý) thì giữ bố cục có hình; nhiều chữ hơn thì Danh sách, mỗi slide gốc vẫn là một slide (P47).
  // Không cắt đôi câu: chỉ dùng "Chữ và hình" khi các ý vừa sẵn trong giới hạn của nó.
  const bullets = items.flatMap((it) => flattenItem(it, MAX_LEN.bullet));
  const noSplit = items.every((it) => it.text.length <= MAX_LEN.bullet && it.children.every((c) => c.length <= MAX_LEN.bullet));
  // Có ý con thì Danh sách để giữ cấp ý; "Chữ và hình" chỉ cho danh sách phẳng, ngắn.
  if (bullets.length <= (MAX_BULLETS.image ?? 3) && noSplit && items.every((it) => !it.children.length))
    return bulletPieces(title, bullets, imageUrl, opts.first);
  return listPieces(title, items, imageUrl, opts.first);
}

/**
 * Danh sách (P47): ý và ý con giữ nguyên chữ trên cả bề ngang, chữ tự co tới 26 px; hình của slide gốc ở ô bên phải.
 * Chỉ khi vẫn không vừa mới chia slide "(tiếp)" (hình ở slide đầu).
 */
function listPieces(title: string, items: Item[], imageUrl: string | null, first: boolean, words: string[] = []): ImportPiece[] {
  const lines: ListLine[] = items.flatMap((it) => [
    ...splitText(it.text, MAX_LEN.listLine).map((text) => ({ text })),
    ...it.children.flatMap((c) => splitText(c, MAX_LEN.listLine).map((text) => ({ text, sub: true }))),
  ]);
  const titleFor = (k: number) => (k === 0 && first ? title : contTitle(title));
  const chunks: ListLine[][] = [];
  let cur: ListLine[] = [];
  for (const l of lines) {
    const next = [...cur, l];
    const k = chunks.length;
    if (cur.length && (next.length > LIST_MAX_LINES || listFontSize(next, titleFor(k), k === 0 && !!imageUrl).overflow)) {
      chunks.push(cur);
      cur = [l];
    } else cur = next;
  }
  if (cur.length) chunks.push(cur);
  // P47: phải tách thì chia đều theo độ dài chữ, để slide sau không chỉ còn một hai dòng lẻ.
  if (chunks.length > 1) {
    const even = balanceLines(lines, chunks.length);
    if (even.every((g, k) => g.length <= LIST_MAX_LINES && !listFontSize(g, titleFor(k), k === 0 && !!imageUrl).overflow)) chunks.splice(0, chunks.length, ...even);
  }
  // P53: cụm từ đi cùng các dòng cuối; không còn chỗ thì sang một slide riêng (tiếp).
  const w = words.slice(0, LIST_MAX_WORDS).map((x) => x.slice(0, LIST_WORD_MAX_LEN));
  const last = chunks.length - 1;
  const wordsAt =
    !w.length ? -1 : last >= 0 && !listFontSize(chunks[last]!, titleFor(last), last === 0 && !!imageUrl, w).overflow ? last : chunks.push([]) - 1;
  return chunks.map((g, k) => ({
    layout: "list" as const,
    config: sanitizeLayoutConfig("list", {
      title: titleFor(k),
      lines: g,
      ...(k === wordsAt ? { words: w } : {}),
      ...(k === 0 && imageUrl ? { imageUrl, imageFit: "contain" } : {}),
    }),
  }));
}

/** Chia các dòng thành k nhóm liên tiếp có tổng độ dài gần bằng nhau (mỗi dòng tính thêm 40 ký tự cho khoảng cách). */
function balanceLines(lines: ListLine[], k: number): ListLine[][] {
  const w = lines.map((l) => l.text.length + 40);
  const target = w.reduce((a, b) => a + b, 0) / k;
  const out: ListLine[][] = [];
  let cur: ListLine[] = [];
  let acc = 0;
  lines.forEach((l, i) => {
    if (cur.length && out.length < k - 1 && acc + w[i]! / 2 > target) {
      out.push(cur);
      cur = [];
      acc = 0;
    }
    cur.push(l);
    acc += w[i]!;
  });
  out.push(cur);
  return out;
}

// ── Slide hai cấp: ý cha và ý con (P55–P59) ─────────────────────────────────

/**
 * Nhận ra slide hai cấp và chọn kiểu theo quan hệ của nội dung (không hỏi giảng viên). Chỉ nhận khi MỌI mục có ý con, hoặc chỉ
 * mục đầu là một câu dẫn đứng ngay trước đúng một nhóm; một nhóm phải có từ 2 ý con (một ý con thì Danh sách đủ rõ).
 * Trả null nếu không phải (slide đi tiếp theo luật cũ) hoặc chữ vượt giới hạn (không được cắt chữ của giảng viên).
 */
function groupPieces(title: string, items: Item[], first: boolean): ImportPiece[] | null {
  const kids = items.filter((it) => it.children.length);
  let lead = "";
  let src: Item[];
  if (items.length >= 2 && kids.length === 1 && items.length - kids.length === 1 && !items[0]!.children.length) {
    lead = items[0]!.text;
    src = kids;
  } else if (items.length && kids.length === items.length) src = items;
  else return null;
  if (src.length === 1 && src[0]!.children.length < 2) return null;
  // Ý cha là vế đầu của một câu mà các ý con nối tiếp ("Bổ sung các yêu cầu cụ thể về" → "sử dụng AI", …): đó là một câu, không
  // phải nhóm. Danh sách tài liệu tham khảo ("[1] …", "References:") cũng giữ Danh sách.
  const continues = (it: Item) => !/[.!?…:：]$/.test(it.text.trim()) && /^\p{Ll}/u.test(it.children[0] ?? "");
  if (src.some(continues) || src.some((it) => it.children.some((c) => /^\[\d+\]|^references?\s*:?$/i.test(c.trim())))) return null;
  // Tên nhóm bỏ dấu ":" cuối (đó là dấu của ý cha). Ý con tối đa 5 mỗi nhóm: nhiều hơn thì nhóm lặp lại tên ở dòng sau.
  const groups: SlideGroup[] = src.flatMap((it) => {
    const heading = it.text.replace(/\s*[:：]\s*$/, "").trim();
    return chunkBalanced(it.children, GROUP_POINTS_MAX).map((points) => ({ heading, points }));
  });
  if (lead.length > MAX_LEN.lead || groups.some((g) => g.heading.length > MAX_LEN.groupHeading || g.points.some((p) => p.length > MAX_LEN.groupPoint))) return null;

  // So sánh hai cột: đúng 2 nhóm có tên đối lập, không câu dẫn (So sánh không có chỗ cho câu dẫn).
  if (!lead && groups.length === 2) {
    const tones = contrastTones(groups[0]!.heading, groups[1]!.heading);
    if (tones && groups.every((g) => g.heading.length <= MAX_LEN.columnHeading && g.points.length <= 3 && g.points.every((p) => p.length <= MAX_LEN.columnPoint))) {
      return [
        {
          layout: "compare",
          config: sanitizeLayoutConfig("compare", { title, columns: groups.map((g, i) => ({ heading: g.heading, tone: tones[i], points: g.points, note: "" })) }),
        },
      ];
    }
  }

  // Chia slide khi không vừa ở 26 px: nửa nhóm theo độ dài chữ; một nhóm dài thì chia ý con (tên nhóm lặp lại).
  const size = (gs: SlideGroup[]) => gs.reduce((n, g) => n + g.heading.length + g.points.reduce((m, p) => m + p.length, 0), 0);
  const titleFor = (k: number) => (k === 0 && first ? title : contTitle(title));
  const split = (gs: SlideGroup[]): SlideGroup[][] => {
    if (gs.length > 1) {
      let acc = 0;
      const total = size(gs);
      const at = Math.max(1, gs.findIndex((g) => (acc += size([g])) >= total / 2));
      return [gs.slice(0, at), gs.slice(at)];
    }
    const g = gs[0]!;
    const h = Math.ceil(g.points.length / 2);
    return g.points.length > 1 ? [[{ heading: g.heading, points: g.points.slice(0, h) }], [{ heading: g.heading, points: g.points.slice(h) }]] : [gs];
  };
  let chunks: SlideGroup[][] = chunkBalanced(groups, GROUPS_MAX);
  for (let guard = 0; guard < 8; guard++) {
    const next = chunks.flatMap((gs, k) => (groupsFit({ title: titleFor(k), lead: k === 0 ? lead : "", groups: gs }).overflow ? split(gs) : [gs]));
    if (next.length === chunks.length) break;
    chunks = next;
  }
  return chunks.map((gs, k) => ({
    layout: "groups" as const,
    config: sanitizeLayoutConfig("groups", { title: titleFor(k), ...(k === 0 && lead ? { lead } : {}), groups: gs }),
  }));
}

/** Số trên bảng dựng từ biểu đồ: kiểu Việt Nam, đơn vị % ghi liền. */
const cellNum = (v: number | null, unit: string) => (isNum(v) ? formatValue(v, unit) : "");

/**
 * Bảng → các slide Bảng, giữ dạng bảng (tiêu chí P19, P46): mỗi slide số hàng vừa chỗ trống và lặp hàng tiêu đề; bảng rộng hơn
 * 5 cột chia theo nhóm cột, lặp cột đầu. Chỉ bảng một cột hoặc có ô dài quá giới hạn mới thành danh sách (để không mất chữ).
 */
function tablePieces(title: string, table: string[][], first: boolean): ImportPiece[] {
  const [head0, ...rows0] = table;
  const cols = Math.max((head0 ?? []).length, ...rows0.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, j) => r[j] ?? "");
  const head = pad(head0 ?? []);
  const rows = rows0.map(pad);
  if (cols < TABLE_LIMITS.minCols || table.some((r) => r.some((c) => c.length > MAX_LEN.tableCell))) {
    const line = (r: string[]) => {
      const cells = r.filter((c) => c.trim());
      return cells.length > 1 ? `${cells[0]}: ${cells.slice(1).join(" · ")}` : (cells[0] ?? "");
    };
    return bulletPieces(title, table.map(line).filter(Boolean).flatMap((l) => splitText(l, MAX_LEN.bullet)), null, first);
  }
  // Nhóm cột: cột đầu (nhãn hàng) lặp ở mọi nhóm khi phải chia.
  const groups: number[][] =
    cols <= TABLE_LIMITS.maxCols
      ? [Array.from({ length: cols }, (_, j) => j)]
      : chunkBalanced(Array.from({ length: cols - 1 }, (_, j) => j + 1), TABLE_LIMITS.maxCols - 1).map((g) => [0, ...g]);
  const out: ImportPiece[] = [];
  for (const g of groups) {
    const h = g.map((j) => head[j]!);
    const rs = rows.map((r) => g.map((j) => r[j]!)).filter((r) => r.some((c) => c.trim()));
    let i = 0;
    do {
      const t = out.length === 0 && first ? title : contTitle(title);
      const availH = dataSlideMetrics({ title: t }).boxH;
      let take = Math.min(TABLE_LIMITS.maxRows, rs.length - i);
      while (take > 1 && tableFontSize(h, rs.slice(i, i + take), DATA_CONTENT_W, availH).overflow) take -= 1;
      out.push({ layout: "table", config: sanitizeLayoutConfig("table", { title: t, head: h, rows: rs.slice(i, i + Math.max(take, 0)) }) });
      i += Math.max(take, 1);
    } while (i < rs.length);
  }
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
function headPiece(
  layout: "cover" | "section",
  title: string,
  lines: string[],
  extra: Record<string, unknown> = {},
): { piece: ImportPiece; rest: string[] } {
  let subtitle = "";
  let used = 0;
  for (const l of lines) {
    const next = subtitle ? `${subtitle} · ${l}` : l;
    if (next.length > MAX_LEN.subtitle) break;
    subtitle = next;
    used += 1;
  }
  return { piece: { layout, config: sanitizeLayoutConfig(layout, { title, subtitle, ...extra }) }, rest: lines.slice(used) };
}

/**
 * Quy tắc chọn bố cục cho một slide gốc (tiêu chí P15–P20). `first`: slide đầu của bài.
 * Luôn trả ít nhất một slide; mọi chữ của slide gốc có mặt trong các slide trả về.
 */
const norm = (t: string) => t.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
/** Cùng tên bài: trùng sau khi chuẩn hoá, hoặc một bên là phần đầu của bên kia ("SOFT SKILL" / "SOFT SKILLS"). */
const sameName = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || (Math.min(x.length, y.length) >= 6 && (x.startsWith(y) || y.startsWith(x)));
};
/** Lời kết: cảm ơn, hỏi đáp. */
const CLOSING_RE = /(cảm ơn|cám ơn|thank|hỏi đáp|câu hỏi\s*\??$|q\s*&\s*a|questions?\s*\??$)/i;
/** Tiêu đề đánh số mở phần: "2. Phân tích …", "III. …" (không khớp "2.1 …"). */
const NUMBERED_TITLE = /^(\d{1,2}|[IVX]{1,4})[.)]\s+(?=\S)/;

/** "1" → "01", "III" giữ nguyên. */
const sectionNo = (v: string) => (/^\d+$/.test(v) ? v.padStart(2, "0") : v.toUpperCase());

export function piecesFor(s: ImportedSlide, opts: { first: boolean; deckTitle?: string }): ImportPiece[] {
  let title = s.title.trim();
  const lead: PptxParagraph[] = [];
  let paragraphs = s.paragraphs;
  // Dòng dẫn "NỘI DUNG 1": slide mở phần, số phần lấy từ dòng dẫn (P38). Tiêu đề chính là "NỘI DUNG 1" mà tên phần nằm ở
  // dòng đầu của thân thì tên phần là dòng đó.
  let sectionMatch = SECTION_KICKER.exec(s.kicker.trim());
  if (!sectionMatch && SECTION_KICKER.test(title) && paragraphs[0] && paragraphs[0].level === 0) {
    sectionMatch = SECTION_KICKER.exec(title);
    title = paragraphs[0].text;
    paragraphs = paragraphs.slice(1);
  }
  // Dòng dẫn khác: giữ lại ở đầu nội dung (bìa dùng làm tên đơn vị).
  const keepKicker = !!s.kicker.trim() && !sectionMatch && !opts.first;
  if (keepKicker) lead.push({ text: s.kicker.trim(), level: 0, numbered: false });
  if (title.length > MAX_LEN.title) {
    const [head, ...rest] = splitText(title, MAX_LEN.title);
    title = head!;
    lead.push(...rest.map((text) => ({ text, level: 0, numbered: false })));
  }
  if (!title) title = s.charts[0]?.title || `Slide ${s.n}`;
  const items = itemsOf([...lead, ...paragraphs]);
  const hasData = s.tables.length > 0 || s.charts.length > 0;
  const words = s.words ?? [];
  const titleOnly = !items.length && !s.subtitle.length && !hasData && !s.smartArt.length && !s.imageUrl && !words.length;
  const out: ImportPiece[] = [];
  const restAsBullets = (lines: string[], img: string | null = null) => {
    if (!lines.length) return;
    out.push(...bulletPieces(title, lines.flatMap((l) => splitText(l, MAX_LEN.bullet)), img, false));
  };

  // Slide "Section Header" hoặc có dòng dẫn "Nội dung n" luôn là slide mở phần, kể cả khi chỉ có tiêu đề.
  const isSection = !opts.first && !hasData && (s.layoutType === "secHead" || !!sectionMatch);
  const lines = [...s.subtitle, ...items.flatMap((it) => [it.text, ...it.children])];
  // P43: slide kết (lặp lại tên bài, hoặc lời cảm ơn / hỏi đáp) với vài dòng ngắn dựng bằng bố cục Bìa.
  const short = !hasData && !s.smartArt.length && !words.length && lines.length <= 3 && lines.every((l) => l.length <= 80);
  const closing = !opts.first && short && ((!!opts.deckTitle && sameName(title, opts.deckTitle)) || CLOSING_RE.test(title));
  // P48: slide giữa bài chỉ có tiêu đề (và tối đa một dòng ngắn, không hình) là slide mở phần; tiêu đề đánh số "2. …" cho số phần.
  // Dòng duy nhất phải là phần nối của tiêu đề (không phải một câu đã kết), không thì đó là slide nội dung một ý.
  const numbered = NUMBERED_TITLE.exec(title);
  const tailOnly = lines.length === 1 && lines[0]!.length <= 60 && !/[.!?…:;]$/.test(lines[0]!.trim());
  const opener =
    !opts.first && !closing && !hasData && !s.smartArt.length && !s.imageUrl && !words.length && (lines.length === 0 || tailOnly || (!!numbered && lines.length <= 1));
  if (opener && !isSection) {
    const name = numbered ? title.slice(numbered[0].length).trim() || title : title;
    const { piece, rest } = headPiece("section", name, lines, numbered ? { sectionNumber: sectionNo(numbered[1]!) } : {});
    out.push(piece);
    restAsBullets(rest);
  } else if (!isSection && (opts.first || s.layoutType === "title" || titleOnly || closing)) {
    const org = opts.first && s.kicker.trim().length <= MAX_LEN.org ? s.kicker.trim() : "";
    const coverLines = opts.first && !org && s.kicker.trim() ? [s.kicker.trim(), ...lines] : lines;
    const { piece, rest } = headPiece("cover", title, coverLines, org ? { org } : {});
    out.push(piece);
    restAsBullets(rest);
  } else if (isSection) {
    const no = sectionMatch?.[2];
    const { piece, rest } = headPiece("section", title, lines, no ? { sectionNumber: sectionNo(no) } : {});
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
      // P55–P56: slide hai cấp (ý cha có ý con) → Nhóm hoặc So sánh hai cột, trừ khi slide có cụm từ khoá hay hình.
      const grouped = !words.length && !s.imageUrl && !sub.length ? groupPieces(title, items, true) : null;
      if (grouped) out.push(...grouped);
      // P53: slide có cụm từ khoá luôn là Danh sách (các dòng rồi đến cụm từ), để cụm từ không thành gạch đầu dòng.
      else if (words.length) out.push(...listPieces(title, all, s.imageUrl, true, words));
      else out.push(...itemPieces(title, all, s.imageUrl, { first: true, preferSteps: numbered }));
    }
  }
  // Cụm từ ở slide dựng theo cách khác (bảng, biểu đồ, SmartArt, bìa): giữ thành một ý để không mất chữ.
  if (words.length && !out.some((p) => Array.isArray((p.config as { words?: unknown }).words))) restAsBullets([words.join(", ")]);
  // P40: nguồn hình thành dòng nguồn ở chân slide có hình (hoặc slide đầu); dài quá thì giữ làm một ý để không mất chữ.
  const credit = s.credit.trim();
  if (credit) {
    // Slide có hình: nguồn hình hiện ở chân ô hình ("Nguồn ảnh: …"), bỏ phần nhãn trùng lặp; không có hình: dòng nguồn ở chân slide.
    const withImg = out.find((p) => (p.config as { imageUrl?: string }).imageUrl);
    const bare = credit.replace(/^[^:：]{1,40}[:：]\s*/, "");
    const url = /^https?:\/\/\S+$/i.test(bare) ? bare : "";
    // "Source: https://…": hiện tên trang, giữ đường dẫn đầy đủ để mở được.
    const shown = url ? (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return bare; } })() : bare;
    if (withImg && shown && shown.length <= MAX_LEN.imageCredit)
      Object.assign(withImg.config as Record<string, unknown>, { imageCredit: shown, ...(url ? { imageSourceUrl: url } : {}) });
    // Slide Limio không hiện hình nào: dòng nguồn hình không còn gì để ghi nguồn, bỏ đi (vẫn còn trong dữ liệu đã đọc).
  }
  // P49: chú thích hình ("Figure 1b: …") là mô tả của ảnh, không phải tiêu đề hay một ý.
  const caption = s.caption.trim();
  const imgPiece = out.find((p) => (p.config as { imageUrl?: string }).imageUrl);
  if (caption && imgPiece) (imgPiece.config as Record<string, unknown>).imageAlt = caption.slice(0, MAX_LEN.imageAlt);
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
    case "list":
      pts = (c.lines ?? []).map((l: ListLine) => (l.sub ? `– ${l.text}` : l.text));
      if (Array.isArray(c.words) && c.words.length) pts.push(c.words.join(", "));
      break;
    case "compare":
      pts = (c.columns ?? []).map((col: { heading: string; points: string[] }) => (col.points.length ? `${col.heading}: ${col.points.join("; ")}` : col.heading));
      break;
    case "groups":
      pts = [
        ...(c.lead ? [c.lead] : []),
        ...(c.groups ?? []).map((g: SlideGroup) => (g.points.length ? `${g.heading}: ${g.points.join("; ")}` : g.heading)),
      ];
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
export function rowsForSlide(s: ImportedSlide, opts: { first: boolean; how?: "same" | "back"; deckTitle?: string }): OutlineSlide[] {
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
export function keepOutline(src: Pick<ImportSource, "slides">, title: string, lang?: string | null): Outline {
  const deckTitle = src.slides[0]?.title;
  // Dòng tách ra mang đuôi "(tiếp)" theo ngôn ngữ của bài.
  const slides = src.slides.flatMap((s, i) => rowsForSlide(s, { first: i === 0, deckTitle })).map((r) => ({ ...r, title: localizeCont(r.title, lang) }));
  const o = finalizeParts(inferParts({ title: stripEmoji(title).slice(0, OUTLINE_LIMITS.title), slides }, lang));
  // Các slide giữa Bìa và slide Mở phần đầu tiên (Nội dung bài học, Mục tiêu) không phải một phần Nội dung: thành phần Mục
  // tiêu nếu có slide mục tiêu, không thì thuộc phần Bìa. Nhờ vậy số phần trên bìa phần khớp số trong bài gốc.
  const firstContent = o.parts.find((p) => p.role === "content");
  const hasOpeners = o.slides.some((x) => x.layout === "section");
  if (firstContent && hasOpeners && o.slides.find((x) => x.partId === firstContent.id)?.layout !== "section") {
    const rows = o.slides.filter((x) => x.partId === firstContent.id);
    const cover = o.parts.find((p) => p.role === "cover");
    if (rows.some((x) => /mục tiêu|objective|learning outcome/i.test(x.title))) Object.assign(firstContent, { role: "objectives", name: "" });
    else if (cover) for (const x of rows) x.partId = cover.id;
  }
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
// ── Chữ nhấn (P52) ──────────────────────────────────────────────────────────

const EMPHASIS_MARKER: Record<PptxEmphasis["kind"], string> = { mark: "==", bold: "**", italic: "*" };
const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Đánh dấu lại các cụm chữ được nhấn ở slide gốc trên một dòng chữ của slide Limio: chỉ cụm trọn từ, tô màu thắng đậm,
 * đậm thắng nghiêng, cụm dài trước. Dòng đã có dấu định dạng (hoặc có sẵn "*", "==") để nguyên.
 */
export function applyEmphasis(text: string, marks: PptxEmphasis[]): string {
  if (!text || !marks.length || text.includes("*") || text.includes("==")) return text;
  const rank = { mark: 3, bold: 2, italic: 1 } as const;
  const kinds: Array<PptxEmphasis["kind"] | null> = Array.from({ length: text.length }, () => null);
  const order = [...marks].sort((a, b) => rank[b.kind] - rank[a.kind] || b.text.length - a.text.length);
  for (const m of order) {
    if (!m.text) continue;
    for (let at = text.indexOf(m.text); at > -1; at = text.indexOf(m.text, at + 1)) {
      const end = at + m.text.length;
      if (isWordChar(text[at - 1]) || isWordChar(text[end])) continue;
      if (kinds.slice(at, end).some((k) => k !== null)) continue;
      kinds.fill(m.kind, at, end);
    }
  }
  let out = "";
  for (let i = 0; i < text.length; ) {
    const k = kinds[i];
    let j = i;
    while (j < text.length && kinds[j] === k) j++;
    out += k ? `${EMPHASIS_MARKER[k]}${text.slice(i, j)}${EMPHASIS_MARKER[k]}` : text.slice(i, j);
    i = j;
  }
  return out;
}

/** Áp `f` lên chữ thân của slide (dòng, ý, thẻ, cột, ô bảng); không đụng tiêu đề, nguồn, mô tả ảnh. */
function mapBodyText(c: Record<string, unknown>, f: (t: string) => string): Record<string, unknown> {
  const str = (v: unknown) => (typeof v === "string" ? f(v) : v);
  const obj = (v: unknown, keys: string[]) =>
    v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keys.includes(k) ? str(x) : x])) : v;
  const out: Record<string, unknown> = { ...c };
  if (Array.isArray(c.lines)) out.lines = c.lines.map((l) => obj(l, ["text"]));
  if (Array.isArray(c.bullets)) out.bullets = c.bullets.map(str);
  if (Array.isArray(c.items)) out.items = c.items.map((it) => obj(it, ["heading", "body"]));
  if (Array.isArray(c.columns))
    out.columns = c.columns.map((col) => {
      const o = obj(col, ["heading", "note"]) as Record<string, unknown>;
      return o && Array.isArray(o.points) ? { ...o, points: o.points.map(str) } : o;
    });
  if (Array.isArray(c.rows)) out.rows = c.rows.map((r) => (Array.isArray(r) ? r.map(str) : r));
  return out;
}

/** Slide đã chuẩn hoá kèm dấu nhấn; nếu dấu làm chữ bị cắt (vượt giới hạn độ dài) thì giữ bản không dấu. */
function withEmphasis(config: Record<string, unknown>, marks: PptxEmphasis[]): Record<string, unknown> {
  const plain = normalizeContentSlideConfig(config) as Record<string, unknown>;
  if (!marks.length) return plain;
  const marked = normalizeContentSlideConfig(mapBodyText(plain, (t) => applyEmphasis(t, marks))) as Record<string, unknown>;
  const same = JSON.stringify(mapBodyText(marked, stripInline)) === JSON.stringify(mapBodyText(plain, stripInline));
  return same ? marked : plain;
}

export function importedSlideFor(row: OutlineSlide, src: Pick<ImportSource, "slides"> | null, sectionNo = "", lang?: string | null): GeneratedSlide | null {
  const o = row.origin;
  if (!src || !o || !isImportedRow(row)) return null;
  const idx = src.slides.findIndex((s) => s.n === o.slides[0]);
  if (idx < 0) return null;
  const s = src.slides[idx]!;
  const pieces = piecesFor(s, { first: idx === 0 && o.how === "same", deckTitle: src.slides[0]?.title });
  const k = Math.min(Math.max((o.piece ?? 1) - 1, 0), pieces.length - 1);
  const piece = pieces[k]!;
  const notes = k === 0 ? joinedNotes(src, [s.n]) : "";
  const meta = {
    outlineId: row.id,
    aiGenerated: true,
    ...(notes ? { presenterNote: notes } : {}),
    ...(s.hidden ? { hidden: true } : {}),
    ...(piece.cite ? { cite: piece.cite } : {}),
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
  if (typeof config.title === "string") config.title = localizeCont(config.title, lang);
  for (const key of ["outlineId", "aiGenerated", "presenterNote"]) delete config[key];
  return {
    type: "content",
    config: withEmphasis({ ...config, ...meta }, s.emphasis ?? []),
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
    const rows = rowsForSlide(src.slides[idx]!, { first: idx === 0 && slides.length === 0, deckTitle: src.slides[0]?.title });
    rows.forEach((r, k) => slides.push({ ...r, id: k === 0 ? row.id : r.id, partId: row.partId }));
  }
  return finalizeParts({ ...o, slides });
}

/** Dàn ý "Soạn lại mạch" từ đầu ra thô của AI. */
export function restructureOutline(raw: unknown, src: Pick<ImportSource, "slides">, minutes: number, lang?: string | null): { outline: Outline; warnings: string[] } {
  const { outline, warnings } = normalizeOutline(originsFromAi(raw, src.slides.length), minutes, {
    sourceKind: "document",
    sourceText: importSourceText(src),
    lang,
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
  // P44: chèn sau dòng cuối cùng lấy từ slide gốc có số nhỏ hơn, cùng phần với dòng đó; không có thì sau slide Bìa.
  let at = -1;
  o.slides.forEach((row, i) => {
    if (row.origin && row.origin.how !== "new" && row.origin.slides.some((m) => m < n)) at = i;
  });
  if (at < 0) at = o.slides.findIndex((row) => o.parts.find((p) => p.id === row.partId)?.role === "cover");
  const partId = (o.slides[at] ?? o.slides[0])?.partId;
  const rows = rowsForSlide(s, { first: false, how: "back", deckTitle: src.slides[0]?.title }).map((r) => ({ ...r, partId }));
  return finalizeParts({ ...o, slides: [...o.slides.slice(0, at + 1), ...rows, ...o.slides.slice(at + 1)] });
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
    return piecesFor(toImportedSlide(s, PLACEHOLDER_URL), { first: i === 0, deckTitle: slides[0]?.title }).some((p) => (p.config as { imageUrl?: string }).imageUrl === PLACEHOLDER_URL);
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
