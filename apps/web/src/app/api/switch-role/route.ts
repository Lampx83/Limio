import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ACTIVE_ROLE_COOKIE } from "@/lib/active-role";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const role = typeof body?.role === "string" ? body.role : null;
  const userRoles = session.user.roles ?? [];

  if (!role || !userRoles.includes(role)) {
    return NextResponse.json({ error: "Role not allowed" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
