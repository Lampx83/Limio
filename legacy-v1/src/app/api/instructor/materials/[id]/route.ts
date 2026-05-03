import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function checkOwnership(userId: number, materialId: number): Promise<{ type: string } | null> {
  const row = db
    .prepare(
      `SELECT lm.type, c.owner_instructor_id AS owner FROM learning_materials lm
       JOIN modules m ON m.id = lm.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE lm.id = ?`,
    )
    .get(materialId) as { type: string; owner: number } | undefined;
  if (!row || row.owner !== userId) return null;
  return { type: row.type };
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
  const own = await checkOwnership(user.id, mid);
  if (!own) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: {
    title?: string;
    description?: string;
    video_url?: string;
    pdf_url?: string;
    reading_text?: string;
    quiz_data?: unknown;
    duration_min?: number;
    order_idx?: number;
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
  if (typeof body.description === "string") {
    fields.push("description = ?");
    values.push(body.description.trim() || null);
  }
  if (typeof body.duration_min === "number") {
    fields.push("duration_min = ?");
    values.push(body.duration_min);
  }
  if (typeof body.order_idx === "number" && body.order_idx > 0) {
    fields.push("order_idx = ?");
    values.push(body.order_idx);
  }
  if (own.type === "video" && typeof body.video_url === "string") {
    fields.push("video_url = ?");
    values.push(body.video_url.trim());
  }
  if (own.type === "pdf") {
    if (typeof body.pdf_url === "string") {
      fields.push("pdf_url = ?");
      values.push(body.pdf_url.trim() || null);
    }
    if (typeof body.reading_text === "string") {
      fields.push("reading_text = ?");
      values.push(body.reading_text.trim() || null);
    }
  }
  if (own.type === "quiz" && Array.isArray(body.quiz_data)) {
    fields.push("quiz_data = ?");
    values.push(JSON.stringify(body.quiz_data));
  }

  if (fields.length === 0)
    return NextResponse.json({ error: "Không có thay đổi" }, { status: 400 });
  values.push(mid);
  db.prepare(
    `UPDATE learning_materials SET ${fields.join(", ")} WHERE id = ?`,
  ).run(...values);
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
  const own = await checkOwnership(user.id, mid);
  if (!own) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  db.prepare("DELETE FROM learning_materials WHERE id = ?").run(mid);
  return NextResponse.json({ ok: true });
}
