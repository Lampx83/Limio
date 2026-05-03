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
  const fid = Number(id);

  // Check ownership: feedback → submission → assignment → module → course → owner
  const owner = db
    .prepare(
      `SELECT c.owner_instructor_id AS owner FROM ai_feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE f.id = ?`,
    )
    .get(fid) as { owner: number } | undefined;
  if (!owner) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  if (owner.owner !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: { status?: string; instructor_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  if (body.status !== "approved" && body.status !== "revised") {
    return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  }

  db.prepare(
    `UPDATE ai_feedbacks
     SET status = ?, instructor_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
  ).run(body.status, body.instructor_notes ?? "", user.id, fid);

  return NextResponse.json({ ok: true });
}
