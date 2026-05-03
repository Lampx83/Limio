import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  let body: { title?: string; target_date?: string; strategy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  if (title.length < 3)
    return NextResponse.json({ error: "Mục tiêu tối thiểu 3 ký tự" }, { status: 400 });
  db.prepare(
    "INSERT INTO learning_goals (user_id, title, target_date, strategy) VALUES (?, ?, ?, ?)",
  ).run(
    user.id,
    title,
    (body.target_date ?? "").trim() || null,
    (body.strategy ?? "").trim() || null,
  );
  return NextResponse.json({ ok: true });
}
