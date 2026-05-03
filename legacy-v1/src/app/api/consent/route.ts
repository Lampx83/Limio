import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Không có quyền" }, { status: 401 });

  let body: { version?: string; consented?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const version = (body.version ?? "").trim();
  if (!version)
    return NextResponse.json({ error: "Thiếu version" }, { status: 400 });

  db.prepare(
    `INSERT INTO consent_records (user_id, consent_text_version, consented, consented_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       consent_text_version = excluded.consent_text_version,
       consented = excluded.consented,
       consented_at = datetime('now')`,
  ).run(user.id, version, body.consented ? 1 : 0);

  return NextResponse.json({ ok: true });
}
