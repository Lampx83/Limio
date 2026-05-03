import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const CODE_RE = /^[A-Z0-9]{2,15}$/;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "system_admin") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: {
    code?: string;
    name?: string;
    address?: string;
    contact_email?: string;
    admin?: { username?: string; fullName?: string; password?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const code = (body.code ?? "").toUpperCase().trim();
  const name = (body.name ?? "").trim();
  if (!CODE_RE.test(code))
    return NextResponse.json({ error: "Mã 2-15 ký tự (chữ HOA/số)" }, { status: 400 });
  if (name.length < 3)
    return NextResponse.json({ error: "Tên cơ sở tối thiểu 3 ký tự" }, { status: 400 });
  const exists = db.prepare("SELECT id FROM institutions WHERE code = ?").get(code);
  if (exists)
    return NextResponse.json({ error: "Mã cơ sở đã tồn tại" }, { status: 409 });

  const result = db
    .prepare(
      "INSERT INTO institutions (code, name, address, contact_email) VALUES (?, ?, ?, ?)",
    )
    .run(code, name, (body.address ?? "").trim() || null, (body.contact_email ?? "").trim() || null);
  const iid = Number(result.lastInsertRowid);

  if (body.admin?.username) {
    const u = body.admin.username.toLowerCase().trim();
    const fn = (body.admin.fullName ?? "").trim();
    const pw = body.admin.password ?? "";
    if (!USERNAME_RE.test(u))
      return NextResponse.json({ error: "Username QT không hợp lệ" }, { status: 400 });
    if (pw.length < 6)
      return NextResponse.json({ error: "Mật khẩu QT ≥ 6 ký tự" }, { status: 400 });
    if (fn.length < 2)
      return NextResponse.json({ error: "Họ tên QT không hợp lệ" }, { status: 400 });
    const dup = db.prepare("SELECT id FROM users WHERE username = ?").get(u);
    if (dup) return NextResponse.json({ error: "Username QT đã tồn tại" }, { status: 409 });
    const hash = await hashPassword(pw);
    db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, institution_id) VALUES (?, ?, ?, 'institution_admin', ?)",
    ).run(u, hash, fn, iid);
  }

  return NextResponse.json({ ok: true, institution_id: iid });
}
