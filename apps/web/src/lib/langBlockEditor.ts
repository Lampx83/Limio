import { newBlockItemId } from "@/lib/langBlocks";
import { validateMarks } from "@/lib/dialogueTiming";

/**
 * LANG G2 — state của form soạn từ vựng/hội thoại và chuyển đổi hai chiều với
 * payload. Trong form mọi trường là chuỗi (rỗng = không điền); khi lưu, chuỗi
 * rỗng bị bỏ để payload gọn. `id` đi nguyên qua form — đó là cách các lần sửa
 * giữ được id ổn định cho flashcard (G4).
 */

export interface VocabEditorItem {
  id: string;
  term: string;
  reading: string;
  meaning: string;
  example: string;
  exampleReading: string;
  exampleMeaning: string;
  note: string;
  audioUrl: string;
}
export interface VocabEditorValue {
  title: string;
  readingLabel: string;
  items: VocabEditorItem[];
}

export interface TurnEditorItem {
  id: string;
  speaker: string;
  text: string;
  reading: string;
  translation: string;
  audioUrl: string;
  /** K2 — mốc bắt đầu của lượt trong audio cả đoạn (giây); thiếu = chưa có mốc. */
  startSec?: number;
}
export interface DialogueEditorValue {
  title: string;
  caption: string;
  readingLabel: string;
  audioUrl: string;
  turns: TurnEditorItem[];
}

export const emptyVocabItem = (): VocabEditorItem => ({
  id: newBlockItemId(),
  term: "",
  reading: "",
  meaning: "",
  example: "",
  exampleReading: "",
  exampleMeaning: "",
  note: "",
  audioUrl: "",
});

export const emptyTurn = (): TurnEditorItem => ({
  id: newBlockItemId(),
  speaker: "",
  text: "",
  reading: "",
  translation: "",
  audioUrl: "",
});

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const s = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(rec) : []);
/** Chỉ gắn trường khi có nội dung. */
const put = (o: Record<string, unknown>, k: string, v: string) => {
  if (v.trim() !== "") o[k] = v.trim();
};

export function vocabEditorFromPayload(payload: unknown): VocabEditorValue {
  const p = rec(payload);
  const items: VocabEditorItem[] = list(p.items).map((it) => ({
    id: s(it.id) || newBlockItemId(),
    term: s(it.term),
    reading: s(it.reading),
    meaning: s(it.meaning),
    example: s(it.example),
    exampleReading: s(it.exampleReading),
    exampleMeaning: s(it.exampleMeaning),
    note: s(it.note),
    audioUrl: s(it.audioUrl),
  }));
  return {
    title: s(p.title),
    readingLabel: s(p.readingLabel),
    items: items.length ? items : [emptyVocabItem()],
  };
}

const vocabRowBlank = (i: VocabEditorItem) =>
  [i.term, i.reading, i.meaning, i.example, i.exampleReading, i.exampleMeaning, i.note, i.audioUrl].every(
    (x) => x.trim() === "",
  );

export function vocabPayloadFromEditor(v: VocabEditorValue) {
  const out: Record<string, unknown> & { items: Array<Record<string, unknown>> } = { items: [] };
  put(out, "title", v.title);
  put(out, "readingLabel", v.readingLabel);
  for (const i of v.items) {
    if (vocabRowBlank(i)) continue;
    const row: Record<string, unknown> = { id: i.id };
    put(row, "term", i.term);
    put(row, "reading", i.reading);
    put(row, "meaning", i.meaning);
    put(row, "example", i.example);
    put(row, "exampleReading", i.exampleReading);
    put(row, "exampleMeaning", i.exampleMeaning);
    put(row, "note", i.note);
    put(row, "audioUrl", i.audioUrl);
    out.items.push(row);
  }
  return out;
}

/** Danh sách lỗi (tiếng Việt, kèm số thứ tự dòng) trước khi gửi lên server. */
export function validateVocabEditor(v: VocabEditorValue): string[] {
  const errors: string[] = [];
  let filled = 0;
  v.items.forEach((i, idx) => {
    if (vocabRowBlank(i)) return;
    const hasTerm = i.term.trim() !== "";
    const hasMeaning = i.meaning.trim() !== "";
    if (hasTerm && hasMeaning) filled++;
    else if (!hasTerm) errors.push(`Dòng ${idx + 1} thiếu từ.`);
    else errors.push(`Dòng ${idx + 1} thiếu nghĩa.`);
  });
  if (filled === 0 && errors.length === 0) errors.push("Cần ít nhất 1 từ có đủ từ và nghĩa.");
  return errors;
}

export function dialogueEditorFromPayload(payload: unknown): DialogueEditorValue {
  const p = rec(payload);
  const turns: TurnEditorItem[] = list(p.turns).map((t) => ({
    id: s(t.id) || newBlockItemId(),
    speaker: s(t.speaker),
    text: s(t.text),
    reading: s(t.reading),
    translation: s(t.translation),
    audioUrl: s(t.audioUrl),
    ...(typeof t.startSec === "number" && Number.isFinite(t.startSec) ? { startSec: t.startSec } : {}),
  }));
  return {
    title: s(p.title),
    caption: s(p.caption),
    readingLabel: s(p.readingLabel),
    audioUrl: s(p.audioUrl),
    turns: turns.length ? turns : [emptyTurn()],
  };
}

const turnBlank = (t: TurnEditorItem) =>
  [t.speaker, t.text, t.reading, t.translation, t.audioUrl].every((x) => x.trim() === "");

export function dialoguePayloadFromEditor(v: DialogueEditorValue) {
  const out: Record<string, unknown> & { turns: Array<Record<string, unknown>> } = { turns: [] };
  put(out, "title", v.title);
  put(out, "caption", v.caption);
  put(out, "readingLabel", v.readingLabel);
  put(out, "audioUrl", v.audioUrl);
  for (const t of v.turns) {
    if (turnBlank(t)) continue;
    const row: Record<string, unknown> = { id: t.id };
    put(row, "speaker", t.speaker);
    put(row, "text", t.text);
    put(row, "reading", t.reading);
    put(row, "translation", t.translation);
    put(row, "audioUrl", t.audioUrl);
    if (t.startSec !== undefined) row.startSec = t.startSec;
    out.turns.push(row);
  }
  return out;
}

export function validateDialogueEditor(v: DialogueEditorValue): string[] {
  const errors: string[] = [];
  let filled = 0;
  v.turns.forEach((t, idx) => {
    if (turnBlank(t)) return;
    const hasSpeaker = t.speaker.trim() !== "";
    const hasText = t.text.trim() !== "";
    if (hasSpeaker && hasText) filled++;
    else if (!hasSpeaker) errors.push(`Lượt ${idx + 1} thiếu người nói.`);
    else errors.push(`Lượt ${idx + 1} thiếu lời thoại.`);
  });
  if (filled === 0 && errors.length === 0) errors.push("Cần ít nhất 1 lượt có đủ người nói và lời thoại.");
  // K2 — mốc phải tăng dần theo thứ tự lượt (chỉ tính lượt có nội dung, đúng thứ tự sẽ lưu).
  errors.push(...validateMarks(v.turns.filter((t) => !turnBlank(t))));
  return errors;
}

/** Đổi chỗ phần tử `index` với láng giềng (delta -1 lên, +1 xuống). Trả mảng mới. */
export function moveItem<T>(arr: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= arr.length) return [...arr];
  const next = [...arr];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}

/**
 * Gợi ý người nói cho lượt kế tiếp, để gõ hội thoại liền tay: A → B → A…
 * Từ hai người nói trở lên thì đi vòng tròn theo thứ tự xuất hiện; chỉ có một người và
 * đó là một chữ cái (A–Y) thì gợi ý chữ kế tiếp; còn lại để trống cho giảng viên tự điền.
 */
export function nextSpeaker(turns: ReadonlyArray<{ speaker: string; text?: string }>): string {
  const filled = turns
    .map((t) => ({ speaker: t.speaker.trim(), text: (t.text ?? "").trim() }))
    .filter((t) => t.speaker !== "" || t.text !== "");
  const order: string[] = [];
  for (const t of filled) if (t.speaker && !order.includes(t.speaker)) order.push(t.speaker);
  if (order.length === 0) return "";
  if (order.length === 1) {
    const only = order[0]!;
    return /^[A-Y]$/.test(only) ? String.fromCharCode(only.charCodeAt(0) + 1) : "";
  }
  const last = [...filled].reverse().find((t) => t.speaker)?.speaker ?? order[0]!;
  return order[(order.indexOf(last) + 1) % order.length]!;
}
