import * as XLSX from "xlsx";
import { configSchemaForType } from "./schemas";

/**
 * Parse an Excel buffer into per-row exam question candidates with validation
 * status. Pure — no DB; caller supplies known passages + skills for matching.
 */

export interface ImportContext {
  /** Passages already on the exam — used to match `PassageTitle` column. */
  existingPassages: Array<{ id: string; title: string }>;
  /** Skill `code`s known in the system (or course) — used to validate `SkillCodes`. */
  existingSkillCodes: Set<string>;
  /** Resolve skill code → id for confirm step. Optional at preview stage. */
  skillIdByCode?: Map<string, string>;
}

export type ImportRowStatus = "ok" | "warning" | "error";

export interface ParsedQuestionRow {
  /** 1-based row number in the spreadsheet (excludes header). */
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  /** Populated when status != "error" — ready for DB insert. */
  parsed?: {
    type:
      | "mcq"
      | "multi"
      | "true_false_notgiven"
      | "gap_fill"
      | "short_answer"
      | "essay";
    prompt: string;
    passageId: string | null;
    /** PassageTitle as written; useful for UI display. */
    passageTitleRaw: string;
    points: number;
    difficulty: 1 | 2 | 3;
    config: unknown;
    skillIds: string[];
    /** Skill codes that didn't resolve — surfaced as warnings. */
    unresolvedSkillCodes: string[];
    notes: string | null;
  };
}

export interface ParseResult {
  rows: ParsedQuestionRow[];
  summary: { ok: number; warning: number; error: number; total: number };
}

const P0_TYPES = new Set([
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
]);

/** Canonical lowercase header → field key. Accepts variants gently. */
const HEADER_ALIASES: Record<string, string> = {
  type: "Type",
  prompt: "Prompt",
  passagetitle: "PassageTitle",
  points: "Points",
  difficulty: "Difficulty",
  skillcodes: "SkillCodes",
  optiona: "OptionA",
  optionb: "OptionB",
  optionc: "OptionC",
  optiond: "OptionD",
  optione: "OptionE",
  optionf: "OptionF",
  correct: "Correct",
  blanks: "Blanks",
  acceptedanswers: "AcceptedAnswers",
  matchmode: "MatchMode",
  rubric: "Rubric",
  minwords: "MinWords",
  explanation: "Explanation",
  giaithich: "Explanation",
  notes: "Notes",
};

export function parseExamQuestionsXlsx(
  buf: Buffer | ArrayBuffer | Uint8Array,
  ctx: ImportContext,
  options: { maxRows?: number } = {},
): ParseResult {
  const maxRows = options.maxRows ?? 200;
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames.find((n) => /question/i.test(n)) ?? wb.SheetNames[0]!]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  // Normalize keys per row.
  const normalized = rawRows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const canonical = HEADER_ALIASES[k.trim().toLowerCase()] ?? null;
      if (canonical) out[canonical] = String(v ?? "").trim();
    }
    return out;
  });

  const passageByTitle = new Map(
    ctx.existingPassages.map((p) => [p.title.trim().toLowerCase(), p]),
  );

  const out: ParsedQuestionRow[] = [];
  let rowNumber = 0;
  for (const row of normalized) {
    rowNumber++;
    if (out.length >= maxRows) break;
    // Skip blank rows entirely (no Type means probably a separator/empty row).
    if (!row.Type) continue;
    out.push(parseRow(rowNumber, row, ctx, passageByTitle));
  }

  const summary = {
    ok: out.filter((r) => r.status === "ok").length,
    warning: out.filter((r) => r.status === "warning").length,
    error: out.filter((r) => r.status === "error").length,
    total: out.length,
  };
  return { rows: out, summary };
}

function parseRow(
  rowNumber: number,
  row: Record<string, string>,
  ctx: ImportContext,
  passageByTitle: Map<string, { id: string; title: string }>,
): ParsedQuestionRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const type = row.Type?.toLowerCase();
  if (!type || !P0_TYPES.has(type)) {
    return {
      rowNumber,
      status: "error",
      errors: [`Loại câu hỏi không hợp lệ: "${row.Type}". Hợp lệ: ${[...P0_TYPES].join(", ")}`],
      warnings: [],
    };
  }
  const t = type as Exclude<NonNullable<ParsedQuestionRow["parsed"]>["type"], undefined>;

  const prompt = row.Prompt?.trim() ?? "";
  if (!prompt) errors.push("Đề bài (Prompt) không được để trống");
  if (prompt.length > 5_000) errors.push("Đề bài quá dài (>5000 ký tự)");

  const points = parseIntOr(row.Points, 1);
  if (points < 0 || points > 1_000) errors.push(`Điểm không hợp lệ: ${row.Points}`);

  let difficulty: 1 | 2 | 3 = 2;
  if (row.Difficulty) {
    const d = parseIntOr(row.Difficulty, 2);
    if (d === 1 || d === 2 || d === 3) difficulty = d;
    else errors.push(`Độ khó phải là 1/2/3, nhận: ${row.Difficulty}`);
  }

  // Passage matching.
  let passageId: string | null = null;
  const passageTitleRaw = row.PassageTitle?.trim() ?? "";
  if (passageTitleRaw) {
    const match = passageByTitle.get(passageTitleRaw.toLowerCase());
    if (match) {
      passageId = match.id;
    } else {
      warnings.push(
        `Không tìm thấy đoạn "${passageTitleRaw}" — câu này sẽ thành câu hỏi độc lập`,
      );
    }
  }

  // Skill code resolution.
  const codes = splitList(row.SkillCodes);
  const skillIds: string[] = [];
  const unresolvedSkillCodes: string[] = [];
  for (const code of codes) {
    if (ctx.existingSkillCodes.has(code)) {
      const id = ctx.skillIdByCode?.get(code);
      if (id) skillIds.push(id);
    } else {
      unresolvedSkillCodes.push(code);
      warnings.push(`Skill code không tồn tại: "${code}" — câu sẽ thiếu skill và không publish được`);
    }
  }

  // Build per-type config.
  let config: unknown;
  try {
    config = buildConfigForType(t, row);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // Giải thích đáp án sống trong config cho MỌI loại câu, nên gắn ở đây một
  // lần thay vì lặp trong từng nhánh của buildConfigForType.
  const explanation = row.Explanation?.trim();
  if (explanation && config !== undefined) {
    config = { ...(config as Record<string, unknown>), explanation };
  }

  // Zod schema gives a final structural check.
  if (config !== undefined) {
    const schema = configSchemaForType(t);
    const result = schema.safeParse(config);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
      errors.push(...issues);
    } else {
      config = result.data;
    }
  }

  if (errors.length > 0) {
    return { rowNumber, status: "error", errors, warnings };
  }
  return {
    rowNumber,
    status: warnings.length > 0 ? "warning" : "ok",
    errors,
    warnings,
    parsed: {
      type: t,
      prompt,
      passageId,
      passageTitleRaw,
      points,
      difficulty,
      config,
      skillIds,
      unresolvedSkillCodes,
      notes: row.Notes?.trim() || null,
    },
  };
}

function buildConfigForType(
  type: string,
  row: Record<string, string>,
): unknown {
  switch (type) {
    case "mcq":
    case "multi": {
      const labels: string[] = [];
      for (const k of ["OptionA", "OptionB", "OptionC", "OptionD", "OptionE", "OptionF"]) {
        const v = row[k]?.trim();
        if (v) labels.push(v);
      }
      if (labels.length < 2) {
        throw new Error(`${type.toUpperCase()} cần ≥ 2 đáp án (OptionA, OptionB, …)`);
      }
      const ids = labels.map((_, i) => String.fromCharCode(97 + i));
      const correctRaw = row.Correct?.trim();
      if (!correctRaw) throw new Error("Thiếu cột Correct");
      const correctIds = correctRaw
        .split(/[;,]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const correctSet = new Set(correctIds);
      const options = labels.map((label, i) => ({
        id: ids[i],
        label,
        isCorrect: correctSet.has(ids[i]!),
      }));
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (type === "mcq" && correctCount !== 1) {
        throw new Error(`MCQ cần đúng 1 đáp án đúng, đang có ${correctCount}`);
      }
      if (type === "multi" && correctCount < 1) {
        throw new Error("MULTI cần ≥ 1 đáp án đúng");
      }
      return { options };
    }
    case "true_false_notgiven": {
      const v = row.Correct?.trim().toLowerCase();
      if (v !== "true" && v !== "false" && v !== "notgiven") {
        throw new Error(`Correct phải là true/false/notgiven, nhận: "${row.Correct}"`);
      }
      return { correct: v };
    }
    case "gap_fill": {
      const blanksRaw = row.Blanks?.trim();
      if (!blanksRaw) throw new Error("Thiếu cột Blanks");
      const matchMode = (row.MatchMode?.trim().toLowerCase() === "exact"
        ? "exact"
        : "case_insensitive") as "exact" | "case_insensitive";
      const blanks = blanksRaw.split(";").map((part, i) => {
        const colonIdx = part.indexOf(":");
        if (colonIdx === -1) {
          throw new Error(`Blanks #${i + 1} thiếu dấu ':' (format: id:answer1|answer2)`);
        }
        const id = part.slice(0, colonIdx).trim();
        const answers = part
          .slice(colonIdx + 1)
          .split("|")
          .map((a) => a.trim())
          .filter(Boolean);
        if (!id) throw new Error(`Blanks #${i + 1} thiếu id`);
        if (answers.length === 0) {
          throw new Error(`Blanks #${i + 1} không có đáp án`);
        }
        return { id, acceptedAnswers: answers, matchMode };
      });
      return { blanks };
    }
    case "short_answer": {
      const accepted = splitList(row.AcceptedAnswers);
      if (accepted.length === 0) {
        throw new Error("SHORT_ANSWER cần ít nhất 1 đáp án trong AcceptedAnswers");
      }
      const matchMode = (row.MatchMode?.trim().toLowerCase() === "exact"
        ? "exact"
        : "case_insensitive") as "exact" | "case_insensitive";
      return { acceptedAnswers: accepted, matchMode };
    }
    case "essay": {
      const out: Record<string, unknown> = {};
      if (row.Rubric?.trim()) out.rubric = row.Rubric.trim();
      const mw = row.MinWords?.trim();
      if (mw) {
        const n = parseInt(mw, 10);
        if (Number.isFinite(n) && n > 0) out.minWords = n;
      }
      return out;
    }
    default:
      throw new Error(`Type "${type}" chưa hỗ trợ`);
  }
}

function splitList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseIntOr(s: string | undefined, fallback: number): number {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}
