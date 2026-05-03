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
  const sid = Number(id);

  const sub = db
    .prepare(
      `SELECT s.user_id AS author_id, c.id AS course_id, c.owner_instructor_id AS owner
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE s.id = ?`,
    )
    .get(sid) as { author_id: number; course_id: number; owner: number } | undefined;
  if (!sub || sub.owner !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  let body: { reviewer_ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const ids = body.reviewer_ids ?? [];
  if (ids.length === 0)
    return NextResponse.json({ error: "Cần ít nhất 1 reviewer" }, { status: 400 });

  // Validate reviewers: cùng course, không phải tác giả
  const validReviewers = db
    .prepare(
      `SELECT user_id FROM course_enrollments
       WHERE course_id = ? AND role_in_course = 'student' AND user_id != ?`,
    )
    .all(sub.course_id, sub.author_id) as { user_id: number }[];
  const validSet = new Set(validReviewers.map((v) => v.user_id));

  const insert = db.prepare(
    "INSERT OR IGNORE INTO peer_reviews (submission_id, reviewer_id) VALUES (?, ?)",
  );
  let assigned = 0;
  for (const rid of ids) {
    if (validSet.has(Number(rid))) {
      insert.run(sid, Number(rid));
      assigned += 1;
    }
  }
  return NextResponse.json({ ok: true, assigned });
}
