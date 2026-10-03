/**
 * LANG G2 — hàm thuần cho khối từ vựng (`vocab_list`) và hội thoại (`dialogue`):
 * phân tích bảng dán vào, nhận biết từ trùng, tóm tắt cho dòng danh sách và bản
 * chữ cho trang in. Giới hạn khớp schema ở packages/core-lms (contentSchemas.ts):
 * dòng nào qua được đây mà bị schema từ chối là lỗi, nên giữ hai bên đồng bộ.
 */

export const VOCAB_MAX_ROWS = 300;
export const DIALOGUE_MAX_TURNS = 100;

const LIMIT = { term: 200, reading: 200, meaning: 500, example: 1000, speaker: 40, text: 1000 } as const;

export interface PasteError {
  /** Số dòng (từ 1) trong văn bản người dùng dán, tính cả dòng trống. */
  line: number;
  reason: string;
  raw: string;
}

export interface VocabDraft {
  term: string;
  reading?: string;
  meaning: string;
  example?: string;
}

export interface DialogueDraft {
  speaker: string;
  text: string;
}

const lines = (text: string) => text.replace(/\r\n?/g, "\n").split("\n");

/**
 * Dán từ Excel/Google Sheets (cột cách nhau bằng tab) hoặc gõ tay `a | b | c`.
 * Có tab ở bất kỳ dòng nào thì tab thắng và dấu `|` là chữ bình thường.
 * 2 cột = từ · nghĩa; 3 = từ · phiên âm · nghĩa; 4 = thêm ví dụ.
 * Dòng lỗi được báo theo số dòng và không chặn các dòng đúng.
 */
export function parseVocabPaste(text: string): { items: VocabDraft[]; errors: PasteError[] } {
  const items: VocabDraft[] = [];
  const errors: PasteError[] = [];
  const delimiter = text.includes("\t") ? "\t" : "|";

  lines(text).forEach((raw, i) => {
    if (raw.trim() === "") return;
    const line = i + 1;
    const fail = (reason: string) => errors.push({ line, reason, raw });

    const cells = raw.split(delimiter).map((c) => c.trim());
    if (cells.length < 2) return fail("Cần ít nhất 2 cột: từ và nghĩa.");
    if (cells.length > 4) return fail("Tối đa 4 cột: từ · phiên âm · nghĩa · ví dụ.");

    const [term, reading, meaning, example] =
      cells.length === 2
        ? [cells[0]!, "", cells[1]!, ""]
        : cells.length === 3
          ? [cells[0]!, cells[1]!, cells[2]!, ""]
          : [cells[0]!, cells[1]!, cells[2]!, cells[3]!];

    if (!term) return fail("Thiếu từ.");
    if (!meaning) return fail("Thiếu nghĩa.");
    if (term.length > LIMIT.term) return fail(`Từ quá dài (tối đa ${LIMIT.term} ký tự).`);
    if (reading.length > LIMIT.reading) return fail(`Phiên âm quá dài (tối đa ${LIMIT.reading} ký tự).`);
    if (meaning.length > LIMIT.meaning) return fail(`Nghĩa quá dài (tối đa ${LIMIT.meaning} ký tự).`);
    if (example.length > LIMIT.example) return fail(`Ví dụ quá dài (tối đa ${LIMIT.example} ký tự).`);
    if (items.length >= VOCAB_MAX_ROWS) return fail(`Vượt ${VOCAB_MAX_ROWS} dòng cho một khối.`);

    items.push({
      term,
      ...(reading ? { reading } : {}),
      meaning,
      ...(example ? { example } : {}),
    });
  });

  return { items, errors };
}

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

/**
 * Tách dòng sắp thêm thành "mới" và "trùng" (so theo từ: bỏ khác biệt hoa-thường,
 * khoảng trắng và dạng Unicode). Dòng sau trùng dòng trước trong cùng lượt dán
 * cũng tính là trùng. Giao diện hỏi lại giảng viên trước khi thêm dòng trùng.
 */
export function splitDuplicateTerms<T extends { term: string }>(
  existing: ReadonlyArray<{ term: string }>,
  incoming: ReadonlyArray<T>,
): { fresh: T[]; duplicates: T[] } {
  const seen = new Set(existing.map((e) => norm(e.term)));
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const it of incoming) {
    const key = norm(it.term);
    if (seen.has(key)) duplicates.push(it);
    else {
      seen.add(key);
      fresh.push(it);
    }
  }
  return { fresh, duplicates };
}

/**
 * Mỗi dòng `Người nói：lời` (dấu hai chấm toàn góc `：` hoặc `:`). Chỉ tách ở dấu
 * hai chấm ĐẦU TIÊN, nên lời có "10:30" vẫn nguyên.
 */
export function parseDialoguePaste(text: string): { turns: DialogueDraft[]; errors: PasteError[] } {
  const turns: DialogueDraft[] = [];
  const errors: PasteError[] = [];

  lines(text).forEach((raw, i) => {
    if (raw.trim() === "") return;
    const line = i + 1;
    const fail = (reason: string) => errors.push({ line, reason, raw });

    const positions = [raw.indexOf("："), raw.indexOf(":")].filter((p) => p >= 0);
    if (positions.length === 0) return fail("Thiếu người nói. Viết dạng “A：lời thoại”.");
    const cut = Math.min(...positions);
    const speaker = raw.slice(0, cut).trim();
    const body = raw.slice(cut + 1).trim();

    if (!speaker) return fail("Thiếu người nói trước dấu hai chấm.");
    if (!body) return fail("Thiếu lời thoại sau dấu hai chấm.");
    if (speaker.length > LIMIT.speaker) return fail(`Tên người nói quá dài (tối đa ${LIMIT.speaker} ký tự).`);
    if (body.length > LIMIT.text) return fail(`Lời quá dài (tối đa ${LIMIT.text} ký tự).`);
    if (turns.length >= DIALOGUE_MAX_TURNS) return fail(`Vượt ${DIALOGUE_MAX_TURNS} lượt cho một khối.`);

    turns.push({ speaker, text: body });
  });

  return { turns, errors };
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? v.map(asRecord) : [];
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "12 từ" / "8 lượt" cho dòng trong danh sách nội dung; null với loại khác. */
export function blockSummary(type: string, payload: unknown): string | null {
  const p = asRecord(payload);
  if (type === "vocab_list") return `${asArray(p.items).length} từ`;
  if (type === "dialogue") return `${asArray(p.turns).length} lượt`;
  return null;
}

/** Bản chữ cho trang in: không nút, không audio. Loại khác hoặc payload hỏng → []. */
export function blockToPlainLines(type: string, payload: unknown): string[] {
  const p = asRecord(payload);
  const out: string[] = [];
  if (str(p.title)) out.push(str(p.title));

  if (type === "vocab_list") {
    for (const it of asArray(p.items)) {
      const reading = str(it.reading);
      out.push(`${str(it.term)}${reading ? ` (${reading})` : ""} — ${str(it.meaning)}`);
      const ex = [str(it.example), str(it.exampleReading), str(it.exampleMeaning)].filter(Boolean).join(" · ");
      if (ex) out.push(`  ${ex}`);
      if (str(it.note)) out.push(`  Ghi chú: ${str(it.note)}`);
    }
    return asArray(p.items).length ? out : [];
  }

  if (type === "dialogue") {
    for (const t of asArray(p.turns)) {
      out.push(`${str(t.speaker)}: ${str(t.text)}`);
      if (str(t.reading)) out.push(`  ${str(t.reading)}`);
      if (str(t.translation)) out.push(`  ${str(t.translation)}`);
    }
    return asArray(p.turns).length ? out : [];
  }

  return [];
}

/** Id cho dòng/lượt mới thêm trong form (server cũng gán nếu thiếu). */
export function newBlockItemId(): string {
  return globalThis.crypto.randomUUID();
}
