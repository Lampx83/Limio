import { prisma } from "@feedbackme/db";
import { cleanQuery, foldVi, matchScore, type SearchHit } from "./instructorSearchShared";

/** Mỗi nhóm hiện tối đa bấy nhiêu dòng trong danh sách gợi ý. */
const PER_GROUP = 4;
/** Trần số tiêu đề đọc về để so khớp. So khớp làm trong bộ nhớ (để gõ không dấu vẫn ra), nên cần chặn kích cỡ. */
const CANDIDATE_CAP = { courses: 300, lessons: 3000, exams: 500, decks: 500 } as const;

const EXAM_STATUS: Record<string, string> = { draft: "Nháp", published: "Đã publish", archived: "Lưu trữ" };

function topHits(hits: Array<SearchHit & { score: number }>): SearchHit[] {
  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER_GROUP)
    .map(({ score: _score, ...hit }) => hit);
}

/**
 * Tìm trong những thứ của riêng giảng viên: khoá mình dạy, bài trong các khoá đó, đề thi (của khoá mình dạy hoặc đề
 * độc lập mình tạo) và slide mình soạn. Phạm vi lấy theo cùng quy tắc với các trang danh sách tương ứng, nên ô tìm
 * kiếm không bao giờ cho thấy thứ mà trang danh sách giấu. Trả về mảng phẳng, đã sắp theo nhóm rồi theo độ khớp.
 */
export async function searchInstructorContent(userId: string, rawQuery: string): Promise<SearchHit[]> {
  const q = foldVi(cleanQuery(rawQuery));
  if (!q) return [];

  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    take: CANDIDATE_CAP.courses,
    select: { id: true, title: true, status: true, _count: { select: { enrollments: true } } },
  });
  const courseIds = courses.map((c) => c.id);
  const courseTitle = new Map(courses.map((c) => [c.id, c.title] as const));

  const [lessons, exams, decks] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve([])
      : prisma.lesson.findMany({
          where: { module: { courseId: { in: courseIds } } },
          orderBy: { updatedAt: "desc" },
          take: CANDIDATE_CAP.lessons,
          select: { id: true, title: true, module: { select: { courseId: true } } },
        }),
    prisma.exam.findMany({
      where: {
        kind: "written",
        OR: [...(courseIds.length > 0 ? [{ courseId: { in: courseIds } }] : []), { courseId: null, createdById: userId }],
      },
      orderBy: { updatedAt: "desc" },
      take: CANDIDATE_CAP.exams,
      select: { id: true, title: true, status: true },
    }),
    prisma.liveDeck.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: CANDIDATE_CAP.decks,
      select: { id: true, title: true },
    }),
  ]);

  const courseHits = topHits(
    courses.map((c) => ({
      kind: "course" as const,
      id: c.id,
      title: c.title,
      meta: `${c.status === "draft" ? "Nháp" : "Đang mở"} · ${c._count.enrollments} học viên`,
      href: `/instructor/courses/${c.id}`,
      score: matchScore(c.title, q),
    })),
  );
  const lessonHits = topHits(
    lessons.map((l) => ({
      kind: "lesson" as const,
      id: l.id,
      title: l.title,
      meta: courseTitle.get(l.module.courseId) ?? "",
      href: `/instructor/courses/${l.module.courseId}?tab=content&lesson=${l.id}`,
      score: matchScore(l.title, q),
    })),
  );
  const examHits = topHits(
    exams.map((e) => ({
      kind: "exam" as const,
      id: e.id,
      title: e.title,
      meta: EXAM_STATUS[e.status] ?? "",
      href: `/instructor/exams/${e.id}`,
      score: matchScore(e.title, q),
    })),
  );
  const slideHits = topHits(
    decks.map((d) => ({
      kind: "slide" as const,
      id: d.id,
      title: d.title,
      meta: "Slide",
      href: `/instructor/limio-live/${d.id}`,
      score: matchScore(d.title, q),
    })),
  );

  return [...courseHits, ...lessonHits, ...examHits, ...slideHits];
}
