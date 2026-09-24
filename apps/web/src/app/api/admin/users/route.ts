import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, type Prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 12;

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

  const SORTABLE = ["displayName", "createdAt", "lastAccessAt"] as const;
  type SortKey = (typeof SORTABLE)[number];
  const sortParam = url.searchParams.get("sort") ?? "";
  const sort: SortKey = (SORTABLE as readonly string[]).includes(sortParam)
    ? (sortParam as SortKey)
    : "createdAt";
  const dir: "asc" | "desc" =
    url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  // lastAccessAt có NULL (chưa từng truy cập): luôn xếp cuối cho cả 2 chiều.
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "lastAccessAt"
      ? [{ lastAccessAt: { sort: dir, nulls: "last" } }, { id: "asc" }]
      : sort === "displayName"
        ? [{ displayName: dir }, { id: "asc" }]
        : [{ createdAt: dir }, { id: "asc" }];

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastAccessAt: true,
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
    lastAccessAt: u.lastAccessAt,
    roles: Array.from(new Set(u.userRoles.map((ur) => ur.role.name))),
    providers: Array.from(new Set(u.authProviders.map((p) => p.provider))),
  }));

  return NextResponse.json({
    users,
    total,
    page,
    limit,
    pageCount: Math.ceil(total / limit),
  });
}

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: {
    email?: unknown;
    displayName?: unknown;
    password?: unknown;
    role?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role : "learner";
  const ALLOWED_ROLES = ["learner", "instructor", "mentor", "admin"];
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "invalid_password" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) {
    return NextResponse.json({ error: "role_seed_missing" }, { status: 500 });
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        id: randomUUID(),
        email,
        displayName,
        passwordHash,
        emailVerifiedAt: null,
      },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });
    await tx.authProvider.create({
      data: {
        userId: created.id,
        provider: "password",
        providerUserId: email,
      },
    });
    await tx.userRole.create({
      data: {
        userId: created.id,
        roleId: roleRow.id,
        courseId: null,
        grantedBy: adminId,
      },
    });
    return created;
  });

  return NextResponse.json({ user }, { status: 201 });
}
