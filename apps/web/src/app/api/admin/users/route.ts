import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";

export async function GET(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 25)),
  );
  const q = (url.searchParams.get("q") ?? "").trim();
  const role = url.searchParams.get("role");

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role) {
    where.userRoles = { some: { role: { name: role } } };
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        userRoles: {
          select: {
            role: { select: { name: true } },
            courseId: true,
          },
        },
        authProviders: {
          select: { provider: true },
        },
      },
    }),
  ]);

  const users = rows.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt,
    roles: Array.from(new Set(u.userRoles.map((ur) => ur.role.name)),
    providers: Array.from(new Set(u.authProviders.map((p) => p.provider)),
  }));

  return NextResponse.json({
    users,
    total,
    page,
    limit,
    pageCount: Math.ceil(total / limit),
  });
}
