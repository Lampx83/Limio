import { unstable_cache } from "next/cache";
import { getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { countPendingAiFeedback } from "@feedbackme/core-feedback";

/**
 * LANG L2.2 — số hiện trên mục "Chờ duyệt / chấm" của menu giảng viên: bài Viết/Nói chờ chấm + góp ý AI chờ
 * duyệt. Chạy trên mọi lần chuyển trang nên cache 20 giây theo từng giảng viên (cùng cách studentMenuBadges).
 */
const cached = unstable_cache(
  async (userId: string) => {
    const o = await getLanguageTeacherOverview(userId);
    const ai = await countPendingAiFeedback(o.courses.map((c) => c.id));
    return o.pendingGradeTotal + ai.total;
  },
  ["language-teacher-review-badge"],
  { revalidate: 20, tags: ["language-review-badge"] },
);

export async function getLanguageTeacherBadges(userId: string | undefined): Promise<Record<string, { count: number }>> {
  if (!userId) return {};
  const count = await cached(userId).catch(() => 0);
  return count > 0 ? { "/language/review": { count } } : {};
}
