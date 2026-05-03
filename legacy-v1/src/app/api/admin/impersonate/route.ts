import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  createSession,
  getCurrentUser,
  getUserByToken,
  logAudit,
  setSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import type { UserRow } from "@/lib/db";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me)
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  let body: { target_user_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const targetId = Number(body.target_user_id);
  if (!Number.isFinite(targetId))
    return NextResponse.json({ error: "Thiếu target_user_id" }, { status: 400 });

  const target = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(targetId) as UserRow | undefined;
  if (!target)
    return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

  // Quy tắc:
  // - system_admin: impersonate được mọi user (trừ system_admin khác)
  // - institution_admin: chỉ impersonate user TRONG cùng cơ sở, vai trò student/instructor
  // - không cho impersonate chính mình
  if (target.id === me.id)
    return NextResponse.json({ error: "Không thể impersonate chính mình" }, { status: 400 });

  if (me.role === "system_admin") {
    if (target.role === "system_admin")
      return NextResponse.json({ error: "Không thể impersonate system admin khác" }, { status: 403 });
  } else if (me.role === "institution_admin") {
    if (
      target.institution_id !== me.institution_id ||
      (target.role !== "student" && target.role !== "instructor")
    )
      return NextResponse.json({ error: "Không có quyền impersonate user này" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  // Tạo session mới cho target, lưu original để có thể quay lại
  const newToken = createSession(target.id);
  db.prepare(
    "INSERT INTO impersonations (session_token, original_user_id, target_user_id) VALUES (?, ?, ?)",
  ).run(newToken, me.id, target.id);
  logAudit(me.id, "impersonate_start", "user", target.id, {
    target_username: target.username,
    target_role: target.role,
  });
  await setSessionCookie(newToken);

  return NextResponse.json({ ok: true, role: target.role });
}

// Quay lại với tài khoản gốc (admin)
export async function DELETE() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token)
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const imp = db
    .prepare(
      "SELECT original_user_id FROM impersonations WHERE session_token = ?",
    )
    .get(token) as { original_user_id: number } | undefined;
  if (!imp)
    return NextResponse.json({ error: "Không trong chế độ impersonate" }, { status: 400 });

  // Tạo session mới cho user gốc, xoá session impersonate
  const newToken = createSession(imp.original_user_id);
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  await setSessionCookie(newToken);

  const original = getUserByToken(newToken);
  logAudit(imp.original_user_id, "impersonate_end", null, null, {});
  return NextResponse.json({ ok: true, role: original?.role ?? null });
}
