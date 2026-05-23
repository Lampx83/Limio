import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCourseProgress,
  listEnrollmentsForUser,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  active: "chip-brand",
  completed: "chip-success",
  paused: "chip-accent",
  cancelled: "chip-danger",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Đang học",
  completed: "Hoàn thành",
  paused: "Tạm dừng",
  cancelled: "Đã hủy",
};

export default async function MyEnrollmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/enrollments");
  const userId = session.user.id;

  const enrollments = await listEnrollmentsForUser(userId);
  const withProgress = await Promise.all(
    enrollments.map(async (e) => {
      const progress = await getCourseProgress(userId, e.courseId);
      return { e, progress };
    }),
  );

  const totalLessons = withProgress.reduce((s, x) => s + x.progress.totalLessons, 0);
  const completedLessons = withProgress.reduce(
    (s, x) => s + x.progress.completedLessons,
    0,
  );
  const completedCourses = withProgress.filter(
    (x) => x.progress.courseCompletionPct >= 100,
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-brand">Học viên</span>
          <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
            Khóa học của tôi
          </h1>
          <p className="mt-2 text-muted">
            {withProgress.length > 0
              ? `Bạn đang học ${withProgress.length} khóa`
              : "Bạn chưa enroll khóa học nào."}
          </p>
        </div>
        <Link href="/catalog" className="btn-secondary btn-sm">
          + Thêm khóa từ catalog
        </Link>
      </div>

      {/* Quick stats */}
      {withProgress.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <Stat label="Khóa đang học" value={withProgress.length} tone="brand" />
          <Stat
            label="Bài đã hoàn thành"
            value={`${completedLessons}/${totalLessons}`}
            tone="accent"
          />
          <Stat label="Khóa đã xong" value={completedCourses} tone="success" />
        </div>
      )}

      {withProgress.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                      </div>
          <p className="mt-4 text-muted">
            Bạn chưa enroll khóa học nào. Khám phá catalog để bắt đầu.
          </p>
          <Link href="/catalog" className="btn-primary mt-5 inline-flex">
            Đến catalog →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {withProgress.map(({ e, progress }) => {
            const pct = progress.courseCompletionPct;
            const isDone = pct >= 100;
            return (
              <li key={e.id}>
                <Link
                  href={`/learn/${e.course.slug}`}
                  className="card-hover group block h-full"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-snug transition-colors group-hover:text-brand-600">
                      {e.course.title}
                    </h2>
                    <span className={STATUS_TONE[e.status] ?? "chip"}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted">Tiến độ</span>
                      <span className="font-semibold tabular-nums text-[rgb(var(--text))]">
                        {pct}%{" "}
                        <span className="text-faint">
                          · {progress.completedLessons}/{progress.totalLessons} bài
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[rgb(var(--surface-muted))]">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isDone
                            ? "bg-success-500"
                            : "bg-gradient-to-r from-brand-500 to-brand-700"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-token pt-3 text-xs">
                    <span className="text-faint">
                      {isDone ? "Đã hoàn thành" : "Tiếp tục học"}
                    </span>
                    <span className="font-medium text-brand-600">→</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "brand" | "accent" | "success";
}) {
  const toneClass = {
    brand: "text-brand-600",
    accent: "text-accent-600",
    success: "text-success-600",
  }[tone];
  return (
    <div className="card">
      <div className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
    </div>
  );
}
