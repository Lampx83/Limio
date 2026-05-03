import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

const ALLOWED_KEYS = new Set(["openai_api_key", "openai_model"]);
const ENCRYPTED_KEYS = new Set(["openai_api_key"]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "system_admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const upsert = db.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
  );
  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v !== "string" || v.length === 0) continue;
    const stored = ENCRYPTED_KEYS.has(k) ? encrypt(v) : v;
    upsert.run(k, stored, user.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "system_admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  let body: { keys?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  for (const k of body.keys ?? []) {
    if (!ALLOWED_KEYS.has(k)) continue;
    db.prepare("DELETE FROM system_settings WHERE key = ?").run(k);
  }
  return NextResponse.json({ ok: true });
}
