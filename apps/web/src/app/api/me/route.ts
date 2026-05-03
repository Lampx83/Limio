import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { ProfileError, updateProfile } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      timezone: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await updateProfile(userId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ProfileError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
