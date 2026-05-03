import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const courseId = Number(id);
  const course = db
    .prepare("SELECT id, owner_instructor_id FROM courses WHERE id = ?")
    .get(courseId) as { id: number; owner_instructor_id: number } | undefined;
  if (!course || course.owner_instructor_id !== user.id) {
    return NextResponse.json({ error: "Khoá học không tồn tại" }, { status: 404 });
  }

  let body: { title?: string; description?: string; order_idx?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (title.length < 3)
    return NextResponse.json({ error: "Tên module tối thiểu 3 ký tự" }, { status: 400 });

  const result = db
    .prepare(
      "INSERT INTO modules (course_id, title, description, order_idx) VALUES (?, ?, ?, ?)",
    )
    .run(
      courseId,
      title,
      (body.description ?? "").trim() || null,
      Math.max(1, Number(body.order_idx) || 1),
    );
  return NextResponse.json({ ok: true, module_id: Number(result.lastInsertRowid) });
}
