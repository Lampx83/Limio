import { prisma } from "@feedbackme/db";
import { getLearnerSampleCourse, listCatalogSectionsForDisplay, listPublishedCourses } from "@feedbackme/core-lms";

/**
 * Dữ liệu cho trang Bắt đầu của học viên chưa có khoá (docs/hoc-vien/trang-dau-hoc-vien-AC.md).
 */

export type StartSample = NonNullable<Awaited<ReturnType<typeof getLearnerSampleCourse>>>;

export interface StartCourseCard {
  id: string;
  slug: string;
  title: string;
  level: string;
  lessonCount: number;
}

const START_COURSE_LIMIT = 3;
/** Lấy dư để còn đủ 3 khoá sau khi bỏ khoá mẫu và khoá chưa có bài. */
const CANDIDATE_LIMIT = 12;

/** Ghi danh nào còn tính là "đã có khoá": bỏ khoá đã rút/hoàn tiền. Hết hạn vẫn tính — học viên đó có lịch sử. */
export async function hasAnyCourse(userId: string): Promise<boolean> {
  const n = await prisma.enrollment.count({
    where: { userId, status: { notIn: ["dropped", "refunded"] } },
  });
  return n > 0;
}

/**
 * "Khoá đang mở" (AC4): 3 khoá đầu của mục đầu tiên quản trị sắp trong Danh mục, bỏ khoá mẫu đã hiện ở
 * "Thử học ngay". Danh mục chưa có mục nào thì lấy khoá xuất bản gần nhất — giống trang Danh mục.
 * Bỏ cả khoá chưa có bài nào hiện được: thẻ "0 bài" cho học viên mới xem chỉ là một ngõ cụt.
 */
export async function loadStartCourses(excludeCourseId: string | null): Promise<StartCourseCard[]> {
  const sections = await listCatalogSectionsForDisplay();
  const fromSection = sections[0]?.courses ?? null;
  const base =
    fromSection ??
    (await listPublishedCourses({ limit: CANDIDATE_LIMIT })).items;
  const picked = base.filter((c) => c.id !== excludeCourseId).slice(0, CANDIDATE_LIMIT);
  if (picked.length === 0) return [];

  const modules = await prisma.module.findMany({
    where: { courseId: { in: picked.map((c) => c.id) }, isHidden: false },
    select: { courseId: true, _count: { select: { lessons: { where: { isHidden: false } } } } },
  });
  const lessonCount = new Map<string, number>();
  for (const m of modules) lessonCount.set(m.courseId, (lessonCount.get(m.courseId) ?? 0) + m._count.lessons);

  return picked
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      level: c.level,
      lessonCount: lessonCount.get(c.id) ?? 0,
    }))
    .filter((c) => c.lessonCount > 0)
    .slice(0, START_COURSE_LIMIT);
}

export async function loadStartPage(): Promise<{ sample: StartSample | null; courses: StartCourseCard[] }> {
  const sample = await getLearnerSampleCourse();
  const courses = await loadStartCourses(sample?.id ?? null);
  return { sample, courses };
}
