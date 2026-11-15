/**
 * Bố cục bài học ngoại ngữ: lý thuyết ở trên, mỗi khối Bài luyện là một tab (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC5–AC6).
 *
 * Hàm thuần, chạy trên máy chủ: nhận danh sách khối của bài (đã lọc theo người xem) và trả về
 *  - `theory`: các khối không phải bài luyện, giữ thứ tự;
 *  - `tabs`: mỗi khối Bài luyện được hiện, kèm `lead` — phần chữ của sách đi cùng phiếu bạn ảo (AC6), đã bỏ câu yêu cầu.
 */

export interface SectionItem {
  id: string;
  type: string;
  payload: unknown;
}

export interface SectionTab<T extends SectionItem> {
  id: string;
  label: string;
  lead: T[];
  /** Khối là phiếu "Talk with a virtual partner": để phân biệt khi trùng nhãn. */
  virtualPartner: boolean;
}

/**
 * Xếp tab theo số exercise của sách (7, 8A, 8B, …) để vào bài nào cũng thấy theo thứ tự quen thuộc.
 * Chỉ xếp lại khi MỌI tab đều có nhãn bắt đầu bằng số; còn không giữ nguyên thứ tự cũ.
 * Xếp ổn định: cùng số/chữ thì giữ thứ tự cũ.
 */
export function arrangeTabs<T extends { label: string; virtualPartner: boolean }>(tabs: readonly T[]): T[] {
  const key = (label: string): [number, string] | null => {
    const m = /^(\d+)([A-E])?/.exec(label);
    return m ? [Number(m[1]), m[2] ?? ""] : null;
  };
  let out = tabs.map((t) => ({ ...t }));
  if (out.every((t) => key(t.label))) {
    out = out
      .map((t, i) => ({ t, i }))
      .sort((a, b) => {
        const ka = key(a.t.label)!;
        const kb = key(b.t.label)!;
        return ka[0] - kb[0] || ka[1].localeCompare(kb[1]) || a.i - b.i;
      })
      .map((x) => x.t);
  }
  return out;
}

/** Một exercise chỉ một tab: các tab cùng nhãn (vd bài viết 3D và phiếu bạn ảo 3D) gộp thành một, đứng ở vị trí của tab đầu. */
export function mergeTabsByLabel<T extends { label: string }>(tabs: readonly T[], combine: (group: T[]) => T): T[] {
  const groups = new Map<string, T[]>();
  for (const t of tabs) groups.set(t.label, [...(groups.get(t.label) ?? []), t]);
  return [...groups.values()].map((g) => (g.length === 1 ? g[0]! : combine(g)));
}

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);

const LABEL_RE = /^(\d+)([A-E])?(?:[–-](?:\d+)?([A-E]))?$/;

/** Nhãn exercise ở đầu các tiêu đề ("2A · …", "5A–5B · …", "7 · …") gộp thành "3A–3C, 5"; không có nhãn nào → null. */
export function exerciseLabels(titles: readonly string[]): string | null {
  const parts: { num: string; from: string; to: string }[] = [];
  for (const t of titles) {
    const m = LABEL_RE.exec(t.split(" · ")[0]!.trim());
    if (!m) continue;
    const from = m[2] ?? "";
    const to = m[3] ?? from;
    const last = parts[parts.length - 1];
    if (last && last.num === m[1] && last.to && from && from.charCodeAt(0) === last.to.charCodeAt(0) + 1) last.to = to;
    else parts.push({ num: m[1]!, from, to });
  }
  if (parts.length === 0) return null;
  return parts.map((r) => (r.from ? (r.to && r.to !== r.from ? `${r.num}${r.from}–${r.num}${r.to}` : `${r.num}${r.from}`) : r.num)).join(", ");
}

/** Tên tab dự phòng: tên khối, bỏ đuôi " · Practice" mà bộ nhập khoá thêm cho khối gộp. */
export function practiceTabLabel(title: string): string {
  const t = title.replace(/\s*·\s*Practice\s*$/i, "").trim();
  return t || "Bài luyện";
}

/** Tách HTML thành các nút cấp cao nhất. Trả null khi HTML dở dang (khi đó không đụng tới khối này). */
function topLevelNodes(html: string): string[] | null {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  const nodes: string[] = [];
  let depth = 0;
  let start = -1;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [full, close, rawTag, selfClose] = m as unknown as [string, string, string, string];
    const tag = rawTag.toLowerCase();
    if (depth === 0) {
      const between = html.slice(last, m.index);
      if (between.trim()) nodes.push(between);
      last = m.index;
    }
    if (!close) {
      if (VOID_TAGS.has(tag) || selfClose) {
        if (depth === 0) {
          nodes.push(full);
          last = re.lastIndex;
        }
        continue;
      }
      if (depth === 0) start = m.index;
      depth++;
    } else {
      depth--;
      if (depth < 0) return null;
      if (depth === 0) {
        nodes.push(html.slice(start, re.lastIndex));
        last = re.lastIndex;
      }
    }
  }
  if (depth !== 0) return null;
  const tail = html.slice(last);
  if (tail.trim()) nodes.push(tail);
  return nodes;
}

// Câu yêu cầu của sách do bộ nhập khoá dựng: đoạn văn mở đầu bằng số và/hoặc chữ cái (A–E) tô màu thương hiệu.
const STATEMENT = /^<p\b[^>]*>\s*((?:<span\b[^>]*color:\s*rgb\(229,\s*0,\s*92\)[^>]*>[^<]{1,4}<\/span>\s*){1,2})/i;
const BOUNDARY = /^<(?:h[1-6]|aside)\b/i;

interface Label {
  num?: string;
  letter?: string;
}

function parseStatement(node: string, currentNum: string | undefined): Label | null {
  const m = STATEMENT.exec(node);
  if (!m) return null;
  const spans = [...m[1]!.matchAll(/>([^<]{1,4})<\/span>/g)].map((x) => x[1]!.trim());
  let num: string | undefined;
  let letter: string | undefined;
  for (const s of spans) {
    if (/^\d+$/.test(s)) num = s;
    else if (/^[A-E]$/.test(s)) letter = s;
    else return null;
  }
  if (!num && !letter) return null;
  return { num: num ?? currentNum, letter };
}

/** "2A" · "2A–2C" · "6" ở đầu tên khối → nhãn; tên khác ("The world's favourite drug") → null. */
function parsePracticeLabel(title: string): { num: string; from?: string; to?: string } | null {
  const head = title.split(" · ")[0]!.trim();
  const m = /^(\d+)([A-E])?(?:[–-](?:\d+)?([A-E]))?$/.exec(head);
  if (!m) return null;
  return { num: m[1]!, from: m[2], to: m[3] ?? m[2] };
}

function matches(lead: Label, title: string): boolean {
  const p = parsePracticeLabel(title);
  if (!p || lead.num !== p.num) return false;
  if (!p.from) return !lead.letter;
  if (!lead.letter) return false;
  return lead.letter >= p.from && lead.letter <= (p.to ?? p.from);
}

interface Lead {
  start: number;
  end: number;
  label: Label;
}
interface Chunk {
  nodes: string[];
  leads: Lead[];
}

const isVirtualPartner = (title: string) => /virtual partner/i.test(title);
const htmlOf = (it: SectionItem): string | null => {
  const h = (it.payload as { html?: unknown } | null)?.html;
  return typeof h === "string" ? h : null;
};

export function splitLessonSections<T extends SectionItem>(
  items: readonly T[],
  practiceIds: ReadonlySet<string>,
  /** Tiêu đề các đoạn của từng khối bài luyện (id khối → tiêu đề), để lấy số exercise khi tên khối không có. */
  passageTitles?: ReadonlyMap<string, readonly string[]>,
): { theory: T[]; tabs: SectionTab<T>[] } {
  // 1) với mỗi khối chữ: tách nút và tìm các câu yêu cầu (số của câu chỉ-có-chữ-cái nối tiếp số câu trước)
  const chunks = new Map<number, Chunk>();
  let currentNum: string | undefined;
  items.forEach((it, i) => {
    if (it.type !== "richtext") return;
    const html = htmlOf(it);
    const nodes = html === null ? null : topLevelNodes(html);
    if (!nodes) return;
    const leads: Lead[] = [];
    nodes.forEach((node, k) => {
      const label = parseStatement(node, currentNum);
      if (!label) return;
      if (label.num) currentNum = label.num;
      leads.push({ start: k, end: nodes.length, label });
    });
    // câu yêu cầu kéo dài tới tiêu đề/hộp quy tắc/câu yêu cầu kế tiếp, hoặc hết khối
    leads.forEach((ld, j) => {
      let end = ld.start + 1;
      while (end < nodes.length && !BOUNDARY.test(nodes[end]!) && !leads.some((o, q) => q !== j && o.start === end)) end++;
      ld.end = end;
    });
    chunks.set(i, { nodes, leads });
  });

  // 2) gắn phần chữ đi cùng vào tab của phiếu bạn ảo (khối chữ liền trước, câu yêu cầu cuối cùng, kéo tới hết khối, khớp số/chữ)
  const removed = new Map<number, [number, number]>();
  const leadOf = new Map<number, T[]>();
  items.forEach((it, i) => {
    if (it.type !== "exam_practice" || !practiceIds.has(it.id)) return;
    const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
    if (!isVirtualPartner(title) || i === 0) return;
    const chunk = chunks.get(i - 1);
    const lead = chunk?.leads[chunk.leads.length - 1];
    if (!chunk || !lead || lead.end !== chunk.nodes.length || !matches(lead.label, title)) return;
    const rest = chunk.nodes.slice(lead.start + 1, lead.end);
    removed.set(i - 1, [lead.start, lead.end]);
    if (rest.length > 0) {
      const src = items[i - 1]!;
      leadOf.set(i, [{ ...src, id: `${src.id}~${it.id}`, payload: { ...(src.payload as object), html: rest.join("") } } as T]);
    }
  });

  // nhãn câu yêu cầu của sách đứng ngay trước một khối (dự phòng cho tên tab)
  const labelBefore = (i: number): string | null => {
    const chunk = i > 0 ? chunks.get(i - 1) : undefined;
    const lead = chunk?.leads[chunk.leads.length - 1];
    if (!chunk || !lead || lead.end !== chunk.nodes.length || !lead.label.num) return null;
    return `${lead.label.num}${lead.label.letter ?? ""}`;
  };

  // 3) dựng kết quả
  const theory: T[] = [];
  const tabs: SectionTab<T>[] = [];
  items.forEach((it, i) => {
    if (it.type === "exam_practice" && practiceIds.has(it.id)) {
      const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
      const label =
        exerciseLabels([title]) ?? exerciseLabels(passageTitles?.get(it.id) ?? []) ?? labelBefore(i) ?? practiceTabLabel(title);
      tabs.push({ id: it.id, label, lead: leadOf.get(i) ?? [], virtualPartner: isVirtualPartner(title) });
      return;
    }
    const cut = removed.get(i);
    if (!cut) {
      theory.push(it);
      return;
    }
    const nodes = chunks.get(i)!.nodes;
    const html = [...nodes.slice(0, cut[0]), ...nodes.slice(cut[1])].join("");
    if (html.trim()) theory.push({ ...it, payload: { ...(it.payload as object), html } } as T);
  });
  return { theory, tabs: arrangeTabs(tabs) };
}
