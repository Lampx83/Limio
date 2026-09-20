"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    avgScorePct: number | null;
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

/**
 * B13 — ba báo cáo dành cho phân tích ngoại tuyến, tách khỏi nhóm trên vì khác
 * người dùng và khác mục đích: nhóm trên để dạy học hằng ngày, nhóm này để
 * chạy số liệu. Cả ba đều mở đầu bằng cùng năm cột định danh nên ghép được
 * với nhau trong Excel hay R bằng cột nào cũng được.
 */
const RESEARCH_REPORTS: Array<{
  key: string;
  icon: string;
  title: string;
  description: string;
  endpoint: string;
}> = [
  {
    key: "research-answers",
    icon: "🧪",
    title: "Từng câu trả lời",
    description:
      "Mỗi câu một dòng: đúng/sai, độ tự tin, thời gian nghĩ riêng câu đó, số lần sửa đáp án.",
    endpoint: "research-answers",
  },
  {
    key: "research-feedback",
    icon: "💬",
    title: "Từng lượt phản hồi",
    description:
      "Toạ độ SSMMD, điều kiện lúc sinh, có bấm vào bài ôn không, học viên đánh giá thế nào.",
    endpoint: "research-feedback",
  },
  {
    key: "research-ai-tutor",
    icon: "🤖",
    title: "Hội thoại với trợ giảng AI",
    description:
      "Từng tin nhắn, nguyên văn: ai hỏi gì ở bài nào, lượt thứ mấy, tốn bao nhiêu token.",
    endpoint: "research-ai-tutor",
  },
  {
    key: "research-engagement",
    icon: "⏱️",
    title: "Hành vi đọc bài",
    description:
      "Mỗi (học viên × bài): thời gian đọc thật, cuộn sâu nhất, phần trăm video, số lượt mở.",
    endpoint: "research-engagement",
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
              label="Điểm quiz TB"
              value={
                summary.quiz.avgScorePct !== null
                  ? `${summary.quiz.avgScorePct}%`
                  : "—"
              }
              hint={`${summary.quiz.submitted} lượt nộp`}
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
        <h2 className="mb-1 text-base font-semibold">Dữ liệu nghiên cứu</h2>
        <p className="mb-3 text-xs text-muted">
          Ba tệp dưới đây có cột <strong>Lớp</strong> và <strong>Điều kiện</strong>,
          nên so sánh được hai lớp song song của cùng một khoá. Cột{" "}
          <strong>Mã ẩn danh</strong> ổn định theo từng khoá — chia sẻ dữ liệu thì
          bỏ hai cột Email và Họ tên đi là xong.
        </p>
        <ul className="space-y-2">
          {RESEARCH_REPORTS.map((r) => (
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
                className="btn-secondary btn-sm flex-shrink-0"
                download
              >
                Tải CSV
              </a>
            </li>
          ))}
        </ul>
      </section>

      <QuizResultsSection courseId={courseId} />

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

interface QuizListItem {
  id: string;
  title: string;
  moduleTitle: string | null;
  lessonTitle: string | null;
  attemptCount: number;
  questionCount: number;
}

function QuizResultsSection({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/instructor/courses/${courseId}/quizzes`),
        );
        if (!res.ok) throw new Error(`http_${res.status}`);
        const data = await res.json();
        if (!cancelled) setQuizzes(data.quizzes ?? []);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const selected = quizzes?.find((q) => q.id === selectedId);

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Kết quả từng quiz</h2>
      <p className="mb-3 text-xs text-muted">
        Chọn 1 quiz để xem danh sách SV đã làm, điểm từng người, và chi tiết
        đáp án của từng lượt làm.
      </p>
      {error ? (
        <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Lỗi tải danh sách quiz: {error}
        </p>
      ) : quizzes === null ? (
        <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-3 text-sm text-muted">
          Đang tải…
        </p>
      ) : quizzes.length === 0 ? (
        <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-3 text-sm text-muted">
          Khóa này chưa có quiz nào. Tạo quiz ở tab Nội dung trước.
        </p>
      ) : (
        <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[280px]">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">
                Chọn quiz
              </span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="input w-full"
              >
                <option value="">— Chọn quiz —</option>
                {quizzes.map((q) => {
                  const prefix =
                    q.moduleTitle && q.lessonTitle
                      ? `${q.moduleTitle} › ${q.lessonTitle} › `
                      : q.lessonTitle
                        ? `${q.lessonTitle} › `
                        : "";
                  return (
                    <option key={q.id} value={q.id}>
                      {prefix}
                      {q.title} ({q.attemptCount} lượt)
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              disabled={!selectedId}
              onClick={() =>
                router.push(
                  `/instructor/courses/${courseId}/quizzes/${selectedId}/results`,
                )
              }
              className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xem kết quả →
            </button>
          </div>
          {selected && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Meta label="Số câu" value={selected.questionCount} />
              <Meta label="Tổng lượt làm" value={selected.attemptCount} />
              <Meta
                label="Trạng thái"
                value={selected.attemptCount > 0 ? "Có dữ liệu" : "Chưa có lượt"}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.5] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
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
