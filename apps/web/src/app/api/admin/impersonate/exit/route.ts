import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  IMPERSONATION_COOKIE,
  decodeImpersonationCookie,
  stopImpersonation,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export async function POST() {
  const session = await auth();
  // Read cookie to know what we're stopping (for audit). Don't 403 if there's
  // no admin session — exiting impersonation should always succeed.
  const raw = cookies().get(IMPERSONATION_COOKIE)?.value;
  const decoded = decodeImpersonationCookie(raw);

  if (decoded && session?.user?.id) {
    // Best-effort audit; admin id from JWT (token.userId is preserved through
    // session swap in the session callback via session.user.impersonator.id).
    const adminId =
      (session.user.impersonator?.id as string | undefined) ?? decoded.adminId;
    await stopImpersonation(adminId, decoded.targetId).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  // Belt-and-suspenders: both `expires` (legacy) and `maxAge=0` (modern) so the
  // browser drops the cookie regardless of which clock it trusts.
  res.cookies.set(IMPERSONATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return res;
}
