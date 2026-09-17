import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";

/**
 * List courses for the admin course picker — trước tính năng này admin không
 * có đường vào 1 course cụ thể ngoài đoán URL (isAdmin() bypass canEditCourse
 * nhưng không có UI nào dẫn tới đó).
 */
export async function GET(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
  const q = (url.searchParams.get("q") ?? "").trim();

  const where: Record<string, unknown> = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        priceCents: true,
        currency: true,
        _count: { select: { accessPlans: { where: { isActive: true } } } },
      },
    }),
  ]);

  const courses = rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    priceCents: c.priceCents,
    currency: c.currency,
    activeAccessPlanCount: c._count.accessPlans,
  }));

  return NextResponse.json({
    courses,
    total,
    page,
    limit,
    pageCount: Math.ceil(total / limit),
  });
}
