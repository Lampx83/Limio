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

interface CreateBody {
  type?: "video" | "pdf" | "quiz";
  title?: string;
  description?: string;
  video_url?: string;
  pdf_url?: string;
  reading_text?: string;
  quiz_data?: unknown;
  duration_min?: number;
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

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const type = body.type;
  if (type !== "video" && type !== "pdf" && type !== "quiz")
    return NextResponse.json({ error: "Loại không hợp lệ" }, { status: 400 });
  const title = (body.title ?? "").trim();
  if (title.length < 3)
    return NextResponse.json({ error: "Tiêu đề tối thiểu 3 ký tự" }, { status: 400 });

  if (type === "video" && !(body.video_url ?? "").trim())
    return NextResponse.json({ error: "Cần video_url" }, { status: 400 });
  if (type === "pdf" && !(body.reading_text ?? "").trim() && !(body.pdf_url ?? "").trim())
    return NextResponse.json({ error: "Cần reading_text hoặc pdf_url" }, { status: 400 });
  if (type === "quiz") {
    const qd = body.quiz_data;
    if (!Array.isArray(qd) || qd.length < 1)
      return NextResponse.json({ error: "Quiz data thiếu" }, { status: 400 });
  }

  const last = db
    .prepare(
      "SELECT COALESCE(MAX(order_idx),0) AS m FROM learning_materials WHERE module_id = ?",
    )
    .get(moduleId) as { m: number };

  const result = db
    .prepare(
      `INSERT INTO learning_materials
       (module_id, type, title, description, video_url, pdf_url, reading_text, quiz_data, duration_min, order_idx)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      moduleId,
      type,
      title,
      (body.description ?? "").trim() || null,
      type === "video" ? (body.video_url ?? "").trim() : null,
      type === "pdf" ? (body.pdf_url ?? "").trim() || null : null,
      type === "pdf" ? (body.reading_text ?? "").trim() || null : null,
      type === "quiz" ? JSON.stringify(body.quiz_data) : null,
      Number(body.duration_min) || null,
      last.m + 1,
    );
  return NextResponse.json({ ok: true, material_id: Number(result.lastInsertRowid) });
}
