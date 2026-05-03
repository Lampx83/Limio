import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "institution_admin" || user.institution_id === null) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: {
    username?: string;
    fullName?: string;
    password?: string;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  const username = (body.username ?? "").toLowerCase().trim();
  const fullName = (body.fullName ?? "").trim();
  const password = body.password ?? "";
  const role = body.role;

  if (role !== "student" && role !== "instructor")
    return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
  if (!USERNAME_RE.test(username))
    return NextResponse.json({ error: "Username 3-20 ký tự (chữ thường/số/._)" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "Mật khẩu ≥ 6 ký tự" }, { status: 400 });
  if (fullName.length < 2)
    return NextResponse.json({ error: "Họ tên không hợp lệ" }, { status: 400 });

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists)
    return NextResponse.json({ error: "Username đã tồn tại" }, { status: 409 });

  // Phân ngẫu nhiên control vs personalized chỉ với student
  let cond: "control" | "personalized" | null = null;
  if (role === "student") {
    const counts = db
      .prepare(
        `SELECT experiment_condition AS c, COUNT(*) AS n FROM users
         WHERE role = 'student' AND institution_id = ? GROUP BY experiment_condition`,
      )
      .all(user.institution_id) as Array<{ c: string | null; n: number }>;
    const ctrl = counts.find((x) => x.c === "control")?.n ?? 0;
    const pers = counts.find((x) => x.c === "personalized")?.n ?? 0;
    cond = ctrl <= pers ? "control" : "personalized";
  }

  const hash = await hashPassword(password);
  db.prepare(
    "INSERT INTO users (username, password_hash, full_name, role, institution_id, experiment_condition) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(username, hash, fullName, role, user.institution_id, cond);
  return NextResponse.json({ ok: true, condition: cond });
}
