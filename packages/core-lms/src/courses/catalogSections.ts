/**
 * A2.6 — Catalog curated sections.
 *
 * `/catalog` là 1 trang public chung cho toàn hệ thống (không lọc theo
 * Organization), nên section cũng global — quản lý bởi Platform Admin
 * (`isAdmin`), không phải OrgAdmin.
 *
 * type = MANUAL: admin tự chọn course + thứ tự qua CatalogSectionCourse.
 * type = AUTO_RECENT: không cần curate tay, tự lấy N course published gần
 * nhất theo publishedAt desc (limit = autoLimit, mặc định 8).
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin } from "../auth/roles";

export class CatalogSectionError extends Error {
  constructor(
    public readonly code: "validation_failed" | "not_found" | "forbidden",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

async function assertPlatformAdmin(
  actorUserId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await isAdmin(actorUserId, db))) throw new CatalogSectionError("forbidden");
}

const DEFAULT_AUTO_LIMIT = 8;

export const CreateCatalogSectionInput = z.object({
  title: z.string().min(1).max(200).trim(),
  type: z.enum(["MANUAL", "AUTO_RECENT"]),
  autoLimit: z.number().int().min(1).max(50).optional(),
});

export const UpdateCatalogSectionInput = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  isActive: z.boolean().optional(),
  autoLimit: z.number().int().min(1).max(50).optional().nullable(),
});

export interface CatalogSectionRow {
  id: string;
  title: string;
  type: "MANUAL" | "AUTO_RECENT";
  order: number;
  isActive: boolean;
  autoLimit: number | null;
}

const COURSE_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  level: true,
  category: true,
  language: true,
  coverUrl: true,
  priceCents: true,
  currency: true,
  personalizationEnabled: true,
  // Khoá bán theo CourseAccessPlan (1 năm/2 năm/vĩnh viễn) có thể không có
  // priceCents phẳng — card cần biết "từ giá nào" thay vì hiện nhầm "Miễn phí".
  accessPlans: {
    where: { isActive: true },
    orderBy: { priceCents: "asc" as const },
    take: 1,
    select: { priceCents: true, currency: true },
  },
} as const;

export type CatalogSectionCourseCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  category: string | null;
  language: string;
  coverUrl: string | null;
  priceCents: number | null;
  currency: string;
  personalizationEnabled: boolean;
  cheapestAccessPlan: { priceCents: number; currency: string } | null;
};

function toCourseCardData<T extends { accessPlans: { priceCents: number; currency: string }[] }>(
  course: T,
): Omit<T, "accessPlans"> & { cheapestAccessPlan: { priceCents: number; currency: string } | null } {
  const { accessPlans, ...rest } = course;
  return { ...rest, cheapestAccessPlan: accessPlans[0] ?? null };
}

export interface CatalogSectionWithCourses extends CatalogSectionRow {
  courses: CatalogSectionCourseCard[];
}

/**
 * Public — sections cho trang catalog mặc định (không filter). Chỉ trả về
 * section active VÀ có ít nhất 1 course published để hiển thị; caller fallback
 * về list phẳng khi mảng trả về rỗng (org/hệ thống chưa curate section nào,
 * hoặc mọi section hiện đều rỗng).
 */
export async function listCatalogSectionsForDisplay(
  db: PrismaClient = prisma,
): Promise<CatalogSectionWithCourses[]> {
  const sections = await db.catalogSection.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  if (sections.length === 0) return [];

  const result: CatalogSectionWithCourses[] = [];
  for (const s of sections) {
    const courses =
      s.type === "AUTO_RECENT"
        ? (
            await db.course.findMany({
              where: { status: "published" },
              orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
              take: s.autoLimit ?? DEFAULT_AUTO_LIMIT,
              select: COURSE_CARD_SELECT,
            })
          ).map(toCourseCardData)
        : (
            await db.catalogSectionCourse.findMany({
              where: { sectionId: s.id, course: { status: "published" } },
              orderBy: { order: "asc" },
              select: { course: { select: COURSE_CARD_SELECT } },
            })
          ).map((l) => toCourseCardData(l.course));

    if (courses.length === 0) continue;
    result.push({
      id: s.id,
      title: s.title,
      type: s.type,
      order: s.order,
      isActive: s.isActive,
      autoLimit: s.autoLimit,
      courses,
    });
  }
  return result;
}

/** Admin — toàn bộ section (kể cả inactive/rỗng) cho trang quản trị. */
export async function listCatalogSectionsForAdmin(
  actorUserId: string,
  db: PrismaClient = prisma,
): Promise<Array<CatalogSectionRow & { courseCount: number }>> {
  await assertPlatformAdmin(actorUserId, db);
  const sections = await db.catalogSection.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: true } } },
  });
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    type: s.type,
    order: s.order,
    isActive: s.isActive,
    autoLimit: s.autoLimit,
    courseCount: s._count.courses,
  }));
}

/** Admin — course hiện có trong 1 section MANUAL, theo đúng thứ tự curate. */
export async function listCoursesInSection(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<Array<{ id: string; title: string; slug: string; status: string }>> {
  await assertPlatformAdmin(actorUserId, db);
  const links = await db.catalogSectionCourse.findMany({
    where: { sectionId },
    orderBy: { order: "asc" },
    select: { course: { select: { id: true, title: true, slug: true, status: true } } },
  });
  return links.map((l) => l.course);
}

export async function createCatalogSection(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<CatalogSectionRow> {
  await assertPlatformAdmin(actorUserId, db);
  const parsed = CreateCatalogSectionInput.safeParse(rawInput);
  if (!parsed.success) throw new CatalogSectionError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const maxOrder = await db.catalogSection.aggregate({ _max: { order: true } });
  const section = await db.catalogSection.create({
    data: {
      title: d.title,
      type: d.type,
      autoLimit: d.type === "AUTO_RECENT" ? (d.autoLimit ?? DEFAULT_AUTO_LIMIT) : null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return toRow(section);
}

export async function updateCatalogSection(
  actorUserId: string,
  sectionId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<CatalogSectionRow> {
  await assertPlatformAdmin(actorUserId, db);
  const existing = await db.catalogSection.findUnique({ where: { id: sectionId } });
  if (!existing) throw new CatalogSectionError("not_found");

  const parsed = UpdateCatalogSectionInput.safeParse(rawInput);
  if (!parsed.success) throw new CatalogSectionError("validation_failed", parsed.error.flatten());
  const d = parsed.data;

  const section = await db.catalogSection.update({
    where: { id: sectionId },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      ...(d.autoLimit !== undefined && existing.type === "AUTO_RECENT"
        ? { autoLimit: d.autoLimit ?? DEFAULT_AUTO_LIMIT }
        : {}),
    },
  });
  return toRow(section);
}

export async function deleteCatalogSection(
  actorUserId: string,
  sectionId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);
  const existing = await db.catalogSection.findUnique({ where: { id: sectionId } });
  if (!existing) throw new CatalogSectionError("not_found");
  await db.catalogSection.delete({ where: { id: sectionId } });
}

export async function reorderCatalogSections(
  actorUserId: string,
  orderedSectionIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);
  if (orderedSectionIds.length === 0) return;
  await db.$transaction(
    orderedSectionIds.map((id, idx) =>
      db.catalogSection.update({ where: { id }, data: { order: idx } }),
    ),
  );
}

export async function addCourseToSection(
  actorUserId: string,
  sectionId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);
  const section = await db.catalogSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new CatalogSectionError("not_found");
  if (section.type !== "MANUAL")
    throw new CatalogSectionError("validation_failed", { reason: "not_manual_section" });

  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new CatalogSectionError("validation_failed", { reason: "course_not_found" });

  const maxOrder = await db.catalogSectionCourse.aggregate({
    where: { sectionId },
    _max: { order: true },
  });
  await db.catalogSectionCourse.upsert({
    where: { sectionId_courseId: { sectionId, courseId } },
    create: { sectionId, courseId, order: (maxOrder._max.order ?? -1) + 1 },
    update: {},
  });
}

export async function removeCourseFromSection(
  actorUserId: string,
  sectionId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);
  await db.catalogSectionCourse.deleteMany({ where: { sectionId, courseId } });
}

export async function reorderCoursesInSection(
  actorUserId: string,
  sectionId: string,
  orderedCourseIds: string[],
  db: PrismaClient = prisma,
): Promise<void> {
  await assertPlatformAdmin(actorUserId, db);
  if (orderedCourseIds.length === 0) return;
  await db.$transaction(
    orderedCourseIds.map((courseId, idx) =>
      db.catalogSectionCourse.update({
        where: { sectionId_courseId: { sectionId, courseId } },
        data: { order: idx },
      }),
    ),
  );
}

function toRow(s: {
  id: string;
  title: string;
  type: "MANUAL" | "AUTO_RECENT";
  order: number;
  isActive: boolean;
  autoLimit: number | null;
}): CatalogSectionRow {
  return {
    id: s.id,
    title: s.title,
    type: s.type,
    order: s.order,
    isActive: s.isActive,
    autoLimit: s.autoLimit,
  };
}
