import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageLearnerPath, getPracticeReviewSummary } from "@feedbackme/core-lms";
import { getFlashcardSchedule, getLanguageProfile } from "@feedbackme/core-feedback";
import { LANGUAGE_SKILL_LABEL } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import { ROLE_DEFAULT_PATH, getActiveRole } from "@/lib/active-role";
import { languageShellIsLearner } from "@/lib/languageMenu";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import ReviewSchedule from "@/components/language/ReviewSchedule";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lịch ôn tập — Limio Language", ...NOINDEX };

/**
 * LANG đợt 4 — Lịch ôn tập: thẻ từ vựng đến hạn, lịch 7 ngày tới, câu luyện nên làm lại, gợi ý "Luyện hôm nay". Chỉ ĐỌC dữ liệu
 * của chính người xem. Chưa đăng nhập → đăng nhập; giảng viên/admin → trang chủ của họ (như `/language`).
 */
export default async function ReviewSchedulePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/language/lich-on-tap");
  const activeRole = getActiveRole(session.user.roles ?? []);
  if (!languageShellIsLearner(activeRole)) redirect(ROLE_DEFAULT_PATH[activeRole] ?? "/instructor/dashboard");

  const course = typeof searchParams.course === "string" ? searchParams.course : null;
  const path = await getLanguageLearnerPath(userId, course);
  if (!path.selected) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          title="Bạn chưa học khoá ngoại ngữ nào"
          description="Tìm một khoá trong danh mục, hoặc dùng đường dẫn mời của giảng viên."
          actions={[{ label: "Xem danh mục khoá học", href: "/catalog", variant: "primary" }]}
        />
      </main>
    );
  }
  const selected = path.selected;

  // Lỗi ở một khối không được làm hỏng cả trang.
  const [schedule, practice, profile] = await Promise.all([
    getFlashcardSchedule(userId, selected.id, 7).catch(() => null),
    getPracticeReviewSummary(userId, selected.id).catch(() => []),
    getLanguageProfile(userId, selected.id, "learner").catch(() => null),
  ]);
  const days = (schedule?.days ?? []).map((d) => ({ dayStart: d.dayStart.toISOString(), count: d.count }));
  const s = profile?.enabled ? profile.suggestion : null;

  return (
    <ReviewSchedule
      courses={path.courses}
      selected={selected}
      dueToday={days[0]?.count ?? 0}
      days={days}
      practice={practice}
      suggestion={s ? { skillLabel: LANGUAGE_SKILL_LABEL[s.skill], lessonId: s.lessonId, lessonTitle: s.lessonTitle, reason: s.reason } : null}
    />
  );
}
