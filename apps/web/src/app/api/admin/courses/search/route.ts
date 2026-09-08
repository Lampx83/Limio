import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Admin-only course picker — dùng khi thêm course vào 1 catalog section. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const courses = await prisma.course.findMany({
    where: {
      status: "published",
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, title: true, slug: true, category: true },
  });
  return NextResponse.json({ courses });
}
