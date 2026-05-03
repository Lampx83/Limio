import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  let body: { prompt?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();
  const content = (body.content ?? "").trim();
  if (content.length < 10)
    return NextResponse.json(
      { error: "Suy ngẫm tối thiểu 10 ký tự" },
      { status: 400 },
    );
  if (!prompt)
    return NextResponse.json({ error: "Thiếu prompt" }, { status: 400 });
  db.prepare(
    "INSERT INTO reflections (user_id, prompt, content) VALUES (?, ?, ?)",
  ).run(user.id, prompt, content);
  return NextResponse.json({ ok: true });
}
