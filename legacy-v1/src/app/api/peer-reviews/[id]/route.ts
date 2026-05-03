import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const pid = Number(id);
  const pr = db
    .prepare("SELECT reviewer_id, status FROM peer_reviews WHERE id = ?")
    .get(pid) as { reviewer_id: number; status: string } | undefined;
  if (!pr || pr.reviewer_id !== user.id)
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  if (pr.status === "submitted")
    return NextResponse.json({ error: "Đã nộp peer review rồi" }, { status: 409 });

  let body: { content?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (content.length < 30)
    return NextResponse.json({ error: "Nhận xét tối thiểu 30 ký tự" }, { status: 400 });
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100)
    return NextResponse.json({ error: "Điểm 0-100" }, { status: 400 });

  db.prepare(
    `UPDATE peer_reviews SET content = ?, score = ?, status = 'submitted', submitted_at = datetime('now') WHERE id = ?`,
  ).run(content, score, pid);
  return NextResponse.json({ ok: true });
}
