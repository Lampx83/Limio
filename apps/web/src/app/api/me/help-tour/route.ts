import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import {
  type HelpTourCompletionMap,
  type HelpTourRole,
  markHelpTourSeen,
} from "@/lib/helpTour";

const VALID_ROLES: HelpTourRole[] = ["learner", "instructor"];

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.role !== "string" || !VALID_ROLES.includes(body.role as HelpTourRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  const role = body.role as HelpTourRole;

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { helpTourCompletedByRole: true },
  });
  const updated = markHelpTourSeen(me.helpTourCompletedByRole as HelpTourCompletionMap | null, role);

  await prisma.user.update({
    where: { id: userId },
    data: { helpTourCompletedByRole: updated },
  });
  return NextResponse.json({ ok: true });
}
