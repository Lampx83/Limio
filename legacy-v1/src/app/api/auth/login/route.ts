import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getUserByUsername,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Thiếu tên đăng nhập hoặc mật khẩu" },
      { status: 400 },
    );
  }
  const user = getUserByUsername(username);
  if (!user) {
    return NextResponse.json(
      { error: "Tài khoản không tồn tại" },
      { status: 401 },
    );
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Mật khẩu không đúng" }, { status: 401 });
  }
  const token = createSession(user.id);
  await setSessionCookie(token);
  return NextResponse.json({
    ok: true,
    role: user.role,
    fullName: user.full_name,
  });
}
