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

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { code?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code =
    typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }

  const existing = await prisma.organization.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "code_taken" }, { status: 409 });
  }

  const org = await prisma.organization.create({
    data: { code, name },
    select: { id: true, code: true, name: true },
  });

  return NextResponse.json({ organization: org }, { status: 201 });
}
