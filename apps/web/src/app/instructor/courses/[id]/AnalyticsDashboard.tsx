"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";

interface Summary {
  enrollment: {
    total: number;
    active: number;
    completed: number;
    dropped: number;
    refunded: number;
  };
  lessonsCount: number;
  avgLessonCompletionPct: number;
  quiz: {
    submitted: number;
    passed: number;
    passRatePct: number | null;
  };
  activeLearners7d: number;
}

const REPORTS: Array<{
  key: string;
  icon: string;
  title: string;
  description: string;
  endpoint: string;
}> = [
  {
    key: "enrollments",
    icon: "👥",
    title: "Danh sách enrollment",
    description: "Học viên đã đăng ký, status, ngày bắt đầu/hoàn thành.",
    endpoint: "enrollments",
  },
  {
    key: "lesson-progress",
    icon: "📊",
    title: "Tiến độ bài học (long format)",
    description:
      "Mỗi học viên × mỗi bài: chưa bắt đầu / đã xem / hoàn thành — pivot trong Excel.",
    endpoint: "lesson-progress",
  },
  {
    key: "quiz-gradebook",
    icon: "❓",
    title: "Gradebook quiz",
    description:
      "Mọi attempt: điểm %, đạt/không đạt, bao nhiêu câu, thời gian nộp.",
    endpoint: "quiz-gradebook",
  },
  {
    key: "assignment-gradebook",
    icon: "📋",
    title: "Gradebook assignment",
    description: "Bài nộp + status chấm + điểm + người chấm + hạn nộp.",
    endpoint: "assignment-gradebook",
  },
];

export default function AnalyticsDashboard({
  courseId,
}: {
  courseId: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          apiUrl(`/api/instructor/courses/${courseId}/analytics/summary`),
        );
        if (!res.ok) throw new Error(`http_${res.status}`);
        const data = await res.json();
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-base font-semibold">Tổng quan nhanh</h2>
        {loading ? (
          <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-6 text-center text-sm text-muted">
            Đang tải...
          </p>
        ) : error ? (
          <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            Lỗi tải summary: {error}
          </p>
        ) : summary ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              icon="👥"
              label="Tổng enroll"
              value={summary.enrollment.total}
              hint={`${summary.enrollment.active} đang học · ${summary.enrollment.completed} hoàn thành`}
            />
            <SummaryCard
              icon="📊"
              label="Avg tiến độ bài"
              value={`${summary.avgLessonCompletionPct}%`}
              hint={`Trên ${summary.lessonsCount} bài`}
            />
            <SummaryCard
              icon="❓"
              label="Quiz pass rate"
              value={
                summary.quiz.passRatePct !== null
                  ? `${summary.quiz.passRatePct}%`
                  : "—"
              }
              hint={`${summary.quiz.passed}/${summary.quiz.submitted} attempt`}
            />
            <SummaryCard
              icon="🔥"
              label="Active 7 ngày"
              value={summary.activeLearners7d}
              hint="Có view bài/làm quiz/nộp bài"
            />
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Báo cáo có thể tải</h2>
        <ul className="space-y-2">
          {REPORTS.map((r) => (
            <li
              key={r.key}
              className="flex items-start gap-4 rounded-xl border border-token bg-[rgb(var(--surface))] p-4 transition-colors hover:bg-[rgb(var(--surface-muted))/0.3]"
            >
              <span className="text-2xl" aria-hidden>
                {r.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted">{r.description}</p>
              </div>
              <a
                href={apiUrl(
                  `/api/instructor/courses/${courseId}/analytics/exports/${r.endpoint}`,
                )}
                className="btn-primary btn-sm flex-shrink-0"
                download
              >
                Tải CSV
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Khác</h2>
        <Link
          href={`/instructor/courses/${courseId}/struggling-students`}
          className="card-hover block"
        >
          <p className="font-semibold">Học viên cần hỗ trợ →</p>
          <p className="mt-1 text-xs text-muted">
            Xem learner đang gặp khó: mastery thấp, dropoff, fail nhiều quiz.
          </p>
        </Link>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-faint">
          {label}
        </p>
        <span aria-hidden className="text-base">
          {icon}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
