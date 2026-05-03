import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const QUERIES: Record<string, string> = {
  users: `SELECT id, role, institution_id, experiment_condition, created_at FROM users`,
  submissions: `SELECT id, assignment_id, user_id, time_spent_sec, edit_count, paste_count,
                 LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1 AS word_count_approx,
                 submitted_at FROM submissions`,
  ai_feedbacks: `SELECT id, submission_id, condition, score, status, reviewed_by, reviewed_at, created_at,
                 feed_up, feed_back_task, feed_back_process, feed_back_self_reg, feed_forward, metacog_prompt FROM ai_feedbacks`,
  material_interactions: `SELECT mi.id, mi.user_id, mi.material_id, lm.type, mi.score, mi.completed_at
                          FROM material_interactions mi JOIN learning_materials lm ON lm.id = mi.material_id`,
  material_feedbacks: `SELECT mf.id, mf.interaction_id, mf.condition, mf.summary, mf.strengths, mf.gaps, mf.next_steps, mf.metacog_prompt, mf.created_at FROM material_feedbacks mf`,
  behavioral_logs: `SELECT id, user_id, assignment_id, event_type, payload, created_at FROM behavioral_logs`,
  srl: `SELECT id, user_id, phase, score_total, score_forethought, score_performance, score_reflection, created_at FROM srl_responses`,
  learning_styles: `SELECT user_id, active_reflective, sensing_intuitive, visual_verbal, sequential_global, created_at FROM learning_styles`,
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "system_admin") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  const sql = QUERIES[kind];
  if (!sql)
    return NextResponse.json({ error: "Loại không hợp lệ" }, { status: 400 });

  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  if (rows.length === 0) {
    return new NextResponse("\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${kind}.csv"`,
      },
    });
  }
  const cols = Object.keys(rows[0]);
  const lines = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")),
  ];
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}.csv"`,
    },
  });
}
