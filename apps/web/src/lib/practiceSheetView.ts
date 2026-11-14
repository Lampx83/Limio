/**
 * Phiếu bài tập (khoá ngoại ngữ) — phần thuần: cách trình bày từng dạng câu, tách chỗ trống trong đề, độ rộng ô điền, chọn câu cần
 * kiểm tra, nhãn tab. Tách khỏi React để thử được không cần dựng giao diện. Xem docs/tieu-chi/limio-language-phieu-bai-tap.md.
 *
 * Cấu hình câu mà học viên nhận là cấu hình CÔNG KHAI (không có đáp án), nên không thể co giãn ô theo độ dài đáp án: ô có độ rộng
 * mặc định rồi nở theo chữ học viên gõ.
 */

export type BlankSegment = { kind: "text"; text: string } | { kind: "blank"; index: number };

/** Một chỗ trống trong đề viết bằng ít nhất 3 dấu gạch dưới liền nhau (importer dùng `______`). */
const BLANK_RE = /_{3,}/g;

/**
 * Tách đề thành đoạn chữ và chỗ trống, theo thứ tự xuất hiện. Đề có ít dấu trống hơn số ô thì các ô còn lại nối vào cuối;
 * đề không có dấu nào thì ô nằm ngay sau chữ (câu trả lời ngắn). Đề có nhiều dấu hơn số ô thì phần dư giữ nguyên là chữ.
 */
export function splitBlankPrompt(prompt: string, blankCount: number): BlankSegment[] {
  const out: BlankSegment[] = [];
  let last = 0;
  let used = 0;
  for (const m of prompt.matchAll(BLANK_RE)) {
    if (used >= blankCount) break;
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: prompt.slice(last, at) });
    out.push({ kind: "blank", index: used++ });
    last = at + m[0].length;
  }
  if (last < prompt.length) out.push({ kind: "text", text: prompt.slice(last) });
  while (used < blankCount) {
    if (out.length > 0 && out[out.length - 1]!.kind === "text") out.push({ kind: "text", text: " " });
    out.push({ kind: "blank", index: used++ });
  }
  return out;
}

export const BLANK_MIN_CH = 8;
export const BLANK_MAX_CH = 40;

/** Độ rộng ô điền (đơn vị ký tự): tối thiểu để thấy ô, nở theo chữ đang gõ, có trần để không tràn dòng. */
export function blankWidthCh(value: string): number {
  return Math.min(BLANK_MAX_CH, Math.max(BLANK_MIN_CH, value.length + 2));
}

/** Đáp án ngắn của câu chọn: tối đa ba lựa chọn, mỗi lựa chọn ≤ 18 ký tự, tổng ≤ 60. */
export const INLINE_MAX_OPTIONS = 3;
export const INLINE_MAX_LABEL = 18;
export const INLINE_MAX_TOTAL = 60;

export function choicesFitInline(labels: string[]): boolean {
  if (labels.length < 2 || labels.length > INLINE_MAX_OPTIONS) return false;
  if (labels.some((l) => l.length > INLINE_MAX_LABEL)) return false;
  return labels.reduce((n, l) => n + l.length, 0) <= INLINE_MAX_TOTAL;
}

export type SheetKind = "gap" | "choice-inline" | "choice-list" | "multi-list" | "tfng" | "matching" | "ordering" | "drag" | "numerical" | "essay" | "other";

interface SheetQuestion {
  type: string;
  config: Record<string, unknown>;
}

function optionLabels(config: Record<string, unknown>): string[] {
  const o = config.options;
  return Array.isArray(o) ? o.map((x) => (x && typeof x === "object" && typeof (x as { label?: unknown }).label === "string" ? (x as { label: string }).label : "")) : [];
}

/** Cách phiếu dựng ô trả lời của một câu. `essay` và dạng lạ không vào dòng (giữ thẻ riêng). */
export function sheetKind(q: SheetQuestion): SheetKind {
  switch (q.type) {
    case "gap_fill":
    case "short_answer":
      return "gap";
    case "mcq":
      return choicesFitInline(optionLabels(q.config)) ? "choice-inline" : "choice-list";
    case "multi":
      return "multi-list";
    case "true_false_notgiven":
      return "tfng";
    case "matching":
      return "matching";
    case "ordering":
      return "ordering";
    case "drag_drop_fill":
      return "drag";
    case "numerical":
      return "numerical";
    case "essay":
      return "essay";
    default:
      return "other";
  }
}

/** Số chỗ trống của câu điền (câu trả lời ngắn không có danh sách ô thì tính một). */
export function blankCountOf(q: SheetQuestion): number {
  const b = q.config.blanks;
  return Array.isArray(b) && b.length > 0 ? b.length : 1;
}

/** Nhãn tab: tiêu đề đoạn văn nếu có, không thì "Bài n" (n từ 1). */
export function tabLabel(passageTitle: string | null | undefined, index: number): string {
  const t = (passageTitle ?? "").trim();
  return t !== "" ? t : `Bài ${index + 1}`;
}

/**
 * Nhãn NGẮN của tab (để thanh tab gọn một hàng): mã bài tập của sách nếu có ("Exercise 7A · Three lifestyles" → "7A", "Ex 2B–2C · …" → "2B–2C"), không thì phần sau dấu "·"
 * ("Choose the alternatives · Conversation 1" → "Conversation 1"), không thì chính tiêu đề cắt ngắn. Hai tab trùng nhãn ngắn thì thêm phần mô tả để phân biệt;
 * tiêu đề đầy đủ vẫn có ở gợi ý khi rê chuột.
 */
const SHORT_MAX = 14;
const clip = (t: string) => (t.length > SHORT_MAX ? `${t.slice(0, SHORT_MAX - 1).trimEnd()}…` : t);

export function tabShortLabels(titles: Array<string | null | undefined>): string[] {
  const base = titles.map((raw, i) => {
    const t = (raw ?? "").trim();
    if (t === "") return `Bài ${i + 1}`;
    // Sách in nhãn "2A" không có chữ "Ex"; tiêu đề cũ "Ex 2A · …" vẫn nhận.
    const m = /^(?:Ex(?:ercise)?\.?\s*)?(\d+[A-E](?:\s*[\u2013-]\s*\d*[A-E])?)\b/i.exec(t);
    if (m) return m[1]!.replace(/\s+/g, "");
    const parts = t.split(" \u00b7 ");
    return clip((parts.length > 1 ? parts[parts.length - 1]!.trim() : t).split("/")[0]!.trim());
  });
  return base.map((b, i) => {
    if (base.filter((x) => x === b).length < 2) return b;
    const t = (titles[i] ?? "").trim();
    const rest = t.split(" \u00b7 ").slice(1).join(" \u00b7 ").trim();
    return rest ? clip(`${b} ${rest}`) : `${b} (${i + 1})`;
  });
}

/** Dấu ô thả của câu kéo thả điền: `[[1]]`, `[[2]]`… Trả các đoạn theo thứ tự. */
export type DragSegment = { kind: "text"; text: string } | { kind: "slot"; slot: string };

export function splitDragPrompt(prompt: string): DragSegment[] {
  const out: DragSegment[] = [];
  let last = 0;
  for (const m of prompt.matchAll(/\[\[(\d+)\]\]/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: prompt.slice(last, at) });
    out.push({ kind: "slot", slot: m[1]! });
    last = at + m[0].length;
  }
  if (last < prompt.length) out.push({ kind: "text", text: prompt.slice(last) });
  return out;
}

/** Chữ cái a, b, c… cho vế phải của câu ghép. */
export function letterOf(index: number): string {
  return String.fromCharCode(97 + (index % 26));
}

/**
 * Câu cần chấm khi bấm "Kiểm tra bài này"/"Kiểm tra tất cả": đã trả lời, chưa chấm (hoặc đã sửa sau lần chấm — khi sửa, kết quả cũ
 * đã bị xoá nên cũng là "chưa chấm"), không đang nạp lại, và không phải tự luận (tự luận có nút riêng trong thẻ).
 */
export function questionsToCheck(
  ids: string[],
  state: { answered: (id: string) => boolean; checked: (id: string) => boolean; restoring: (id: string) => boolean; isEssay: (id: string) => boolean },
): string[] {
  return ids.filter((id) => !state.isEssay(id) && state.answered(id) && !state.checked(id) && !state.restoring(id));
}

/** Tóm tắt chân phiếu: "Đúng x / y" (trên các câu đã chấm) và "còn n câu chưa làm". Rỗng khi chưa có gì để nói. */
export function sheetStatus(ids: string[], state: { answered: (id: string) => boolean; checked: (id: string) => boolean; correct: (id: string) => boolean; isEssay: (id: string) => boolean }): string {
  const real = ids.filter((id) => !state.isEssay(id));
  const checked = real.filter((id) => state.checked(id));
  const left = real.filter((id) => !state.answered(id) && !state.checked(id)).length;
  const parts: string[] = [];
  if (checked.length > 0) parts.push(`Đúng ${checked.filter((id) => state.correct(id)).length} / ${checked.length}`);
  if (left > 0) parts.push(`còn ${left} câu chưa làm`);
  const text = parts.join(" · ");
  return text === "" ? "" : text.charAt(0).toUpperCase() + text.slice(1);
}

/** Đáp án đúng bằng chữ cho hàng sai; null khi dạng câu cần trình bày đầy đủ hơn (ghép, sắp xếp, kéo thả). */
export function revealText(type: string, config: unknown): string | null {
  const c = config && typeof config === "object" ? (config as Record<string, unknown>) : {};
  if (type === "gap_fill" || type === "short_answer") {
    const blanks = Array.isArray(c.blanks) ? c.blanks : [];
    const firsts = blanks.map((b) => {
      const a = b && typeof b === "object" ? (b as { acceptedAnswers?: unknown }).acceptedAnswers : null;
      return Array.isArray(a) && typeof a[0] === "string" ? a[0] : "";
    });
    if (firsts.length > 0 && firsts.every((x) => x !== "")) return firsts.join(" · ");
    if (type === "short_answer" && Array.isArray(c.acceptedAnswers) && typeof c.acceptedAnswers[0] === "string") return c.acceptedAnswers[0];
    return null;
  }
  if (type === "mcq" || type === "multi") {
    const opts = Array.isArray(c.options) ? c.options : [];
    const right = opts.filter((o) => o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true).map((o) => String((o as { label?: unknown }).label ?? ""));
    return right.length > 0 ? right.join(" / ") : null;
  }
  if (type === "true_false_notgiven") {
    const t = c.correct;
    return t === "true" ? "TRUE" : t === "false" ? "FALSE" : t === "notgiven" ? "NOT GIVEN" : null;
  }
  return null;
}

export type SheetRun = { kind: "single"; id: string } | { kind: "shared"; ids: string[]; labels: string[] };

/**
 * Giáo trình hay có một bộ lựa chọn dùng chung cho nhiều câu liền nhau ("Match sentences 1–7 with uses a)–g)"), nhưng dữ liệu nhập
 * lặp lại bộ lựa chọn đó trong từng câu. Từ ba câu liền nhau trở lên có cùng danh sách lựa chọn dài (chọn một) thì gộp thành một
 * nhóm: bộ lựa chọn hiện MỘT lần (a, b, c…), mỗi câu chỉ còn một ô chọn chữ cái.
 */
export const SHARED_MIN_QUESTIONS = 3;

export function groupSharedOptions(list: Array<{ id: string; type: string; labels: string[] }>): SheetRun[] {
  const out: SheetRun[] = [];
  let i = 0;
  while (i < list.length) {
    const first = list[i]!;
    let j = i + 1;
    if (first.type === "mcq" && !choicesFitInline(first.labels) && first.labels.length >= 2) {
      const key = JSON.stringify(first.labels);
      while (j < list.length && list[j]!.type === "mcq" && JSON.stringify(list[j]!.labels) === key) j++;
    }
    if (j - i >= SHARED_MIN_QUESTIONS) out.push({ kind: "shared", ids: list.slice(i, j).map((x) => x.id), labels: first.labels });
    else for (let k = i; k < j; k++) out.push({ kind: "single", id: list[k]!.id });
    i = j;
  }
  return out;
}

/** Nhãn các lựa chọn của câu chọn (theo thứ tự công khai). */
export function optionLabelsOf(config: Record<string, unknown>): string[] {
  return optionLabels(config);
}
