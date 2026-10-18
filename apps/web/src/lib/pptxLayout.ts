// Đọc bố cục chữ của một slide PowerPoint không dùng placeholder (mọi chữ nằm trong hộp chữ, nhóm hình, hình khối):
// chọn tiêu đề theo cỡ chữ, dòng dẫn phía trên tiêu đề, dòng nguồn hình, bỏ chữ trang trí, ghép dòng ngắt, gắn nhãn với
// nội dung của nhãn. Tiêu chí P35–P42, docs/tieu-chi/nhap-powerpoint.md. Module thuần, không đọc XML.

import type { PptxParagraph } from "./pptxImport";

export interface Box {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export interface ShapePara extends PptxParagraph {
  /** Có ký hiệu đầu dòng (buChar) hoặc đánh số. */
  bullet: boolean;
  /** Cỡ chữ lớn nhất của đoạn, phần trăm điểm (2800 = 28 pt); null nếu file không ghi. */
  size: number | null;
  /** Mọi run có chữ đều đậm. */
  bold: boolean;
}

export interface LayoutShape {
  paras: ShapePara[];
  /** Toạ độ trên slide (đã đổi khỏi toạ độ nhóm); null nếu không ghi (placeholder kế thừa layout). */
  box: Box | null;
  order: number;
}

export interface SlideLayoutText {
  title: string;
  /** Dòng dẫn phía trên tiêu đề ("NỘI DUNG 1", tên đơn vị trên bìa); rỗng nếu không có. */
  kicker: string;
  /** Dòng ghi nguồn hình ("Nguồn ảnh minh hoạ: …"); rỗng nếu không có. */
  credit: string;
  paragraphs: PptxParagraph[];
  /** Bảng tự vẽ bằng hộp chữ (nhãn ở cột trái, hoặc tiêu đề cột): hàng đầu là hàng tiêu đề, rỗng nếu không có (P42). */
  tables: string[][][];
}

/** "Nguồn ảnh minh hoạ: …", "Nguồn: …", "Ảnh: …", "Source: …". */
const CREDIT_RE = /^(nguồn(\s+(ảnh|hình))?(\s+minh\s+ho[ạa])?|ảnh(\s+minh\s+ho[ạa])?|hình(\s+ảnh)?(\s+minh\s+ho[ạa])?|sources?|photos?|images?(\s+sources?)?|credits?)\s*[:：]/i;
/** Chỉ có số: số trang, số thứ tự trang trí ("01", "1.", "IV"). */
const NUMBER_ONLY = /^(\d{1,3}|[ivxlc]{1,5})[.)]?$/i;
/** Dòng dẫn mở một phần: "NỘI DUNG 1", "Phần 2", "Chương III", "Part 1". */
export const SECTION_KICKER = /^(nội dung|phần|chương|chủ đề|bài|mục|part|chapter|section|module|unit)\s+(\d{1,2}|[ivxlc]{1,5})\s*[.:]?$/i;

const textOfShape = (s: LayoutShape) => s.paras.map((p) => p.text).join(" ");
const sizeOf = (s: LayoutShape) => Math.max(0, ...s.paras.map((p) => p.size ?? 0)) || null;
const hasBullet = (s: LayoutShape) => s.paras.some((p) => p.bullet || p.numbered);
const allBold = (s: LayoutShape) => s.paras.every((p) => p.bold);
const isUpper = (t: string) => /\p{L}/u.test(t) && t === t.toLocaleUpperCase("vi");
const endsSentence = (t: string) => /[.!?:;…]["”’)]?$/.test(t.trim());
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** Hai khối lệch nhau chưa tới bấy nhiêu EMU theo chiều dọc (≈ 0,13 inch) coi như cùng hàng: đọc trái sang phải. */
const ROW_TOLERANCE = 120_000;

/** Đọc từ trên xuống, trái sang; khối không ghi vị trí giữ thứ tự gốc và đứng trước. */
function readingOrder(a: { box: Box | null; order: number }, b: { box: Box | null; order: number }): number {
  const ay = a.box?.y ?? -1;
  const by = b.box?.y ?? -1;
  if (Math.abs(ay - by) > ROW_TOLERANCE) return ay - by;
  return (a.box?.x ?? -1) - (b.box?.x ?? -1) || ay - by || a.order - b.order;
}

/** P41: trong một khối, đoạn là dòng ngắt của câu phía trên thì ghép lại. */
export function joinWrappedLines(paras: ShapePara[]): ShapePara[] {
  const out: ShapePara[] = [];
  for (const p of paras) {
    const prev = out[out.length - 1];
    const plain = (q: ShapePara) => !q.bullet && !q.numbered;
    if (
      prev &&
      plain(prev) &&
      plain(p) &&
      prev.level === p.level &&
      !endsSentence(prev.text) &&
      (prev.size ?? 0) === (p.size ?? 0) &&
      ((isUpper(prev.text) && isUpper(p.text)) || /^\p{Ll}/u.test(p.text))
    ) {
      out[out.length - 1] = { ...prev, text: `${prev.text} ${p.text}` };
    } else out.push({ ...p });
  }
  return out;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

function verticalGap(a: Box, b: Box): number {
  if (a.y + a.cy <= b.y) return b.y - (a.y + a.cy);
  if (b.y + b.cy <= a.y) return a.y - (b.y + b.cy);
  return 0;
}

interface Picked {
  shapes: LayoutShape[];
  size: number;
}

/** P36–P37: khối tiêu đề theo cỡ chữ (ưu tiên phần trên slide, chữ đậm) cùng các khối nối tiếp của nó. */
function pickTitle(shapes: LayoutShape[], slideH: number): Picked | null {
  const cands = shapes.filter((s) => !hasBullet(s) && sizeOf(s) && textOfShape(s).length <= 150 && textOfShape(s).length >= 2);
  if (!cands.length) return null;
  const score = (s: LayoutShape) => sizeOf(s)! * (s.box && s.box.y < 0.3 * slideH ? 1.3 : 1) * (allBold(s) ? 1.1 : 1);
  const best = [...cands].sort((a, b) => score(b) - score(a) || readingOrder(a, b))[0]!;
  const size = sizeOf(best)!;
  const group = [best];
  if (best.box) {
    const lineH = (size / 100) * 12700 * 1.2;
    const sameCase = (s: LayoutShape) => isUpper(textOfShape(s)) === isUpper(textOfShape(best));
    for (let added = true; added; ) {
      added = false;
      for (const s of cands) {
        if (group.includes(s) || !s.box || sizeOf(s)! < 0.55 * size || !sameCase(s)) continue;
        const near = group.some(
          (g) => g.box && verticalGap(g.box, s.box!) <= 0.8 * lineH && overlap(g.box.x, g.box.x + g.box.cx, s.box!.x, s.box!.x + s.box!.cx) > 0,
        );
        if (near) {
          group.push(s);
          added = true;
        }
      }
    }
  }
  return { shapes: group.sort(readingOrder), size };
}

const isLabel = (s: LayoutShape) => {
  const t = textOfShape(s);
  return !hasBullet(s) && allBold(s) && t.length <= 40 && words(t) <= 5 && !endsSentence(t);
};

interface Unit {
  anchor: { box: Box | null; order: number };
  paras: PptxParagraph[];
}

/**
 * Khối mở bằng một dòng đậm, ngắn, không gạch đầu dòng, các dòng sau có gạch đầu dòng hoặc không đậm: dòng đầu là tiêu đề
 * của khối ("Pros", "Năng lực đang mất lợi thế"), các dòng sau là ý con của nó.
 */
function boxHeading(s: LayoutShape): string | null {
  const [h, ...rest] = s.paras;
  if (!h || !rest.length || !h.bold || h.bullet || h.numbered || h.text.length > 60 || endsSentence(h.text)) return null;
  return rest.every((p) => p.bullet || p.numbered || !p.bold) ? h.text : null;
}

const plainParas = (s: LayoutShape, shift = 0): PptxParagraph[] => {
  const min = Math.min(...s.paras.map((p) => p.level));
  const heading = boxHeading(s);
  return s.paras.map((p, i) => ({ text: p.text, level: p.level - min + shift + (heading && i > 0 ? 1 : 0), numbered: p.numbered }));
};

/**
 * Các khối có tiêu đề (boxHeading) đặt cạnh nhau trên cùng một hàng: bảng, hàng tiêu đề là tiêu đề các khối (trái sang phải),
 * mỗi ý con một ô theo thứ tự. Trả về bảng và các khối đã dùng.
 */
function boxColumns(shapes: LayoutShape[]): { table: string[][]; used: LayoutShape[] } | null {
  const boxes = shapes.filter((s) => s.box && boxHeading(s)).sort((a, b) => a.box!.x - b.box!.x);
  for (const first of boxes) {
    // Các hộp cùng hàng, cao gần bằng nhau và bắt đầu ngang nhau (thẻ đặt cạnh nhau), không phải một hộp nhỏ cạnh một khối lớn.
    const row = boxes.filter((b) => {
      const a = first.box!;
      const c = b.box!;
      const hi = Math.max(a.cy, c.cy);
      return Math.min(a.cy, c.cy) >= 0.6 * hi && Math.abs(a.y - c.y) <= 0.15 * hi;
    });
    // Các khối không chồng nhau theo chiều ngang (thật sự là các cột).
    const cols = row.filter((b, i) => row.every((o, j) => j === i || overlap(b.box!.x, b.box!.x + b.box!.cx, o.box!.x, o.box!.x + o.box!.cx) < 0.2 * Math.min(b.box!.cx, o.box!.cx)));
    if (cols.length < 2) continue;
    const cells = cols.map((c) => c.paras.slice(1).map((p) => p.text));
    const depth = Math.max(...cells.map((c) => c.length));
    return { table: [cols.map((c) => boxHeading(c)!), ...Array.from({ length: depth }, (_, i) => cells.map((c) => c[i] ?? ""))], used: cols };
  }
  return null;
}

/**
 * P42: nhãn (khối đậm, ngắn) và nội dung của nhãn. Khối nội dung cùng hàng bên phải nhãn, hoặc cùng cột bên dưới nhãn,
 * thuộc nhãn gần nhất. Không khối nội dung nào thuộc nhãn thì xét nhãn chung ("Ví dụ") giữa các nhãn cùng cỡ chữ.
 */
function associateLabels(all: LayoutShape[]): { units: Unit[]; tables: string[][][] } {
  const cols = boxColumns(all);
  const shapes = cols ? all.filter((s) => !cols.used.includes(s)) : all;
  const labels = shapes.filter(isLabel);
  const values = shapes.filter((s) => !isLabel(s));
  const owner = new Map<LayoutShape, LayoutShape>();
  const relation = new Map<LayoutShape, "row" | "col">();
  for (const v of values) {
    if (!v.box) continue;
    let bestL: LayoutShape | null = null;
    let bestD = Infinity;
    for (const l of labels) {
      if (!l.box) continue;
      const a = l.box;
      const b = v.box;
      const rowOv = overlap(a.y, a.y + a.cy, b.y, b.y + b.cy) >= 0.3 * Math.min(a.cy, b.cy);
      const colOv = overlap(a.x, a.x + a.cx, b.x, b.x + b.cx) >= 0.3 * Math.min(a.cx, b.cx);
      let d = Infinity;
      let rel: "row" | "col" = "row";
      if (rowOv && a.x + a.cx / 2 < b.x) d = Math.max(0, b.x - (a.x + a.cx));
      else if (colOv && a.y + a.cy / 2 < b.y) {
        d = Math.max(0, b.y - (a.y + a.cy));
        rel = "col";
      }
      if (d < bestD) {
        bestD = d;
        bestL = l;
        relation.set(v, rel);
      }
    }
    if (bestL) owner.set(v, bestL);
  }

  const children = new Map<LayoutShape, LayoutShape[]>();
  for (const [v, l] of owner) children.set(l, [...(children.get(l) ?? []), v]);
  for (const [l, kids] of children) children.set(l, kids.sort(readingOrder));

  // Bảng tự vẽ: từ 2 nhãn cùng kiểu quan hệ với nội dung. Nhãn ở cột trái → mỗi nhãn một hàng (không hàng tiêu đề);
  // nhãn là tiêu đề cột → hàng tiêu đề là các nhãn, mỗi đoạn nội dung một ô theo thứ tự.
  const tables: string[][][] = cols ? [cols.table] : [];
  const owners = [...children.keys()].sort(readingOrder);
  const kindOf = (l: LayoutShape) => {
    const rels = new Set(children.get(l)!.map((v) => relation.get(v)));
    return rels.size === 1 ? [...rels][0] : null;
  };
  const cellOf = (v: LayoutShape[]) => v.flatMap((k) => k.paras.map((p) => p.text)).join("; ");
  if (owners.length >= 2 && owners.every((l) => kindOf(l) === "row")) {
    tables.push([["", ""], ...owners.map((l) => [textOfShape(l), cellOf(children.get(l)!)])]);
    for (const l of owners) children.delete(l);
  } else if (owners.length >= 2 && owners.every((l) => kindOf(l) === "col")) {
    const cols = [...owners].sort((a, b) => (a.box?.x ?? 0) - (b.box?.x ?? 0));
    const cells = cols.map((l) => children.get(l)!.flatMap((k) => k.paras.map((p) => p.text)));
    const depth = Math.max(...cells.map((c) => c.length));
    tables.push([cols.map(textOfShape), ...Array.from({ length: depth }, (_, i) => cells.map((c) => c[i] ?? ""))]);
    for (const l of owners) children.delete(l);
  }

  const labelTable = tables.length > (cols ? 1 : 0);
  const inTable = new Set(labelTable ? [...owners, ...[...owner.keys()].filter((v) => owners.includes(owner.get(v)!))] : []);
  // Nhãn chung: từ 3 nhãn cùng cỡ chữ chưa có nội dung, nhãn ngắn hẳn là cha của các nhãn còn lại.
  const hub = new Map<LayoutShape, LayoutShape[]>();
  const free = labels.filter((l) => !children.has(l) && !inTable.has(l));
  const bySize = new Map<number, LayoutShape[]>();
  for (const l of free) bySize.set(sizeOf(l) ?? 0, [...(bySize.get(sizeOf(l) ?? 0) ?? []), l]);
  for (const group of bySize.values()) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => textOfShape(a).length - textOfShape(b).length);
    const head = sorted[0]!;
    const rest = sorted.slice(1).map((s) => textOfShape(s).length).sort((a, b) => a - b);
    const median = rest[Math.floor(rest.length / 2)]!;
    const len = textOfShape(head).length;
    if (len <= 12 && len <= 0.6 * median) hub.set(head, group.filter((g) => g !== head).sort(readingOrder));
  }
  const inHub = new Set([...hub.values()].flat());

  const units: Unit[] = [];
  for (const s of shapes) {
    if (inTable.has(s) || owner.has(s) || inHub.has(s)) continue;
    const kids = children.get(s) ?? [];
    const hubKids = hub.get(s) ?? [];
    if (kids.length || hubKids.length) {
      units.push({
        anchor: s,
        paras: [
          { text: textOfShape(s), level: 0, numbered: false },
          ...kids.sort(readingOrder).flatMap((k) => plainParas(k, 1)),
          ...hubKids.map((k) => ({ text: textOfShape(k), level: 1, numbered: false })),
        ],
      });
    } else units.push({ anchor: s, paras: plainParas(s) });
  }
  return { units: units.sort((a, b) => readingOrder(a.anchor, b.anchor)), tables };
}

/**
 * Chữ của slide từ các khối thân (không gồm placeholder tiêu đề và phụ đề). `fixedTitle`: slide có placeholder tiêu đề
 * thì không chọn tiêu đề và dòng dẫn theo cỡ chữ.
 */
export function analyzeShapes(input: LayoutShape[], slide: { h: number }, fixedTitle?: string): SlideLayoutText {
  const credits: string[] = [];
  let shapes = input
    .map((s) => ({
      ...s,
      paras: joinWrappedLines(
        s.paras.filter((p) => {
          if (!p.text.trim()) return false;
          if (CREDIT_RE.test(p.text) && p.text.length <= 200) {
            if (!credits.includes(p.text)) credits.push(p.text);
            return false;
          }
          return true;
        }),
      ),
    }))
    .filter((s) => s.paras.length);
  // P39: chữ trang trí — khối chỉ có số, hoặc một ký tự không phải chữ số (ký tự biểu tượng).
  shapes = shapes.filter((s) => {
    const t = textOfShape(s).replace(/\s+/g, "");
    return !(NUMBER_ONLY.test(t) || (t.length === 1 && !/\d/.test(t)));
  });

  let title = fixedTitle ?? "";
  let kicker = "";
  if (fixedTitle === undefined) {
    const picked = pickTitle(shapes, slide.h);
    if (picked) {
      title = picked.shapes.map(textOfShape).join(" ");
      const top = Math.min(...picked.shapes.map((s) => s.box?.y ?? Infinity));
      const isTitle = new Set(picked.shapes);
      shapes = shapes.filter((s) => !isTitle.has(s));
      // P38: khối nhỏ hơn nằm hẳn phía trên tiêu đề là dòng dẫn.
      const above = shapes
        .filter(
          (s) =>
            s.box &&
            Number.isFinite(top) &&
            s.box.y + s.box.cy <= top + 0.25 * s.box.cy &&
            !hasBullet(s) &&
            textOfShape(s).length <= 120 &&
            (sizeOf(s) ?? 0) < picked.size,
        )
        .sort(readingOrder);
      kicker = above.map(textOfShape).join(" · ");
      const isAbove = new Set(above);
      shapes = shapes.filter((s) => !isAbove.has(s));
    } else {
      // Không có cỡ chữ để so: dòng đầu của khối chữ trên cùng nếu ngắn (cách cũ).
      const sorted = [...shapes].sort(readingOrder);
      const topShape = sorted[0];
      if (topShape && topShape.paras[0]!.text.length <= 120) {
        title = topShape.paras[0]!.text;
        shapes = shapes.map((s) => (s === topShape ? { ...s, paras: s.paras.slice(1) } : s)).filter((s) => s.paras.length);
      }
    }
  }

  const { units, tables } = associateLabels(shapes);
  return { title, kicker, credit: credits.join(" · "), paragraphs: units.flatMap((u) => u.paras), tables };
}
