import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationsSeen, type Role } from "@/lib/notifications";

function parseRole(raw: string | null): Role {
  if (raw === "instructor" || raw === "admin" || raw === "mentor") return raw;
  return "learner";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = parseRole(req.nextUrl.searchParams.get("role"));
  await markNotificationsSeen(userId, role);
  return NextResponse.json({ ok: true, role });
}
