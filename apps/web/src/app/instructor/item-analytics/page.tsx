import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  ITEM_ANALYTICS_MIN_ATTEMPTS,
  listBankItemAnalytics,
  listExamItemAnalytics,
  type ItemAnalyticsRow,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Tab = "exam" | "bank";

export default async function ItemAnalyticsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; examId?: string; bankId?: string; expand?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/item-analytics");
  }
  const userId = session.user.id;
  const tab: Tab = searchParams?.tab === "bank" ? "bank" : "exam";

  // Exams the instructor can see (= exams in courses they instruct).
  const exams = await prisma.exam.findMany({
    where: { course: { instructors: { some: { userId } } } },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      course: { select: { id: true, title: true } },
    },
    take: 200,
  });

  // Banks owned by actor + course-shared banks where actor is an instructor.
  const ownedCourseIds = (
    await prisma.courseInstructor.findMany({
      where: { userId },
      select: { courseId: true },
    })
  ).map((r) => r.courseId);
  const banks = await prisma.questionBank.findMany({
    where: {
      OR: [
        { ownerUserId: userId },
        ...(ownedCourseIds.length > 0
          ? [{ visibility: "course" as const, courseId: { in: ownedCourseIds } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
    take: 200,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="h-display text-3xl font-bold sm:text-4xl">
          Phân tích item
          <span className="ml-2 align-middle text-sm font-normal text-faint">
            (CTT — Classical Test Theory)
          </span>
        </h1>
        <p className="mt-2 text-muted">
          Độ khó (p), độ phân biệt (point-biserial), và phân tích distractor cho
          từng câu hỏi. Tính nightly 02:00 từ các attempt đã submit. Câu có
          n &lt; {ITEM_ANALYTICS_MIN_ATTEMPTS} attempt hiển thị "chưa đủ dữ liệu".
        </p>
      </header>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-token">
        <TabLink href="/instructor/item-analytics?tab=exam" active={tab === "exam"}>
          Theo đề thi
        </TabLink>
        <TabLink href="/instructor/item-analytics?tab=bank" active={tab === "bank"}>
          Theo ngân hàng câu hỏi
        </TabLink>
      </div>

      {tab === "exam" ? (
        <ExamTab
          userId={userId}
          exams={exams}
          examId={searchParams?.examId}
          expand={searchParams?.expand}
        />
      ) : (
        <BankTab userId={userId} banks={banks} bankId={searchParams?.bankId} />
      )}
    </main>
  );
}

async function ExamTab({
  userId,
  exams,
  examId,
  expand,
}: {
  userId: string;
  exams: { id: string; title: string; course: { id: string; title: string } }[];
  examId?: string;
  expand?: string;
}) {
  if (exams.length === 0) {
    return (
      <EmptyState>
        Bạn chưa là instructor của khoá nào có đề thi. Tạo đề thi từ trang khoá học trước.
      </EmptyState>
    );
  }
  const firstExam = exams[0]!;
  const selectedId = examId && exams.some((e) => e.id === examId) ? examId : firstExam.id;

  let data: Awaited<ReturnType<typeof listExamItemAnalytics>> | null = null;
  let err: string | null = null;
  try {
    data = await listExamItemAnalytics(userId, selectedId);
  } catch (e) {
    err = e instanceof Error ? e.message : "unknown_error";
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="exam-picker"
          className="text-xs font-semibold uppercase tracking-wide text-faint"
        >
          Đề thi:
        </label>
        <form>
          <select
            id="exam-picker"
            name="examId"
            defaultValue={selectedId}
            className="rounded-md border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm"
            // Submit on change via small inline script-free hack: wrap in <form>
            // with method GET — but Server Components can't add onChange. Use a
            // labelled list of links instead for keyboard/no-JS.
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {e.course.title}
              </option>
            ))}
          </select>
          <input type="hidden" name="tab" value="exam" />
          <button
            type="submit"
            className="ml-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Xem
          </button>
        </form>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-danger-300 bg-danger-50 p-4 text-sm text-danger-700">
          Lỗi: {err}
        </div>
      )}

      {data && <ExamAnalyticsTable result={data} expand={expand} />}
    </section>
  );
}

function ExamAnalyticsTable({
  result,
  expand,
}: {
  result: Awaited<ReturnType<typeof listExamItemAnalytics>>;
  expand?: string;
}) {
  if (result.rows.length === 0) {
    return (
      <EmptyState>
        Đề này chưa có câu hỏi nào. Thêm câu trước khi xem phân tích.
      </EmptyState>
    );
  }

  // Sort: severity desc. negative D first, then "needs review", then OK, then not-enough.
  const sorted = [...result.rows].sort((a, b) => severity(b) - severity(a));

  const summary = summarize(result.rows);

  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Tổng câu" value={result.rows.length} tone="brand" />
        <Kpi
          label="Đảo dấu (D<0)"
          value={summary.negativeD}
          tone={summary.negativeD > 0 ? "danger" : "success"}
        />
        <Kpi
          label="Cần review"
          value={summary.needsReview}
          tone={summary.needsReview > 0 ? "accent" : "success"}
        />
        <Kpi
          label="Chưa đủ dữ liệu"
          value={summary.notEnough}
          tone={summary.notEnough === result.rows.length ? "accent" : "brand"}
        />
      </section>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-muted))]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Câu hỏi</th>
              <th className="px-3 py-3 text-center">Loại</th>
              <th className="px-3 py-3 text-right">n</th>
              <th className="px-3 py-3 text-center">p (độ khó)</th>
              <th className="px-3 py-3 text-center">D (phân biệt)</th>
              <th className="px-3 py-3">Skill</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {sorted.map((row) => {
              const isExpanded = expand === row.questionId;
              const canExpand =
                (row.type === "mcq" || row.type === "multi") &&
                row.distractorStats !== null;
              return (
                <>
                  <tr key={row.questionId} className="align-top">
                    <td className="px-3 py-3 tabular-nums text-faint">
                      {row.orderInExam + 1}
                    </td>
                    <td className="px-3 py-3">
                      <p className="max-w-md truncate" title={row.prompt}>
                        {row.prompt}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-[10px]">
                        {row.type}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {row.attemptCount}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PValueChip p={row.pValue} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <DChip d={row.discrimination} />
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {row.skillTags.length === 0 ? (
                        <span className="text-danger-600">Chưa tag</span>
                      ) : (
                        row.skillTags.map((t) => t.skillName).join(", ")
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <StatusChip row={row} />
                    </td>
                    <td className="px-3 py-3">
                      {canExpand && (
                        <Link
                          href={
                            isExpanded
                              ? `/instructor/item-analytics?tab=exam&examId=${result.exam.id}`
                              : `/instructor/item-analytics?tab=exam&examId=${result.exam.id}&expand=${row.questionId}#q-${row.questionId}`
                          }
                          id={`q-${row.questionId}`}
                          className="text-xs text-brand-600 underline-offset-2 hover:underline"
                        >
                          {isExpanded ? "Đóng" : "Distractor"}
                        </Link>
                      )}
                    </td>
                  </tr>
                  {isExpanded && canExpand && (
                    <tr className="bg-[rgb(var(--surface-muted))]">
                      <td colSpan={9} className="px-6 py-4">
                        <DistractorBreakdown row={row} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-faint">
        Cập nhật gần nhất:{" "}
        {result.rows[0]?.computedAt
          ? new Date(result.rows[0].computedAt).toLocaleString("vi-VN")
          : "—"}
        . Job nightly tự chạy 02:00.
      </p>
    </>
  );
}

function DistractorBreakdown({ row }: { row: ItemAnalyticsRow }) {
  const stats = row.distractorStats as
    | Record<string, { chosenBy: number; isCorrect: boolean }>
    | null;
  if (!stats || !row.options) return null;
  const total = Object.values(stats).reduce((s, x) => s + x.chosenBy, 0) || 1;
  const correctChosenBy =
    Object.values(stats).find((s) => s.isCorrect)?.chosenBy ?? 0;
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Phân tích đáp án
      </p>
      <ul className="space-y-2">
        {row.options.map((opt) => {
          const s = stats[opt.id] ?? { chosenBy: 0, isCorrect: opt.isCorrect };
          const pct = (s.chosenBy / total) * 100;
          const useless = !opt.isCorrect && s.chosenBy === 0;
          const tricky = !opt.isCorrect && s.chosenBy > correctChosenBy && correctChosenBy > 0;
          return (
            <li key={opt.id} className="flex items-center gap-3 text-sm">
              <span className="w-6 shrink-0 text-center">
                {opt.isCorrect ? (
                  <span className="text-success-600" title="Đáp án đúng">
                    ✓
                  </span>
                ) : (
                  <span className="text-faint">·</span>
                )}
              </span>
              <span className="w-64 shrink-0 truncate" title={opt.label}>
                {opt.label || <em className="text-faint">(không nhãn)</em>}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-[rgb(var(--surface))]">
                <div
                  className={`absolute inset-y-0 left-0 ${
                    opt.isCorrect ? "bg-success-500/70" : "bg-brand-500/60"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-xs">
                {s.chosenBy} ({pct.toFixed(0)}%)
              </span>
              {useless && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Không ai chọn
                </span>
              )}
              {tricky && (
                <span className="rounded bg-danger-100 px-1.5 py-0.5 text-[10px] font-medium text-danger-800">
                  Lừa hơn key — review!
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function BankTab({
  userId,
  banks,
  bankId,
}: {
  userId: string;
  banks: { id: string; name: string }[];
  bankId?: string;
}) {
  if (banks.length === 0) {
    return (
      <EmptyState>
        Bạn chưa có ngân hàng câu hỏi nào. Tạo bank từ trang Quản lý ngân hàng câu hỏi.
      </EmptyState>
    );
  }
  const firstBank = banks[0]!;
  const selectedId = bankId && banks.some((b) => b.id === bankId) ? bankId : firstBank.id;

  let data: Awaited<ReturnType<typeof listBankItemAnalytics>> | null = null;
  let err: string | null = null;
  try {
    data = await listBankItemAnalytics(userId, selectedId);
  } catch (e) {
    err = e instanceof Error ? e.message : "unknown_error";
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="bank-picker"
          className="text-xs font-semibold uppercase tracking-wide text-faint"
        >
          Ngân hàng:
        </label>
        <form>
          <select
            id="bank-picker"
            name="bankId"
            defaultValue={selectedId}
            className="rounded-md border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm"
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="tab" value="bank" />
          <button
            type="submit"
            className="ml-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Xem
          </button>
        </form>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-danger-300 bg-danger-50 p-4 text-sm text-danger-700">
          Lỗi: {err}
        </div>
      )}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-3">Câu hỏi</th>
                <th className="px-3 py-3 text-center">Loại</th>
                <th className="px-3 py-3 text-right">Số lần dùng</th>
                <th className="px-3 py-3 text-right">Tổng lượt làm</th>
                <th className="px-3 py-3 text-center">p̄</th>
                <th className="px-3 py-3 text-center">D̄</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-muted"
                  >
                    Bank chưa có câu hỏi nào.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.bankQuestionId} className="align-top">
                    <td className="px-3 py-3">
                      <p className="max-w-md truncate" title={r.prompt}>
                        {r.prompt}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 text-[10px]">
                        {r.type}
                      </code>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.totalUses}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.totalAttempts}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PValueChip p={r.pValueAvg} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <DChip d={r.discriminationAvg} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// =====================================================================
// Helpers / chips
// =====================================================================

function severity(r: ItemAnalyticsRow): number {
  if (r.discrimination < 0 && r.discrimination > -2) return 4; // negative D
  if (r.attemptCount < ITEM_ANALYTICS_MIN_ATTEMPTS) return 0; // not enough
  if (r.discrimination < 0.2) return 3;
  if (r.pValue < 0.3 || r.pValue > 0.8) return 2;
  return 1;
}

function summarize(rows: ItemAnalyticsRow[]) {
  let negativeD = 0;
  let needsReview = 0;
  let notEnough = 0;
  for (const r of rows) {
    if (r.attemptCount < ITEM_ANALYTICS_MIN_ATTEMPTS) {
      notEnough++;
      continue;
    }
    if (r.discrimination < 0 && r.discrimination > -2) negativeD++;
    else if (r.discrimination < 0.2 || r.pValue < 0.3 || r.pValue > 0.8)
      needsReview++;
  }
  return { negativeD, needsReview, notEnough };
}

function PValueChip({ p }: { p: number }) {
  if (p < 0)
    return <span className="chip bg-[rgb(var(--surface-muted))] text-faint">—</span>;
  let cls = "bg-success-500/80 text-white";
  if (p < 0.3) cls = "bg-danger-500 text-white";
  else if (p > 0.8) cls = "bg-amber-400 text-amber-950";
  return (
    <span
      className={`inline-flex h-6 min-w-[3rem] items-center justify-center rounded-md px-2 text-xs font-semibold tabular-nums ${cls}`}
    >
      {p.toFixed(2)}
    </span>
  );
}

function DChip({ d }: { d: number }) {
  if (d <= -2)
    return <span className="chip bg-[rgb(var(--surface-muted))] text-faint">—</span>;
  let cls = "bg-success-500/80 text-white";
  if (d < 0) cls = "bg-danger-600 text-white";
  else if (d < 0.2) cls = "bg-danger-400 text-white";
  else if (d < 0.3) cls = "bg-amber-400 text-amber-950";
  return (
    <span
      className={`inline-flex h-6 min-w-[3rem] items-center justify-center rounded-md px-2 text-xs font-semibold tabular-nums ${cls}`}
    >
      {d.toFixed(2)}
    </span>
  );
}

function StatusChip({ row }: { row: ItemAnalyticsRow }) {
  if (row.attemptCount < ITEM_ANALYTICS_MIN_ATTEMPTS)
    return (
      <span className="rounded bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-xs text-muted">
        Chưa đủ dữ liệu
      </span>
    );
  if (row.discrimination < 0 && row.discrimination > -2)
    return (
      <span className="rounded bg-danger-100 px-2 py-0.5 text-xs font-medium text-danger-700">
        Đảo dấu — review
      </span>
    );
  if (row.discrimination < 0.2 || row.pValue < 0.3 || row.pValue > 0.8)
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Cần review
      </span>
    );
  return (
    <span className="rounded bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700">
      OK
    </span>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-muted hover:text-default"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm">
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "brand" | "success" | "accent" | "danger";
}) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
    danger: "text-danger-600",
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
