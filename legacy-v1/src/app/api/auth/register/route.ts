import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.fullName ?? "").trim();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Tên đăng nhập 3-20 ký tự, chỉ chữ thường/số/._" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Mật khẩu tối thiểu 6 ký tự" },
      { status: 400 },
    );
  }
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Họ tên không hợp lệ" }, { status: 400 });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return NextResponse.json(
      { error: "Tên đăng nhập đã tồn tại" },
      { status: 409 },
    );
  }

  // Phân ngẫu nhiên control vs personalized (cân bằng đơn giản: theo count hiện tại)
  const counts = db
    .prepare(
      `SELECT experiment_condition AS c, COUNT(*) AS n FROM users
       WHERE role = 'student' GROUP BY experiment_condition`,
    )
    .all() as { c: string | null; n: number }[];
  const ctrl = counts.find((x) => x.c === "control")?.n ?? 0;
  const pers = counts.find((x) => x.c === "personalized")?.n ?? 0;
  const condition: "control" | "personalized" =
    ctrl <= pers ? "control" : "personalized";

  const hash = await hashPassword(password);
  const result = db
    .prepare(
      "INSERT INTO users (username, password_hash, full_name, role, experiment_condition) VALUES (?, ?, ?, 'student', ?)",
    )
    .run(username, hash, fullName, condition);
  const userId = Number(result.lastInsertRowid);

  const token = createSession(userId);
  await setSessionCookie(token);
  return NextResponse.json({ ok: true, condition });
}
