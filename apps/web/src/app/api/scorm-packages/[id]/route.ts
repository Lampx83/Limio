import { NextResponse } from "next/server";
import { deleteScormPackage, isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pkg = await prisma.scormPackage.findUnique({
    where: { id: params.id },
    select: { uploaderId: true },
  });
  if (!pkg) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = await isAdmin(userId);
  if (!admin && pkg.uploaderId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await deleteScormPackage(params.id);
  return NextResponse.json({ ok: true });
}
