import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface MaterialRow {
  id: number;
  type: "video" | "pdf" | "quiz";
  quiz_data: string | null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const mid = Number(id);
  if (!Number.isFinite(mid)) {
    return NextResponse.json({ error: "ID học liệu không hợp lệ" }, { status: 400 });
  }

  const m = db
    .prepare("SELECT id, type, quiz_data FROM learning_materials WHERE id = ?")
    .get(mid) as MaterialRow | undefined;
  if (!m) return NextResponse.json({ error: "Không tìm thấy học liệu" }, { status: 404 });

  let body: {
    data?: Record<string, unknown>;
    quiz_answers?: number[];
    reflection?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  let score: number | null = null;
  let payload: Record<string, unknown> = {
    ...(body.data ?? {}),
    reflection: body.reflection ?? "",
  };

  if (m.type === "quiz") {
    if (!Array.isArray(body.quiz_answers)) {
      return NextResponse.json(
        { error: "Quiz cần quiz_answers (mảng số chỉ chỉ số đáp án chọn)" },
        { status: 400 },
      );
    }
    const questions = JSON.parse(m.quiz_data ?? "[]") as Array<{
      q: string;
      options: string[];
      correct_idx: number;
      explanation?: string;
    }>;
    if (body.quiz_answers.length !== questions.length) {
      return NextResponse.json(
        { error: `Phải trả lời đủ ${questions.length} câu` },
        { status: 400 },
      );
    }
    let correct = 0;
    const detail = questions.map((q, i) => {
      const ans = body.quiz_answers![i];
      const isCorrect = ans === q.correct_idx;
      if (isCorrect) correct += 1;
      return {
        q: q.q,
        chosen_idx: ans,
        chosen_text: q.options[ans] ?? "(không hợp lệ)",
        correct_idx: q.correct_idx,
        correct_text: q.options[q.correct_idx],
        is_correct: isCorrect,
        explanation: q.explanation ?? "",
      };
    });
    score = Math.round((correct / questions.length) * 100);
    payload = { ...payload, answers: body.quiz_answers, detail, correct, total: questions.length };
  }

  const upsert = db.prepare(
    `INSERT INTO material_interactions (user_id, material_id, data, score, completed_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, material_id) DO UPDATE SET
       data = excluded.data,
       score = excluded.score,
       completed_at = excluded.completed_at
     RETURNING id`,
  );
  const result = upsert.get(user.id, mid, JSON.stringify(payload), score) as
    | { id: number }
    | undefined;
  const interactionId = result?.id ?? 0;

  return NextResponse.json({
    ok: true,
    interaction_id: interactionId,
    score,
    detail: payload.detail,
  });
}
