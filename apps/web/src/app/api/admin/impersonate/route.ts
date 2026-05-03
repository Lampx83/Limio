import { NextResponse } from "next/server";
import {
  IMPERSONATION_COOKIE,
  ImpersonationError,
  startImpersonation,
} from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { targetUserId?: string };
  try {
    body = (await req.json()) as { targetUserId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body?.targetUserId) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }

  try {
    const cookie = await startImpersonation(adminId, body.targetUserId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(IMPERSONATION_COOKIE, cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: cookie.expires,
    });
    return res;
  } catch (e) {
    if (e instanceof ImpersonationError) {
      const status = e.code === "target_not_found" ? 404 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
