/**
 * Logic thuần của trình soạn kéo thả — xem
 * apps/web/src/components/question-editor/DragDropFillEditor.tsx.
 *
 * Đợt 9: tổng quát hoá để dùng chung Quiz/Ngân hàng/Đề thi — trước đó file
 * này chỉ Quiz dùng, `Opt` mang cả `isCorrect`/`misconceptionId` (kế thừa từ
 * OptionDraft chung của Quiz dù 2 field đó vô nghĩa với loại này). Giờ `Opt`
 * đổi tên thành `Token`, chỉ còn đúng field cốt lõi thuật toán cần
 * (`id`/`label`/`blankIndex`, khớp canonical DragDropToken) — component nào
 * cần thêm field Quiz-only thì tự lo ở tầng adapter riêng, không lẫn vào đây.
 *
 * `id` chỉ cần DUY NHẤT trong 1 lần xuất mảng (server yêu cầu), KHÔNG cần ổn
 * định qua các lần sửa — UI luôn key theo số ô/blankIndex hoặc vị trí mảng
 * mồi nhử, không key theo `id`, nên tự sinh id mới mỗi lần rebuild là an toàn.
 */

export interface Token {
  id: string;
  label: string;
  blankIndex: number | null;
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `ddt${Date.now().toString(36)}${seq}`;
}

const BLANK_RE = /\[\[(\d+)\]\]/g;
const BLANK_ONE = /^\[\[(\d+)\]\]$/;

export function blankIndexes(prompt: string): number[] {
  const seen = new Set<number>();
  for (const m of prompt.matchAll(BLANK_RE)) {
    const n = Number(m[1]);
    if (n >= 1) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

export function blankOf(t: Token): number | null {
  return typeof t.blankIndex === "number" && t.blankIndex >= 1 ? t.blankIndex : null;
}

export function mk(label: string, blankIndex: number | null): Token {
  return { id: newId(), label, blankIndex };
}

export function split(tokens: Token[]) {
  const answers = new Map<number, Token>();
  const distractors: Token[] = [];
  for (const t of tokens) {
    const b = blankOf(t);
    if (b === null) distractors.push(mk(t.label, null));
    else if (!answers.has(b)) answers.set(b, t);
  }
  return { answers, distractors };
}

export function compose(blanks: number[], answers: Map<number, Token>, distractors: Token[]): Token[] {
  return [...blanks.map((n) => answers.get(n) ?? mk("", n)), ...distractors];
}

export type Tok =
  | { kind: "space"; text: string }
  | { kind: "word"; lead: string; core: string; trail: string }
  | { kind: "blank"; old: number };

export type BuildTok = Tok | { kind: "new"; label: string };

const EDGE = /^([\p{P}\p{S}]*)(.*?)([\p{P}\p{S}]*)$/u;

export function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const part of text.split(/(\[\[\d+\]\])/g)) {
    if (!part) continue;
    const b = part.match(BLANK_ONE);
    if (b) {
      out.push({ kind: "blank", old: Number(b[1]) });
      continue;
    }
    for (const piece of part.split(/(\s+)/g)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        out.push({ kind: "space", text: piece });
        continue;
      }
      const m = piece.match(EDGE);
      if (!m || !m[2]) out.push({ kind: "space", text: piece });
      else out.push({ kind: "word", lead: m[1]!, core: m[2], trail: m[3]! });
    }
  }
  return out;
}

/** Ghép lại câu và đánh số lại các ô theo thứ tự xuất hiện, chuyển đáp án theo số mới. */
export function rebuild(
  tokens: BuildTok[],
  answers: Map<number, Token>,
  distractors: Token[],
): { prompt: string; options: Token[] } {
  let n = 0;
  let prompt = "";
  const next = new Map<number, Token>();
  for (const t of tokens) {
    if (t.kind === "space") prompt += t.text;
    else if (t.kind === "word") prompt += t.lead + t.core + t.trail;
    else if (t.kind === "blank") {
      n += 1;
      prompt += `[[${n}]]`;
      next.set(n, mk(answers.get(t.old)?.label ?? "", n));
    } else {
      n += 1;
      prompt += `[[${n}]]`;
      next.set(n, mk(t.label, n));
    }
  }
  const blanks = Array.from({ length: n }, (_, i) => i + 1);
  return { prompt, options: compose(blanks, next, distractors) };
}


const HAS_BREAK = /\n/;

/**
 * Bấm vào từ ở vị trí `idx`. Nếu từ đó kề sát một ô trống (chỉ cách nhau khoảng
 * trắng trên cùng dòng) thì gộp vào ô đó — để ẩn được cụm nhiều từ ("11 cầu
 * thủ"); ngược lại tạo ô trống mới từ chính từ đó. Ưu tiên ô đứng trước.
 */
export function blankifyAt(
  tokens: Tok[],
  idx: number,
  answers: Map<number, Token>,
  distractors: Token[],
): { prompt: string; options: Token[] } | null {
  const t = tokens[idx];
  if (!t || t.kind !== "word") return null;

  const neighbour = (dir: -1 | 1): number | null => {
    let j = idx + dir;
    if (tokens[j]?.kind === "space") {
      const sp = tokens[j] as { kind: "space"; text: string };
      if (HAS_BREAK.test(sp.text)) return null;
      j += dir;
    } else if (dir === -1 ? t.lead : false) {
      return null;
    }
    return tokens[j]?.kind === "blank" ? j : null;
  };

  // Dấu câu dính đầu/cuối từ chắn giữa từ và ô trống thì không gộp.
  const left = t.lead ? null : neighbour(-1);
  const right = t.trail ? null : neighbour(1);
  const target = left ?? right;

  if (target !== null) {
    const b = tokens[target] as { kind: "blank"; old: number };
    const cur = answers.get(b.old)?.label ?? "";
    const label = target < idx ? `${cur} ${t.core}`.trim() : `${t.core} ${cur}`.trim();
    const merged = new Map(answers);
    merged.set(b.old, mk(label, b.old));
    const kept: BuildTok[] = [];
    tokens.forEach((x, i) => {
      if (i === idx) {
        if (t.lead) kept.push({ kind: "space", text: t.lead });
        if (t.trail) kept.push({ kind: "space", text: t.trail });
        return;
      }
      // Bỏ khoảng trắng nằm giữa từ vừa gộp và ô.
      const between =
        (target < idx && i > target && i < idx) || (target > idx && i > idx && i < target);
      if (between && x.kind === "space") return;
      kept.push(x);
    });
    return rebuild(kept, merged, distractors);
  }

  return rebuild(
    tokens.flatMap((x, i): BuildTok[] =>
      i === idx
        ? [
            ...(t.lead ? [{ kind: "space" as const, text: t.lead }] : []),
            { kind: "new" as const, label: t.core },
            ...(t.trail ? [{ kind: "space" as const, text: t.trail }] : []),
          ]
        : [x],
    ),
    answers,
    distractors,
  );
}
