import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const gid = Number(id);
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  if (!["active", "completed", "abandoned"].includes(body.status ?? ""))
    return NextResponse.json({ error: "Status không hợp lệ" }, { status: 400 });

  const goal = db
    .prepare("SELECT user_id FROM learning_goals WHERE id = ?")
    .get(gid) as { user_id: number } | undefined;
  if (!goal || goal.user_id !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  db.prepare(
    `UPDATE learning_goals SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END WHERE id = ?`,
  ).run(body.status, body.status, gid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const gid = Number(id);
  const goal = db
    .prepare("SELECT user_id FROM learning_goals WHERE id = ?")
    .get(gid) as { user_id: number } | undefined;
  if (!goal || goal.user_id !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  db.prepare("DELETE FROM learning_goals WHERE id = ?").run(gid);
  return NextResponse.json({ ok: true });
}
