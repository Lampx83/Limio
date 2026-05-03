import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreSRL, SRL_QUESTIONS } from "@/lib/srl-questions";
import { logEvent } from "@/lib/log";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }

  const url = new URL(req.url);
  const phase = url.searchParams.get("phase");
  if (phase !== "pre" && phase !== "post") {
    return NextResponse.json({ error: "phase phải là pre hoặc post" }, { status: 400 });
  }

  let body: { answers?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  const answers = body.answers ?? {};
  for (const q of SRL_QUESTIONS) {
    const v = answers[q.id];
    if (typeof v !== "number" || v < 1 || v > 5) {
      return NextResponse.json(
        { error: `Câu ${q.id} phải có điểm 1-5` },
        { status: 400 },
      );
    }
  }

  const s = scoreSRL(answers);
  db.prepare(
    `INSERT INTO srl_responses (user_id, phase, responses, score_total, score_forethought, score_performance, score_reflection)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, phase) DO UPDATE SET
       responses=excluded.responses,
       score_total=excluded.score_total,
       score_forethought=excluded.score_forethought,
       score_performance=excluded.score_performance,
       score_reflection=excluded.score_reflection,
       created_at=datetime('now')`,
  ).run(
    user.id,
    phase,
    JSON.stringify(answers),
    s.total,
    s.forethought,
    s.performance,
    s.reflection,
  );

  logEvent(
    user.id,
    phase === "pre" ? "srl_pre_complete" : "srl_post_complete",
    null,
    { score: s },
  );
  return NextResponse.json({ ok: true, score: s });
}
