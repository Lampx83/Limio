import { NextResponse } from "next/server";
import { createQuestion, QuizError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Bulk import quiz questions from CSV. Format (one row per option):
 *   prompt,type,option_label,is_correct,explanation,points
 *
 * Multi-option questions: repeat the same prompt across rows; we group by prompt
 * (in source order). type from first row of group wins.
 *
 * - is_correct: 1/0/true/false/yes/no
 * - points: optional, defaults 1
 *
 * Returns { created, errors } — partial success allowed.
 */
export async function POST(
  req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const csvText = await req.text();
  if (!csvText.trim()) {
    return NextResponse.json({ error: "validation_failed", details: "empty" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json({ error: "validation_failed", details: "no_data_rows" }, { status: 400 });
  }
  const header = rows[0]!.map((h) => h.toLowerCase().trim());
  const required = ["prompt", "type", "option_label", "is_correct"];
  for (const col of required) {
    if (!header.includes(col)) {
      return NextResponse.json(
        { error: "validation_failed", details: `missing_column:${col}` },
        { status: 400 },
      );
    }
  }
  const idx = (col: string) => header.indexOf(col);
  const promptI = idx("prompt");
  const typeI = idx("type");
  const labelI = idx("option_label");
  const correctI = idx("is_correct");
  const explI = idx("explanation");
  const pointsI = idx("points");

  // Group rows by prompt (preserving source order).
  type Group = {
    prompt: string;
    type: string;
    explanation?: string;
    points?: number;
    options: Array<{ label: string; isCorrect: boolean }>;
  };
  const groups: Group[] = [];
  const promptOrder = new Map<string, number>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.every((cell) => !cell.trim()) continue; // blank line
    const prompt = r[promptI]?.trim();
    const type = (r[typeI] ?? "").trim() || "mcq";
    if (!prompt) continue;
    const idxOfGroup = promptOrder.get(prompt);
    if (idxOfGroup === undefined) {
      const g: Group = {
        prompt,
        type,
        explanation: explI >= 0 ? r[explI]?.trim() || undefined : undefined,
        points: pointsI >= 0 && r[pointsI]?.trim() ? Number(r[pointsI]) : undefined,
        options: [],
      };
      promptOrder.set(prompt, groups.length);
      groups.push(g);
    }
    const g = groups[promptOrder.get(prompt)!]!;
    const label = r[labelI]?.trim();
    if (!label) continue;
    g.options.push({ label, isCorrect: parseBool(r[correctI] ?? "") });
  }

  const errors: Array<{ index: number; prompt: string; error: string }> = [];
  let created = 0;
  // Find the next orderIndex to start from.
  // Caller persists in order — service will append after existing questions.
  // We just use sequential indexes starting at a large number to avoid collision;
  // proper compaction is for instructor to do later.
  const baseIndex = Date.now() % 100000;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    if (g.options.length === 0) {
      errors.push({ index: i, prompt: g.prompt, error: "no_options" });
      continue;
    }
    try {
      await createQuestion(userId, params.quizId, {
        type: g.type,
        prompt: g.prompt,
        explanation: g.explanation,
        points: g.points ?? 1,
        orderIndex: baseIndex + i,
        options: g.options,
      });
      created += 1;
    } catch (e) {
      const code = e instanceof QuizError ? e.code : "unknown";
      const detail = e instanceof QuizError ? e.details : (e as Error).message;
      errors.push({
        index: i,
        prompt: g.prompt.slice(0, 60),
        error: `${code}:${JSON.stringify(detail).slice(0, 200)}`,
      });
    }
  }

  return NextResponse.json({ created, errors, totalGroups: groups.length });
}

/** Naive RFC4180 parser — handles quoted cells with escaped "" + commas + newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(cell);
        cell = "";
      } else if (c === "\n") {
        cur.push(cell);
        rows.push(cur);
        cur = [];
        cell = "";
      } else if (c === "\r") {
        // ignore
      } else {
        cell += c;
      }
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  // Strip BOM
  if (rows.length > 0 && rows[0]![0]?.charCodeAt(0) === 0xfeff) {
    rows[0]![0] = rows[0]![0]!.slice(1);
  }
  return rows;
}

function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "đúng" || s === "x";
}
