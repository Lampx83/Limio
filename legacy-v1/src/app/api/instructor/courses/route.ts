import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: { code?: string; title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const code = (body.code ?? "").trim().toUpperCase();
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code))
    return NextResponse.json({ error: "Mã khoá 3-20 ký tự (chữ HOA/số/_-)" }, { status: 400 });
  if (title.length < 3)
    return NextResponse.json({ error: "Tên khoá tối thiểu 3 ký tự" }, { status: 400 });

  const exists = db.prepare("SELECT id FROM courses WHERE code = ?").get(code);
  if (exists)
    return NextResponse.json({ error: "Mã khoá đã tồn tại" }, { status: 409 });

  const result = db
    .prepare(
      "INSERT INTO courses (code, title, description, institution_id, owner_instructor_id) VALUES (?, ?, ?, ?, ?)",
    )
    .run(code, title, description, user.institution_id, user.id);
  const courseId = Number(result.lastInsertRowid);
  db.prepare(
    "INSERT INTO course_enrollments (course_id, user_id, role_in_course) VALUES (?, ?, 'instructor')",
  ).run(courseId, user.id);

  return NextResponse.json({ ok: true, course_id: courseId });
}
