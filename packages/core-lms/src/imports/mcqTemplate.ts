import * as XLSX from "xlsx";

/**
 * Unified MCQ import template — one xlsx works for Quiz, Question Bank, Exam,
 * (Tournament reuses Quiz path). Parser is pure (no DB), returns rows with
 * per-row validation status so the UI can preview before commit.
 *
 * Header columns (case-insensitive, accept common variants):
 *   Required:
 *     Prompt           — câu hỏi (text, multi-line OK)
 *     OptionA..F       — đáp án A–F (text); cần ≥2 không rỗng
 *     Correct          — "A" cho 1 đáp án, "A,C" cho nhiều đáp án
 *   Optional:
 *     Type             — "mcq" (default) | "true_false"
 *     Points           — default 1
 *     Difficulty       — 1–5 default 3 (Bank only)
 *     Explanation      — giải thích sau khi học viên trả lời
 *     CognitiveLevel   — remember_understand|apply|analyze_plus (Bank only)
 *
 * MisconceptionA-F + SkillCodes intentionally excluded from MVP — instructor
 * adds via UI after import.
 */

export type McqRowStatus = "ok" | "warning" | "error";

export interface ParsedMcqRow {
  /** 1-based row number in the spreadsheet (excludes header). */
  rowNumber: number;
  status: McqRowStatus;
  errors: string[];
  warnings: string[];
  /** Populated when status != "error" — ready for committer. */
  parsed?: {
    type: "mcq" | "true_false";
    prompt: string;
    /** Options in spreadsheet order; only non-empty rows. */
    options: Array<{ letter: string; label: string; isCorrect: boolean }>;
    points: number;
    difficulty: 1 | 2 | 3 | 4 | 5;
    cognitiveLevel: "remember_understand" | "apply" | "analyze_plus";
    explanation: string | null;
    /**
     * Free-text topic / chủ đề. Stored in question's metadata so instructor
     * có thể filter/group sau. Không validate giá trị — bất kỳ string nào
     * cũng accept (vd "Địa lý", "Toán học", "Chương 3").
     */
    topic: string | null;
    /**
     * Metadata mở rộng — tất cả optional. Committer sẽ map vào field cùng
     * tên trên BankQuestion (xem packages/db/schema.prisma).
     */
    code: string | null;
    learningOutcome: string | null;
    authorName: string | null;
    reviewStatus: "pending" | "approved" | "needs_revision" | null;
    editNote: string | null;
  };
}

export interface ParseMcqResult {
  rows: ParsedMcqRow[];
  summary: { ok: number; warning: number; error: number; total: number };
}

const HEADER_ALIASES: Record<string, string> = {
  prompt: "Prompt",
  type: "Type",
  optiona: "OptionA",
  optionb: "OptionB",
  optionc: "OptionC",
  optiond: "OptionD",
  optione: "OptionE",
  optionf: "OptionF",
  correct: "Correct",
  points: "Points",
  difficulty: "Difficulty",
  explanation: "Explanation",
  cognitivelevel: "CognitiveLevel",
  topic: "Topic",
  // Metadata mở rộng — siêu dữ liệu cho ngân hàng:
  code: "Code",
  learningoutcome: "LearningOutcome",
  cdr: "LearningOutcome",
  "chuẩn đầu ra": "LearningOutcome",
  "chuan dau ra": "LearningOutcome",
  author: "AuthorName",
  authorname: "AuthorName",
  "tác giả": "AuthorName",
  "tac gia": "AuthorName",
  reviewstatus: "ReviewStatus",
  "trạng thái thẩm định": "ReviewStatus",
  "trang thai tham dinh": "ReviewStatus",
  editnote: "EditNote",
  "ghi chú sửa": "EditNote",
  "ghi chu sua": "EditNote",
  // Common variants instructors type:
  "mã": "Code",
  "ma": "Code",
  "mã câu hỏi": "Code",
  "ma cau hoi": "Code",
  "câu hỏi": "Prompt",
  "đáp án": "Correct",
  "điểm": "Points",
  "độ khó": "Difficulty",
  "giải thích": "Explanation",
  "chủ đề": "Topic",
  "chu de": "Topic",
};

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const MAX_ROWS = 500;

export function parseMcqImportXlsx(
  buf: Buffer | ArrayBuffer | Uint8Array,
): ParseMcqResult {
  const wb = XLSX.read(buf, { type: "buffer" });
  // Pick first sheet (or one matching /question|câu/i).
  const sheetName =
    wb.SheetNames.find((n) => /question|câu/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], summary: { ok: 0, warning: 0, error: 0, total: 0 } };
  }
  const sheet = wb.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const normalized = rawRows.slice(0, MAX_ROWS).map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = HEADER_ALIASES[k.trim().toLowerCase()] ?? k.trim();
      out[key] = typeof v === "string" ? v.trim() : String(v ?? "").trim();
    }
    return out;
  });

  const rows: ParsedMcqRow[] = normalized.map((r, i) =>
    parseOneRow(r, i + 1),
  );

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  return { rows, summary };
}

function parseOneRow(raw: Record<string, string>, rowNumber: number): ParsedMcqRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const prompt = raw.Prompt ?? "";
  if (!prompt) errors.push("Thiếu cột Prompt (câu hỏi)");

  // Type default mcq. true_false auto-fills options A/B Đúng/Sai when blank.
  const rawType = (raw.Type ?? "").toLowerCase();
  let type: "mcq" | "true_false";
  if (!rawType || rawType === "mcq" || rawType === "multi") {
    type = "mcq";
    if (rawType === "multi") {
      warnings.push("Type=multi xử lý như mcq nhiều đáp án — dùng Correct=A,C");
    }
  } else if (
    rawType === "true_false" ||
    rawType === "tf" ||
    rawType === "đúng/sai"
  ) {
    type = "true_false";
  } else {
    errors.push(`Type="${rawType}" không hỗ trợ. Dùng mcq hoặc true_false`);
    type = "mcq";
  }

  // Gather options A-F. Auto-fill Đúng/Sai for true_false if blank.
  let optionRaw: Array<{ letter: string; label: string }> = OPTION_LETTERS.map(
    (L) => ({ letter: L, label: raw[`Option${L}`] ?? "" }),
  ).filter((o) => o.label !== "");
  if (type === "true_false" && optionRaw.length === 0) {
    optionRaw = [
      { letter: "A", label: "Đúng" },
      { letter: "B", label: "Sai" },
    ];
  }
  if (optionRaw.length < 2) {
    errors.push(`Cần ≥2 đáp án không rỗng (OptionA, OptionB, …)`);
  }

  // Correct: "A" or "A,C" or "A;C". Validate each letter exists in options.
  const correctRaw = (raw.Correct ?? "").toUpperCase();
  const correctLetters = correctRaw
    .split(/[,;\s/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (correctLetters.length === 0) {
    errors.push("Thiếu cột Correct (đáp án đúng)");
  }
  for (const L of correctLetters) {
    if (!optionRaw.some((o) => o.letter === L)) {
      errors.push(`Correct="${L}" nhưng Option${L} rỗng/không tồn tại`);
    }
  }
  if (type === "true_false" && correctLetters.length !== 1) {
    errors.push("Đúng/Sai chỉ được chọn 1 đáp án trong Correct");
  }

  const options = optionRaw.map((o) => ({
    letter: o.letter,
    label: o.label,
    isCorrect: correctLetters.includes(o.letter),
  }));

  // Numerics with sensible defaults.
  const points = parsePositiveInt(raw.Points, 1, 1, 100);
  if (raw.Points && points === null) {
    warnings.push(`Points="${raw.Points}" không hợp lệ, dùng 1`);
  }
  const difficulty = parsePositiveInt(raw.Difficulty, 3, 1, 5) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  if (raw.Difficulty && difficulty === null) {
    warnings.push(`Difficulty="${raw.Difficulty}" không hợp lệ (1–5), dùng 3`);
  }

  const cognitiveLevelRaw = (raw.CognitiveLevel ?? "").toLowerCase();
  let cognitiveLevel: "remember_understand" | "apply" | "analyze_plus" = "apply";
  if (
    cognitiveLevelRaw === "remember_understand" ||
    cognitiveLevelRaw === "nhớ" ||
    cognitiveLevelRaw === "hiểu" ||
    cognitiveLevelRaw === "remember"
  ) {
    cognitiveLevel = "remember_understand";
  } else if (
    cognitiveLevelRaw === "apply" ||
    cognitiveLevelRaw === "vận dụng" ||
    cognitiveLevelRaw === ""
  ) {
    cognitiveLevel = "apply";
  } else if (
    cognitiveLevelRaw === "analyze_plus" ||
    cognitiveLevelRaw === "analyze" ||
    cognitiveLevelRaw === "phân tích"
  ) {
    cognitiveLevel = "analyze_plus";
  } else {
    warnings.push(`CognitiveLevel="${cognitiveLevelRaw}" không hỗ trợ, dùng apply`);
  }

  const explanation = raw.Explanation || null;
  const topic = raw.Topic || null;

  // Metadata mở rộng — tất cả optional.
  const code = (raw.Code ?? "").trim() || null;
  const learningOutcome = (raw.LearningOutcome ?? "").trim() || null;
  const authorName = (raw.AuthorName ?? "").trim() || null;
  const editNote = (raw.EditNote ?? "").trim() || null;
  let reviewStatus: "pending" | "approved" | "needs_revision" | null = null;
  const rawReview = (raw.ReviewStatus ?? "").trim().toLowerCase();
  if (rawReview) {
    if (
      rawReview === "approved" ||
      rawReview === "đã duyệt" ||
      rawReview === "da duyet" ||
      rawReview === "đã thẩm định"
    ) {
      reviewStatus = "approved";
    } else if (
      rawReview === "needs_revision" ||
      rawReview === "cần sửa" ||
      rawReview === "can sua" ||
      rawReview === "rớt" ||
      rawReview === "rot"
    ) {
      reviewStatus = "needs_revision";
    } else if (
      rawReview === "pending" ||
      rawReview === "chưa thẩm định" ||
      rawReview === "chua tham dinh" ||
      rawReview === "chưa duyệt"
    ) {
      reviewStatus = "pending";
    } else {
      warnings.push(
        `ReviewStatus="${rawReview}" không hợp lệ (pending/approved/needs_revision), giữ trống`,
      );
    }
  }

  const status: McqRowStatus =
    errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";

  return {
    rowNumber,
    status,
    errors,
    warnings,
    parsed:
      status === "error"
        ? undefined
        : {
            type,
            prompt,
            options,
            points: points ?? 1,
            difficulty: (difficulty ?? 3) as 1 | 2 | 3 | 4 | 5,
            cognitiveLevel,
            explanation,
            topic,
            code,
            learningOutcome,
            authorName,
            reviewStatus,
            editNote,
          },
  };
}

function parsePositiveInt(
  raw: string | undefined,
  defaultVal: number,
  min: number,
  max: number,
): number | null {
  if (!raw) return defaultVal;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max)
    return null;
  return n;
}

/**
 * Generate the MCQ template .xlsx as a Buffer. Pre-fills 2 example rows so
 * instructor sees the expected format. Header row uses canonical column names.
 */
export function generateMcqTemplateXlsx(): Buffer {
  const headers = [
    "Code",
    "Topic",
    "LearningOutcome",
    "Prompt",
    "Type",
    "OptionA",
    "OptionB",
    "OptionC",
    "OptionD",
    "OptionE",
    "OptionF",
    "Correct",
    "Points",
    "Difficulty",
    "CognitiveLevel",
    "Explanation",
    "AuthorName",
    "ReviewStatus",
    "EditNote",
  ];
  const sample: (string | number)[][] = [
    headers,
    [
      "VN-0001",
      "Địa lý",
      "Học viên nhớ được thủ đô Việt Nam",
      "Thủ đô của Việt Nam là gì?",
      "mcq",
      "Hà Nội",
      "TP. Hồ Chí Minh",
      "Đà Nẵng",
      "Huế",
      "",
      "",
      "A",
      1,
      2,
      "remember_understand",
      "Hà Nội là thủ đô từ 1945.",
      "Cô Lan",
      "approved",
      "",
    ],
    [
      "TOAN-0001",
      "Toán học",
      "Vận dụng quy tắc chia hết cho 3",
      "Chọn các số chia hết cho 3 (chọn nhiều):",
      "mcq",
      "9",
      "10",
      "12",
      "14",
      "15",
      "",
      "A,C,E",
      2,
      3,
      "apply",
      "Một số chia hết cho 3 khi tổng các chữ số chia hết cho 3.",
      "Thầy Minh",
      "pending",
      "Đã sửa typo 2026-05-20",
    ],
    [
      "",
      "Khoa học tự nhiên",
      "",
      "Trái đất quay quanh Mặt trời.",
      "true_false",
      "",
      "",
      "",
      "",
      "",
      "",
      "A",
      1,
      1,
      "remember_understand",
      "Sự thật cơ bản trong thiên văn học.",
      "",
      "",
      "",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  // Column widths — wide for text, narrow for code/letter/numeric.
  ws["!cols"] = [
    { wch: 12 }, // Code
    { wch: 18 }, // Topic
    { wch: 35 }, // LearningOutcome
    { wch: 40 }, // Prompt
    { wch: 10 }, // Type
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 }, // OptionA–F
    { wch: 10 }, // Correct
    { wch: 8 }, // Points
    { wch: 10 }, // Difficulty
    { wch: 20 }, // CognitiveLevel
    { wch: 40 }, // Explanation
    { wch: 15 }, // AuthorName
    { wch: 14 }, // ReviewStatus
    { wch: 30 }, // EditNote
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
