import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageLearnerPath, listMockExamsForLearner, listMyGoals } from "@feedbackme/core-lms";
import { getFlashcardStats } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { ROLE_DEFAULT_PATH, getActiveRole } from "@/lib/active-role";
import { languageShellIsLearner } from "@/lib/languageMenu";
import { formatDayKey } from "@/lib/datetime";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import LearnerPath, { type LearnerPathGoal } from "@/components/language/LearnerPath";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  // Khách thấy trang giới thiệu (index được); người đã đăng nhập thấy dữ liệu riêng ⇒ noindex.
  return session?.user?.id ? { title: "Lộ trình của tôi — Limio Language", ...NOINDEX } : { title: "Limio Language — Speak in Flow" };
}

/**
 * LANG đợt 1 — trang chủ Limio Language. Khách: giới thiệu. Học viên: "Lộ trình của tôi". Giảng viên/admin: chuyển về
 * trang chủ của họ (vỏ giảng viên để đợt sau).
 */
export default async function LanguageHome({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <GuestIntro />;

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

  // Lỗi ở một khối phụ không được làm hỏng cả trang.
  const [cards, goals, mockExams] = await Promise.all([
    getFlashcardStats(userId, selected.id).catch(() => null),
    listMyGoals(userId).catch(() => []),
    listMockExamsForLearner(userId, selected.id).catch(() => []),
  ]);
  const g = goals.find((x) => x.courseId === selected.id && x.status === "active");
  const goal: LearnerPathGoal | null = g
    ? { level: g.targetLevel, targetDate: formatDayKey(g.targetDate), hoursPerWeek: g.hoursPerWeek }
    : null;

  return (
    <LearnerPath
      userName={session.user.name ?? "bạn"}
      path={{ ...path, selected }}
      goal={goal}
      dueCards={cards?.dueToday ?? 0}
      hasExams={mockExams.length > 0}
    />
  );
}

function GuestIntro() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-center">
      <h1 className="text-display">
        Limio <span className="text-lime-600">Language</span>
      </h1>
      <p className="font-[family-name:var(--font-script)] mt-2 text-xl italic text-lime-700">Speak in Flow</p>
      <p className="text-body mx-auto mt-6 max-w-xl">
        Học ngoại ngữ trên Limio: bài nghe, từ vựng và hội thoại có âm thanh, luyện đề và thi thử bấm giờ theo từng kỹ năng,
        góp ý bài viết và bài nói bằng AI có giảng viên duyệt.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/signin?callbackUrl=/language" className="btn-primary">
          Đăng nhập
        </Link>
        <Link href="/catalog" className="btn-ghost">
          Xem các khoá học
        </Link>
      </div>
    </main>
  );
}
