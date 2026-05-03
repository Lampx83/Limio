import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  const { id } = await ctx.params;
  const mid = Number(id);
  let body: { content?: string; parent_id?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  if (content.length < 5)
    return NextResponse.json({ error: "Nội dung tối thiểu 5 ký tự" }, { status: 400 });
  const m = db
    .prepare("SELECT id, type FROM learning_materials WHERE id = ?")
    .get(mid) as { id: number; type: string } | undefined;
  if (!m || m.type !== "discussion")
    return NextResponse.json({ error: "Không phải học liệu thảo luận" }, { status: 400 });

  db.prepare(
    "INSERT INTO discussion_posts (material_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)",
  ).run(mid, user.id, body.parent_id ?? null, content);
  return NextResponse.json({ ok: true });
}
