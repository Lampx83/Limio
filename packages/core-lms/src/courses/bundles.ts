/**
 * Combo khoá học (docs/tieu-chi/combo-khoa-hoc.md): bán trọn bộ nhiều khoá bằng một lần thanh toán.
 *
 * Chỉ admin nền tảng tạo / sửa / xuất bản (đụng giá bán thật, cùng quy tắc với CourseAccessPlan). Việc cấp quyền
 * khi đơn paid nằm ở learning/bundleAccess.ts (đi chung đường extendEnrollmentAccess với mua lẻ).
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { CourseAuthzError } from "./authz";

export class BundleError extends Error {
  constructor(
    public readonly code: "validation_failed" | "slug_taken" | "not_found" | "courses_not_published" | "course_not_found",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CreateBundleInput = z
  .object({
    slug: z.string().min(2).max(80).regex(SLUG_RE),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(20_000).optional(),
    coverUrl: z.string().max(500).nullable().optional(),
    priceCents: z.number().int().min(1),
    originalPriceCents: z.number().int().min(1).nullable().optional(),
    /** null = vĩnh viễn. */
    durationMonths: z.number().int().min(1).max(120).nullable(),
    courseIds: z.array(z.string().min(1)).min(2).max(50),
  })
  .refine((v) => new Set(v.courseIds).size === v.courseIds.length, { message: "duplicate_course" })
  .refine((v) => v.originalPriceCents == null || v.originalPriceCents > v.priceCents, {
    message: "original_not_greater",
    path: ["originalPriceCents"],
  });
export type CreateBundleInput = z.infer<typeof CreateBundleInput>;

const UpdateBundleInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  coverUrl: z.string().max(500).nullable().optional(),
  priceCents: z.number().int().min(1).optional(),
  originalPriceCents: z.number().int().min(1).nullable().optional(),
  durationMonths: z.number().int().min(1).max(120).nullable().optional(),
  courseIds: z.array(z.string().min(1)).min(2).max(50).optional(),
});
export type UpdateBundleInput = z.infer<typeof UpdateBundleInput>;

async function assertAdmin(actorUserId: string, db: PrismaClient): Promise<void> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseAuthzError("forbidden");
}

async function assertCoursesExist(courseIds: string[], db: PrismaClient): Promise<void> {
  const found = await db.course.findMany({ where: { id: { in: courseIds } }, select: { id: true } });
  const missing = courseIds.filter((id) => !found.some((c) => c.id === id));
  if (missing.length) throw new BundleError("course_not_found", { courseIds: missing });
}

export async function createBundle(actorUserId: string, rawInput: unknown, db: PrismaClient = prisma) {
  await assertAdmin(actorUserId, db);
  const parsed = CreateBundleInput.safeParse(rawInput);
  if (!parsed.success) throw new BundleError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  await assertCoursesExist(input.courseIds, db);
  if (await db.courseBundle.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
    throw new BundleError("slug_taken");
  }

  const bundle = await db.courseBundle.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description ?? "",
      coverUrl: input.coverUrl ?? null,
      priceCents: input.priceCents,
      originalPriceCents: input.originalPriceCents ?? null,
      durationMonths: input.durationMonths,
      createdBy: actorUserId,
      items: { create: input.courseIds.map((courseId, orderIndex) => ({ courseId, orderIndex })) },
    },
    select: { id: true, slug: true },
  });
  // Payload chỉ mang id, slug và số liệu (không mang mô tả).
  await logAudit(
    {
      action: "course.bundle.created",
      actorUserId,
      payload: { bundleId: bundle.id, slug: bundle.slug, courses: input.courseIds.length, priceCents: input.priceCents },
    },
    db,
  );
  return bundle;
}

export async function updateBundle(actorUserId: string, bundleId: string, rawInput: unknown, db: PrismaClient = prisma) {
  await assertAdmin(actorUserId, db);
  const parsed = UpdateBundleInput.safeParse(rawInput);
  if (!parsed.success) throw new BundleError("validation_failed", parsed.error.flatten());
  const input = parsed.data;
  const cur = await db.courseBundle.findUnique({ where: { id: bundleId } });
  if (!cur) throw new BundleError("not_found");

  const nextPrice = input.priceCents ?? cur.priceCents;
  const nextOriginal = input.originalPriceCents === undefined ? cur.originalPriceCents : input.originalPriceCents;
  if (nextOriginal != null && nextOriginal <= nextPrice) {
    throw new BundleError("validation_failed", { originalPriceCents: "Giá gốc phải lớn hơn giá bán." });
  }
  if (input.courseIds) {
    if (new Set(input.courseIds).size !== input.courseIds.length) throw new BundleError("validation_failed", { courseIds: "duplicate_course" });
    await assertCoursesExist(input.courseIds, db);
  }

  await db.$transaction(async (tx) => {
    await tx.courseBundle.update({
      where: { id: bundleId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.originalPriceCents !== undefined ? { originalPriceCents: input.originalPriceCents } : {}),
        ...(input.durationMonths !== undefined ? { durationMonths: input.durationMonths } : {}),
      },
    });
    if (input.courseIds) {
      await tx.courseBundleItem.deleteMany({ where: { bundleId } });
      await tx.courseBundleItem.createMany({
        data: input.courseIds.map((courseId, orderIndex) => ({ bundleId, courseId, orderIndex })),
      });
    }
  });
  await logAudit(
    {
      action: "course.bundle.updated",
      actorUserId,
      payload: { bundleId, fields: Object.keys(input).filter((k) => (input as Record<string, unknown>)[k] !== undefined) },
    },
    db,
  );
}

/** Xuất bản: mọi khoá trong combo phải đang published. */
export async function publishBundle(actorUserId: string, bundleId: string, db: PrismaClient = prisma) {
  await assertAdmin(actorUserId, db);
  const bundle = await db.courseBundle.findUnique({
    where: { id: bundleId },
    include: { items: { include: { course: { select: { id: true, slug: true, status: true } } } } },
  });
  if (!bundle) throw new BundleError("not_found");
  const notPublished = bundle.items.filter((i) => i.course.status !== "published").map((i) => i.course.slug);
  if (notPublished.length) throw new BundleError("courses_not_published", { courses: notPublished });
  await db.courseBundle.update({ where: { id: bundleId }, data: { status: "published", publishedAt: new Date() } });
  await logAudit({ action: "course.bundle.published", actorUserId, payload: { bundleId, slug: bundle.slug } }, db);
}

// ── Đọc công khai ────────────────────────────────────────────────────────

export interface BundleCourseView {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  lessonCount: number;
  published: boolean;
  /** Giá bán lẻ hiện hành (gói rẻ nhất, hoặc giá phẳng); 0 = miễn phí / không có giá. */
  retailCents: number;
  retailCurrency: string;
}

export interface BundleView {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string | null;
  currency: string;
  priceCents: number;
  originalPriceCents: number | null;
  durationMonths: number | null;
  status: string;
  courses: BundleCourseView[];
  /** Tổng giá lẻ hiện hành của các khoá khi cùng tiền tệ với combo; null khi không so được. */
  retailTotalCents: number | null;
  /** Tiền tiết kiệm so với mua lẻ (> 0), hoặc null khi combo không rẻ hơn / không so được. */
  savingsCents: number | null;
  /** Mọi khoá đang published → mua được. */
  purchasable: boolean;
}

/** Tiết kiệm = tổng giá lẻ − giá combo, chỉ khi dương. Hàm thuần, có test riêng. */
export function bundleSavings(retailTotalCents: number | null, priceCents: number): number | null {
  if (retailTotalCents === null) return null;
  const s = retailTotalCents - priceCents;
  return s > 0 ? s : null;
}

/** Combo published theo slug; combo nháp chỉ trả về khi `allowDraft` (admin xem trước). */
export async function getBundleBySlug(
  slug: string,
  opts: { allowDraft?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<BundleView | null> {
  const b = await db.courseBundle.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { orderIndex: "asc" },
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              coverUrl: true,
              status: true,
              priceCents: true,
              currency: true,
              accessPlans: { where: { isActive: true }, orderBy: { priceCents: "asc" }, take: 1, select: { priceCents: true, currency: true } },
              modules: { select: { _count: { select: { lessons: true } } } },
            },
          },
        },
      },
    },
  });
  if (!b) return null;
  if (b.status !== "published" && !opts.allowDraft) return null;

  const courses: BundleCourseView[] = b.items.map((i) => {
    const plan = i.course.accessPlans[0];
    const retailCents = plan ? plan.priceCents : (i.course.priceCents ?? 0);
    return {
      id: i.course.id,
      slug: i.course.slug,
      title: i.course.title,
      coverUrl: i.course.coverUrl,
      lessonCount: i.course.modules.reduce((n, m) => n + m._count.lessons, 0),
      published: i.course.status === "published",
      retailCents,
      retailCurrency: plan ? plan.currency : i.course.currency,
    };
  });
  const comparable = courses.every((c) => c.retailCents > 0 && c.retailCurrency === b.currency);
  const retailTotalCents = comparable ? courses.reduce((n, c) => n + c.retailCents, 0) : null;
  return {
    id: b.id,
    slug: b.slug,
    title: b.title,
    description: b.description,
    coverUrl: b.coverUrl,
    currency: b.currency,
    priceCents: b.priceCents,
    originalPriceCents: b.originalPriceCents,
    durationMonths: b.durationMonths,
    status: b.status,
    courses,
    retailTotalCents,
    savingsCents: bundleSavings(retailTotalCents, b.priceCents),
    purchasable: b.status === "published" && courses.every((c) => c.published),
  };
}

/** Các khoá của combo mà người dùng đang có quyền (ghi danh active/completed, còn hạn). */
export async function ownedCourseIdsInBundle(userId: string, bundleId: string, db: PrismaClient = prisma): Promise<string[]> {
  const now = new Date();
  const rows = await db.enrollment.findMany({
    where: {
      userId,
      status: { in: ["active", "completed"] },
      OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }],
      course: { bundleItems: { some: { bundleId } } },
    },
    select: { courseId: true },
  });
  return rows.map((r) => r.courseId);
}
