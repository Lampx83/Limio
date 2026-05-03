import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function checkModuleOwnership(userId: number, moduleId: number) {
  const row = db
    .prepare(
      `SELECT c.owner_instructor_id AS owner FROM modules m
       JOIN courses c ON c.id = m.course_id WHERE m.id = ?`,
    )
    .get(moduleId) as { owner: number } | undefined;
  return !!row && row.owner === userId;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const moduleId = Number(id);
  if (!(await checkModuleOwnership(user.id, moduleId)))
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: {
    title?: string;
    prompt?: string;
    learning_objectives?: string;
    rubric?: string;
    min_words?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  const lo = (body.learning_objectives ?? "").trim();
  const rubric = (body.rubric ?? "").trim();
  if (title.length < 3 || prompt.length < 20 || lo.length < 10 || rubric.length < 10)
    return NextResponse.json(
      { error: "Cần đầy đủ tiêu đề (≥3) / đề bài (≥20) / mục tiêu (≥10) / rubric (≥10)" },
      { status: 400 },
    );

  const last = db
    .prepare(
      "SELECT COALESCE(MAX(order_idx),0) AS m FROM assignments WHERE module_id = ?",
    )
    .get(moduleId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO assignments (module_id, title, prompt, learning_objectives, rubric, min_words, order_idx)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      moduleId,
      title,
      prompt,
      lo,
      rubric,
      Math.max(20, Number(body.min_words) || 100),
      last.m + 1,
    );
  return NextResponse.json({ ok: true, assignment_id: Number(result.lastInsertRowid) });
}
