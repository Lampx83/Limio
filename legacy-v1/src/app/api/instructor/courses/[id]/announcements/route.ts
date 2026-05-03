import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const cid = Number(id);
  const course = db
    .prepare("SELECT owner_instructor_id FROM courses WHERE id = ?")
    .get(cid) as { owner_instructor_id: number } | undefined;
  if (!course || course.owner_instructor_id !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: { title?: string; body?: string; pinned?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (title.length < 3 || text.length < 10)
    return NextResponse.json({ error: "Tiêu đề ≥3 và nội dung ≥10 ký tự" }, { status: 400 });

  db.prepare(
    "INSERT INTO announcements (course_id, author_id, title, body, pinned) VALUES (?, ?, ?, ?, ?)",
  ).run(cid, user.id, title, text, body.pinned ? 1 : 0);
  return NextResponse.json({ ok: true });
}
