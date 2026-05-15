import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Lookup a User by exact email. Used by instructor-side pickers (proctor,
 * grader assignment for ExamRoom). Restricted to callers who are an
 * instructor of at least one course — limits enumeration surface vs a
 * fully-open user directory.
 *
 * Query: ?email=foo@bar.com
 * 200 { id, displayName, email } | 404 { error: "not_found" }
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const isInstructor =
    (await prisma.courseInstructor.count({
      where: { userId },
    })) > 0;
  if (!isInstructor)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const u = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, email: true },
  });
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(u);
}
