import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeScore, LS_QUESTIONS } from "@/lib/learning-style";
import { logEvent } from "@/lib/log";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  let body: { answers?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  const answers = body.answers ?? {};
  const validIds = new Set(LS_QUESTIONS.map((q) => q.id));
  for (const id of Object.keys(answers)) {
    if (!validIds.has(id)) delete answers[id];
  }
  for (const q of LS_QUESTIONS) {
    if (answers[q.id] !== -1 && answers[q.id] !== 1) {
      return NextResponse.json(
        { error: `Thiếu câu trả lời cho ${q.id}` },
        { status: 400 },
      );
    }
  }

  const score = computeScore(answers as Record<string, -1 | 1>);

  db.prepare(
    `INSERT INTO learning_styles (user_id, active_reflective, sensing_intuitive, visual_verbal, sequential_global)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       active_reflective=excluded.active_reflective,
       sensing_intuitive=excluded.sensing_intuitive,
       visual_verbal=excluded.visual_verbal,
       sequential_global=excluded.sequential_global,
       created_at=datetime('now')`,
  ).run(
    user.id,
    score.active_reflective,
    score.sensing_intuitive,
    score.visual_verbal,
    score.sequential_global,
  );

  logEvent(user.id, "ls_complete", null, { score });
  return NextResponse.json({ ok: true, score });
}
