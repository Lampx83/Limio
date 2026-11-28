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

  // Bộ lọc tuỳ chọn: status (draft|published|archived), org ("none" = chưa thuộc tổ chức, hoặc id), sample ("teacher"|"learner").
  const status = url.searchParams.get("status");
  const org = url.searchParams.get("org");
  const sample = url.searchParams.get("sample");

  const where: Record<string, unknown> = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  if (status === "draft" || status === "published" || status === "archived") where.status = status;
  if (org === "none") where.organizationId = null;
  else if (org) where.organizationId = org;
  if (sample === "teacher") where.isSample = true;
  else if (sample === "learner") where.learnerSampleAt = { not: null };

  const [total, statusGroups, noOrgCount, teacherSampleCount, learnerSampleCount, rows] = await Promise.all([
    prisma.course.count({ where }),
    // Số liệu tổng không phụ thuộc bộ lọc đang chọn: để các nút lọc luôn cho biết "bấm vào sẽ thấy bao nhiêu".
    prisma.course.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.course.count({ where: { organizationId: null } }),
    prisma.course.count({ where: { isSample: true } }),
    prisma.course.count({ where: { learnerSampleAt: { not: null } } }),
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
        publicAccess: true,
        isSample: true,
        virtualLecturerMode: true,
        virtualLecturerCode: true,
        learnerSampleAt: true,
        enrollMode: true,
        organization: { select: { id: true, name: true } },
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
    publicAccess: c.publicAccess,
    isSample: c.isSample,
    virtualLecturerMode: c.virtualLecturerMode,
    virtualLecturerCode: c.virtualLecturerCode,
    isLearnerSample: c.learnerSampleAt !== null,
    enrollMode: c.enrollMode,
    activeAccessPlanCount: c._count.accessPlans,
    organizationId: c.organization?.id ?? null,
    organizationName: c.organization?.name ?? null,
  }));

  const byStatus = { draft: 0, published: 0, archived: 0 } as Record<string, number>;
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  return NextResponse.json({
    stats: {
      all: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      noOrg: noOrgCount,
      teacherSample: teacherSampleCount,
      learnerSample: learnerSampleCount,
    },
    courses,
    total,
    page,
    limit,
    pageCount: Math.ceil(total / limit),
  });
}
