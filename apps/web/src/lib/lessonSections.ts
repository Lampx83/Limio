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
  /**
   * Banner phần của sách (FUNCTION, LEARN TO) và số trang đứng ngay trước khối này: đi cùng tab đầu tiên của khối thay vì đứng trơ trọi trên
   * đầu bài. Không có thì bỏ trống.
   */
  intro?: T[];
  /** Khối là phiếu "Talk with a virtual partner": để phân biệt khi trùng nhãn. */
  virtualPartner: boolean;
  /** Tab của exercise chỉ có chữ (không có khối bài luyện): nội dung là câu yêu cầu và phần đi kèm. */
  statement: boolean;
}

/**
 * Xếp tab theo số exercise của sách (7, 8A, 8B, …) để vào bài nào cũng thấy theo thứ tự quen thuộc.
 * Mọi tab đều bắt đầu bằng số: xếp theo số rồi chữ cái (như trước).
 * Có tab không phải số ("Free practice", tên khối): chỉ khi nhãn là mã exercise đúng nghĩa ("1B", "3A–3D, 5", "7 · …") mới xếp theo số
 * và đứng trước; các tab còn lại ("Match the words…", "2 (1) · Talk…" của khoá tiếng Trung) đứng sau, giữ thứ tự cũ với nhau.
 * Không có mã exercise nào thì giữ nguyên thứ tự. Xếp ổn định: cùng số/chữ thì giữ thứ tự cũ.
 */
export function arrangeTabs<T extends { label: string; virtualPartner: boolean }>(tabs: readonly T[]): T[] {
  const key = (label: string, strict: boolean): [number, string] | null => {
    const m = (strict ? /^(\d+)([A-E])?(?:[–-]\d*[A-E])?(?=,|$| · )/ : /^(\d+)([A-E])?/).exec(label);
    return m ? [Number(m[1]), m[2] ?? ""] : null;
  };
  const cmp = (a: { k: [number, string]; i: number }, b: { k: [number, string]; i: number }) =>
    a.k[0] - b.k[0] || a.k[1].localeCompare(b.k[1]) || a.i - b.i;
  const all = tabs.every((t) => key(t.label, false));
  const items = tabs.map((t, i) => ({ t: { ...t }, i, k: key(t.label, !all) }));
  const numbered = items.filter((x) => x.k) as { t: T; i: number; k: [number, string] }[];
  const plain = items.filter((x) => !x.k).map((x) => x.t);
  return [...numbered.sort(cmp).map((x) => x.t), ...plain];
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

/**
 * Tiêu đề hiện ở khối đề bài. Phiếu bạn ảo là phần nhỏ của exercise (vd "3D · Talk with a virtual partner" nằm trong tab 3D) nên không đánh lại mã bài:
 * bỏ mã ở đầu, chỉ giữ "Talk with a virtual partner". Tiêu đề khác giữ nguyên.
 */
export function passageDisplayTitle(title: string): string {
  const m = /^(\S+)\s·\s(.+)$/.exec(title);
  if (m && LABEL_RE.test(m[1]!) && /virtual partner/i.test(m[2]!)) return m[2]!;
  return title;
}

/**
 * Banner của sách có hai dòng (vd "Reading" / "The world's favourite drug"); dòng phụ trùng với tên bài (đã hiện ở đầu trang) thì bỏ để
 * tiêu đề không lặp. Không phải banner hai dòng, hoặc dòng phụ khác tên bài: giữ nguyên.
 */
export function dropRepeatedBannerTitle(html: string, lessonTitle: string): string {
  const norm = (t: string) => t.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
  const title = norm(lessonTitle);
  return html.replace(/(<h2\b[^>]*>\s*<span\b[^>]*>[^<]*<\/span>)\s*<span\b[^>]*>([^<]*)<\/span>(\s*<\/h2>)/i, (all, head: string, sub: string, tail: string) => {
    const n = norm(sub);
    return n && title.includes(n) ? head + tail : all;
  });
}

/**
 * Banner "Exercise 1" của sách (một thanh tô màu hoặc dòng tiêu đề chỉ có chữ "Exercise" và số): số exercise đã nằm trên tab nên bỏ thanh này khỏi phần lý thuyết.
 * Banner có chữ khác (Reading, Vocabulary, Grammar…) giữ nguyên.
 */
export function dropExerciseBanner(html: string): string {
  return html.replace(/<h([2-4])\b[^>]*>\s*(?:<span\b[^>]*>\s*)?Exercises?\s+\d+\s*(?:<\/span>\s*)?<\/h\1>/gi, "");
}

/** Chữ đậm làm nhãn người nói ("Jodi:", "Victor:") không phải từ vựng mục tiêu: đánh dấu để không bôi màu như chữ đậm trong câu. */
export function markLabelBold(html: string): string {
  return html.replace(/<strong>([^<]{1,40}:)(\s*)<\/strong>/g, '<strong class="pv-nohl">$1$2</strong>');
}

/** "3A–3C, 5" → ["3A","3B","3C","5"]; "2B–2C" → ["2B","2C"]; "7" → ["7"]. */
function codesOf(label: string): string[] {
  const out: string[] = [];
  for (const part of label.split(",").map((x) => x.trim())) {
    const m = /^(\d+)([A-E])?(?:[–-]\d*([A-E]))?$/.exec(part);
    if (!m) continue;
    if (!m[2]) out.push(m[1]!);
    else for (let c = m[2].charCodeAt(0); c <= (m[3] ?? m[2]).charCodeAt(0); c++) out.push(`${m[1]}${String.fromCharCode(c)}`);
  }
  return out;
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
// Banner phần của sách (thanh tô màu thương hiệu), dòng số trang và tiêu đề "Exercise N" mà bộ nhập khoá dựng quanh mỗi phần.
const SECTION_BANNER = /^<h2\b[^>]*>[\s\S]*rgb\(229,\s*0,\s*92\)/i;
const PAGE_MARK = /^<p\b[^>]*>\s*Student[’']s Book\s*·\s*page\s*\d+\s*<\/p>\s*$/i;
const EXERCISE_HEAD = /^<h[2-4]\b[^>]*>\s*(?:<span\b[^>]*>\s*)?Exercises?\s+\d+\s*(?:<\/span>\s*)?<\/h[2-4]>\s*$/i;

interface Label {
  num?: string;
  letter?: string;
}

/** Bỏ các nhãn số/chữ tô màu ở đầu câu yêu cầu, giữ nguyên chữ. */
function stripStatementLabel(node: string): string {
  const m = STATEMENT.exec(node);
  return m ? node.replace(m[1]!, "") : node;
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
  /** Khối có bài đọc đã được đưa lên phần lý thuyết (dùng chung cho nhiều exercise): câu dẫn đứng ngay trước nó không mang nhãn exercise. */
  sharedReadingIds?: ReadonlySet<string>,
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

  // 2) gắn câu yêu cầu của sách và phần đi kèm vào tab của PHIẾU BẠN ẢO (khối chữ liền trước, câu yêu cầu cuối cùng, kéo tới hết khối, khớp số/chữ).
  const removed = new Map<number, [number, number]>();
  const leadOf = new Map<number, T[]>();
  items.forEach((it, i) => {
    if (it.type !== "exam_practice" || !practiceIds.has(it.id)) return;
    const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
    if (!isVirtualPartner(title) || i === 0) return;
    const chunk = chunks.get(i - 1);
    const lead = chunk?.leads[chunk.leads.length - 1];
    if (!chunk || !lead || lead.end !== chunk.nodes.length || !matches(lead.label, title)) return;
    // Câu yêu cầu của sách ở lại (bỏ nhãn số/chữ vì số đã có trên tab) cùng phần đi kèm; phiếu bạn ảo là phần nhỏ bên dưới.
    const keep = [stripStatementLabel(chunk.nodes[lead.start]!), ...chunk.nodes.slice(lead.start + 1, lead.end)];
    removed.set(i - 1, [lead.start, lead.end]);
    const src = items[i - 1]!;
    leadOf.set(i, [{ ...src, id: `${src.id}~${it.id}`, payload: { ...(src.payload as object), html: keep.join("") } } as T]);
  });

  // Bài đọc dùng chung: câu dẫn đứng ngay trước khối giữ chữ nhưng bỏ nhãn số/chữ ("2 B").
  const unlabel = new Map<number, number>();
  items.forEach((it, i) => {
    if (it.type !== "exam_practice" || !sharedReadingIds?.has(it.id) || i === 0 || removed.has(i - 1)) return;
    const chunk = chunks.get(i - 1);
    const lead = chunk?.leads[chunk.leads.length - 1];
    if (chunk && lead && lead.end === chunk.nodes.length) unlabel.set(i - 1, lead.start);
  });

  // Câu yêu cầu đứng ngay trước một khối: các câu liền nhau cuối khối chữ (1A rồi 1B) là một cụm. Khối bài tập không có tên riêng thuộc
  // về câu ĐẦU của cụm (1A là việc làm trên khối, 1B là câu hỏi thảo luận đi sau); phiếu bạn ảo thuộc về câu cuối (đã xử lý ở trên).
  const leadBefore = (i: number, virtualPartner: boolean): { chunk: Chunk; lead: Lead } | null => {
    const chunk = i > 0 ? chunks.get(i - 1) : undefined;
    const last = chunk?.leads[chunk.leads.length - 1];
    if (!chunk || !last || last.end !== chunk.nodes.length || !last.label.num) return null;
    if (virtualPartner) return { chunk, lead: last };
    let first = last;
    for (let j = chunk.leads.length - 2; j >= 0; j--) {
      const ld = chunk.leads[j]!;
      if (ld.end !== first.start || ld.label.num !== last.label.num) break;
      first = ld;
    }
    return { chunk, lead: first };
  };
  const labelBefore = (i: number, virtualPartner = false): string | null => {
    const found = leadBefore(i, virtualPartner);
    return found ? `${found.lead.label.num}${found.lead.label.letter ?? ""}` : null;
  };
  const isVpBlock = (it: T) => isVirtualPartner(String((it.payload as { title?: unknown } | null)?.title ?? ""));
  const hasOwnLabel = (it: T) => {
    const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
    return !!exerciseLabels([title]) || (passageTitles?.get(it.id) ?? []).some((t) => !!exerciseLabels([t]));
  };

  // 2b) câu yêu cầu của exercise CHƯA có tab (chỉ có chữ, vd 7A, 7B, 8B ở 1.2 Writing) thành một tab riêng: câu yêu cầu + phần đi kèm tới tiêu đề/hộp kế tiếp.
  const covered = new Set<string>();
  items.forEach((it, i) => {
    if (it.type !== "exam_practice" || !practiceIds.has(it.id)) return;
    const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
    const own = [exerciseLabels([title]), ...(passageTitles?.get(it.id) ?? []).map((t) => exerciseLabels([t]))].filter((l): l is string => !!l);
    // Khối không có nhãn riêng thì tên tab lấy từ câu yêu cầu đứng ngay trước: số đó đã có tab.
    for (const l of own.length > 0 ? own : [labelBefore(i, isVpBlock(it))]) if (l) codesOf(l).forEach((c) => covered.add(c));
  });
  const stmtCuts = new Map<number, Array<[number, number]>>();
  // Khối bài tập không có tên riêng lấy tên từ câu yêu cầu liền trước: câu đó (và phần đi kèm) xuống ngồi trong tab của khối.
  items.forEach((it, i) => {
    if (it.type !== "exam_practice" || !practiceIds.has(it.id) || isVpBlock(it) || hasOwnLabel(it) || sharedReadingIds?.has(it.id)) return;
    const found = leadBefore(i, false);
    if (!found) return;
    const { chunk, lead } = found;
    const src = items[i - 1]!;
    const html = [stripStatementLabel(chunk.nodes[lead.start]!), ...chunk.nodes.slice(lead.start + 1, lead.end)].join("");
    leadOf.set(i, [{ ...src, id: `${src.id}~${it.id}`, payload: { ...(src.payload as object), html } } as T]);
    stmtCuts.set(i - 1, [...(stmtCuts.get(i - 1) ?? []), [lead.start, lead.end]]);
  });
  const stmtTabs: SectionTab<T>[] = [];
  chunks.forEach((chunk, i) => {
    for (const lead of chunk.leads) {
      if (!lead.label.num || removed.get(i)?.[0] === lead.start) continue;
      const code = `${lead.label.num}${lead.label.letter ?? ""}`;
      if (covered.has(code)) continue;
      const src = items[i]!;
      // Số exercise đã có trên tab: bỏ nhãn số/chữ ở đầu câu yêu cầu để không lặp lại.
      const html = [stripStatementLabel(chunk.nodes[lead.start]!), ...chunk.nodes.slice(lead.start + 1, lead.end)].join("");
      stmtTabs.push({
        id: `${src.id}~s${lead.start}`,
        label: code,
        lead: [{ ...src, id: `${src.id}~s${lead.start}`, payload: { ...(src.payload as object), html } } as T],
        virtualPartner: false,
        statement: true,
      });
      stmtCuts.set(i, [...(stmtCuts.get(i) ?? []), [lead.start, lead.end]]);
    }
  });

  // 3) dựng kết quả
  const theory: T[] = [];
  const tabs: SectionTab<T>[] = [];
  const introOf = new Map<number, T[]>();
  items.forEach((it, i) => {
    if (it.type === "exam_practice" && practiceIds.has(it.id)) {
      const title = String((it.payload as { title?: unknown } | null)?.title ?? "");
      const label =
        exerciseLabels([title]) ?? exerciseLabels(passageTitles?.get(it.id) ?? []) ?? labelBefore(i, isVirtualPartner(title)) ?? practiceTabLabel(title);
      const intro = introOf.get(i);
      tabs.push({ id: it.id, label, lead: leadOf.get(i) ?? [], ...(intro ? { intro } : {}), virtualPartner: isVirtualPartner(title), statement: false });
      return;
    }
    const cuts = [...(removed.has(i) ? [removed.get(i)!] : []), ...(stmtCuts.get(i) ?? [])];
    // Khối chữ chỉ còn banner phần / số trang / tiêu đề "Exercise N" mà liền sau là một khối bài luyện: phần đó đi cùng tab đầu của khối.
    // Banner đầu bài (chưa có lý thuyết nào đứng trước) ở lại để trang vẫn mở đầu bằng banner.
    const next = items[i + 1];
    const chunk = chunks.get(i);
    if (it.type === "richtext" && chunk && next && next.type === "exam_practice" && practiceIds.has(next.id) && !sharedReadingIds?.has(next.id)) {
      const rest = chunk.nodes.filter((_, k) => !cuts.some(([a, b]) => k >= a && k < b));
      const bodyNodes = rest.filter((n) => !EXERCISE_HEAD.test(n));
      const isBanner = (n: string) => SECTION_BANNER.test(n);
      if (bodyNodes.length > 0 && bodyNodes.every((n) => isBanner(n) || PAGE_MARK.test(n)) && (theory.length > 0 || !bodyNodes.some(isBanner))) {
        introOf.set(i + 1, [{ ...it, id: `${it.id}~intro`, payload: { ...(it.payload as object), html: bodyNodes.join("") } } as T]);
        return;
      }
    }
    if (cuts.length === 0) {
      const at = unlabel.get(i);
      if (at !== undefined) {
        const nodes = chunks.get(i)!.nodes.slice();
        nodes[at] = stripStatementLabel(nodes[at]!);
        theory.push({ ...it, payload: { ...(it.payload as object), html: nodes.join("") } } as T);
        return;
      }
      theory.push(it);
      return;
    }
    const nodes = chunks.get(i)!.nodes;
    const html = nodes.filter((_, k) => !cuts.some(([a, b]) => k >= a && k < b)).join("");
    if (html.trim()) theory.push({ ...it, payload: { ...(it.payload as object), html } } as T);
  });
  return { theory, tabs: arrangeTabs([...tabs, ...stmtTabs]) };
}
