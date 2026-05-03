import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function checkOwnership(userId: number, moduleId: number) {
  const row = db
    .prepare(
      `SELECT c.owner_instructor_id AS owner FROM modules m
       JOIN courses c ON c.id = m.course_id WHERE m.id = ?`,
    )
    .get(moduleId) as { owner: number } | undefined;
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
  const mid = Number(id);
  if (!(await checkOwnership(user.id, mid)))
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: { title?: string; description?: string; order_idx?: number };
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
  if (typeof body.description === "string") {
    fields.push("description = ?");
    values.push(body.description.trim() || null);
  }
  if (typeof body.order_idx === "number" && body.order_idx > 0) {
    fields.push("order_idx = ?");
    values.push(body.order_idx);
  }
  if (fields.length === 0)
    return NextResponse.json({ error: "Không có thay đổi" }, { status: 400 });
  values.push(mid);
  db.prepare(`UPDATE modules SET ${fields.join(", ")} WHERE id = ?`).run(
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
  const mid = Number(id);
  if (!(await checkOwnership(user.id, mid)))
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  db.prepare("DELETE FROM modules WHERE id = ?").run(mid);
  return NextResponse.json({ ok: true });
}
