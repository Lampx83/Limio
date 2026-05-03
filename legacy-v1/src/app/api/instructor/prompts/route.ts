import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "instructor") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: {
    title?: string;
    description?: string;
    template?: string;
    is_public?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const template = (body.template ?? "").trim();
  if (title.length < 3)
    return NextResponse.json({ error: "Tên mẫu tối thiểu 3 ký tự" }, { status: 400 });
  if (template.length < 20)
    return NextResponse.json({ error: "Prompt tối thiểu 20 ký tự" }, { status: 400 });

  db.prepare(
    `INSERT INTO prompt_templates (owner_id, institution_id, title, description, template, is_public)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.institution_id,
    title,
    (body.description ?? "").trim() || null,
    template,
    body.is_public ? 1 : 0,
  );
  return NextResponse.json({ ok: true });
}
