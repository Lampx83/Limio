/**
 * Từ vựng của bài HSK do tác giả soạn (khối `vocab_list`): `meaning` có dạng "từ loại · nghĩa tiếng Việt" ("đg. · thuê (nhà, xe…)") và `note` mở đầu bằng
 * "Từ chủ động." hoặc "Từ nhận biết." rồi tới lưu ý. Tách hai phần đó ra để thẻ có nhãn từ loại và viên thuốc "Từ chủ động"/"Từ nhận biết".
 * Thẻ cũ (nghĩa không có từ loại, ghi chú không có nhãn) tách ra không đổi gì: hiện như trước.
 */

import { alignReading, hanTokens } from "./rolePlayView";

/** Từ loại viết tắt kết thúc bằng dấu chấm ("đg.", "d.", "lg.", "tt.", "đg./d."). Đoạn đầu không đúng khuôn này (vd. pinyin "zū") không phải từ loại. */
const POS_RE = /^[\p{L}]{1,6}\.(?:\s?[/,]\s?[\p{L}]{1,6}\.)*$/u;
const TAG_RE = /^(Từ chủ động|Từ nhận biết)\.?\s*/i;

export function splitVocabMeaning(meaning: string): { pos: string | null; meaning: string } {
  const i = meaning.indexOf(" · ");
  if (i > 0) {
    const head = meaning.slice(0, i).trim();
    if (POS_RE.test(head)) return { pos: head, meaning: meaning.slice(i + 3).trim() };
  }
  return { pos: null, meaning };
}

export function splitVocabNote(note: string | undefined): { tag: string | null; active: boolean; note: string | null } {
  const raw = (note ?? "").trim();
  if (!raw) return { tag: null, active: false, note: null };
  const m = TAG_RE.exec(raw);
  if (!m) return { tag: null, active: false, note: raw };
  const rest = raw.slice(m[0].length).trim();
  const tag = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
  return { tag, active: /chủ động/i.test(m[1]!), note: rest || null };
}

/** Nhãn ngắn của viên thuốc "Từ chủ động"/"Từ nhận biết" trên thẻ lưới: "Chủ động" / "Nhận biết" (thẻ nhỏ, bỏ chữ "Từ"). */
export function shortVocabTag(tag: string | null): string | null {
  return tag ? tag.replace(/^Từ\s+/i, "").replace(/^./, (c) => c.toUpperCase()) : null;
}

/** Một đơn vị của chữ Hán trên thẻ: chữ Hán kèm âm tiết (hiện pinyin dưới chữ) hoặc chữ/dấu câu thường (không pinyin). */
export interface VocabHanPiece {
  text: string;
  rt?: string;
}

/**
 * Chữ Hán của thẻ từ mới kèm pinyin chia theo từng âm tiết. `reading` ghép đủ số chữ Hán thì mỗi chữ mang một âm tiết (`pieces`, pinyin hiện dưới chữ);
 * không ghép chắc được (thiếu/thừa âm tiết, từ có chữ Latin) hoặc không có pinyin thì `pieces` rỗng và `reading` giữ nguyên để hiện một dòng nhỏ dưới từ.
 */
export function vocabHanPieces(term: string, reading: string | undefined): { pieces: VocabHanPiece[]; reading: string | null } {
  const r = (reading ?? "").trim();
  const syl = r ? alignReading(term, r) : null;
  if (!syl) return { pieces: [], reading: r || null };
  let k = 0;
  const pieces: VocabHanPiece[] = [];
  for (const t of hanTokens(term)) {
    if (t.scored) pieces.push({ text: t.text, rt: syl[k++] });
    else pieces.push({ text: t.text + (t.sep ? " " : "") });
  }
  return { pieces, reading: null };
}

/** Từ có chữ Hán (mới mở được "Cách viết"). */
export function hasHanChars(term: string): boolean {
  return /[㐀-䶿一-鿿]/.test(term);
}

/** Thẻ lỗi (thiếu từ, từ không phải chuỗi, nghĩa thiếu) thì bỏ hoặc sửa, không làm vỡ cả mục từ mới. */
export function cleanVocabItems<T extends { id?: string; term?: unknown; meaning?: unknown }>(items: unknown): Array<T & { id: string; term: string; meaning: string }> {
  if (!Array.isArray(items)) return [];
  const out: Array<T & { id: string; term: string; meaning: string }> = [];
  items.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const it = raw as T;
    const term = typeof it.term === "string" ? it.term.trim() : "";
    if (!term) return;
    out.push({ ...it, id: typeof it.id === "string" && it.id ? it.id : `v${i}`, term, meaning: typeof it.meaning === "string" ? it.meaning : "" });
  });
  return out;
}
