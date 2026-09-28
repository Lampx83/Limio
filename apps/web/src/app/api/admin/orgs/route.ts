import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";

export async function GET(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const rows = await prisma.organization.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { admins: true, users: true } },
    },
  });

  return NextResponse.json({
    organizations: rows.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      adminCount: o._count.admins,
      userCount: o._count.users,
    })),
  });
}
