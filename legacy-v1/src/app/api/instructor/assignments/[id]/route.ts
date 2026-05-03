import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function checkOwnership(userId: number, aid: number) {
  const row = db
    .prepare(
      `SELECT c.owner_instructor_id AS owner FROM assignments a
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE a.id = ?`,
    )
    .get(aid) as { owner: number } | undefined;
  return !!row && row.owner === userId;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const aid = Number(id);
  if (!(await checkOwnership(user.id, aid)))
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
  const fields: string[] = [];
  const values: unknown[] = [];
  if (typeof body.title === "string" && body.title.trim().length >= 3) {
    fields.push("title = ?");
    values.push(body.title.trim());
  }
  if (typeof body.prompt === "string" && body.prompt.trim().length >= 20) {
    fields.push("prompt = ?");
    values.push(body.prompt.trim());
  }
  if (typeof body.learning_objectives === "string") {
    fields.push("learning_objectives = ?");
    values.push(body.learning_objectives.trim());
  }
  if (typeof body.rubric === "string") {
    fields.push("rubric = ?");
    values.push(body.rubric.trim());
  }
  if (typeof body.min_words === "number") {
    fields.push("min_words = ?");
    values.push(Math.max(20, body.min_words));
  }
  if (fields.length === 0)
    return NextResponse.json({ error: "Không có thay đổi" }, { status: 400 });
  values.push(aid);
  db.prepare(`UPDATE assignments SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const aid = Number(id);
  if (!(await checkOwnership(user.id, aid)))
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  db.prepare("DELETE FROM assignments WHERE id = ?").run(aid);
  return NextResponse.json({ ok: true });
}
