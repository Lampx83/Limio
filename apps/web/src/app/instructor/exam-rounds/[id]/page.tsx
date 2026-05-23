import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { Tag } from "lucide-react";
import {
  ExamError,
  getExamRound,
  listCohorts,
  listExamSessionsForRound,
  canEditExamRound,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import RoundTabs from "./RoundTabs";
import { parseRoundTab } from "./round-tabs-helpers";
import OverviewPanel from "./OverviewPanel";
import SessionsPanel from "./SessionsPanel";
import CohortsPanel from "./CohortsPanel";
import AdminsPanel from "./AdminsPanel";
import ResultsPanel, { type SessionSummary } from "./ResultsPanel";

export const dynamic = "force-dynamic";

type RoundStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<RoundStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-amber-100 text-amber-800",
};

export default async function ExamRoundDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/instructor/exam-rounds/${params.id}`);
  const userId = session.user.id;
  const activeTab = parseRoundTab(searchParams.tab);

  let round;
  try {
    round = await getExamRound(userId, params.id);
  } catch (e) {
    if (e instanceof ExamError && e.code === "round_not_found") notFound();
    if (e instanceof ExamError && e.code === "forbidden")
      return (
        <main>
          <h1 className="text-xl font-semibold">Không có quyền</h1>
          <p className="mt-2 text-sm text-faint">
            Bạn không có quyền xem đợt thi này.
          </p>
          <Link
            href="/instructor/exam-rounds"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Về danh sách đợt thi
          </Link>
        </main>
      );
    throw e;
  }

  const canEdit = await canEditExamRound(userId, params.id);

  // Data needed by tabs. We fetch sessions + assignable courses (for adding to
  // the round) up front so the server component owns all data fetching.
  const sessions = await listExamSessionsForRound(userId, params.id);
  const cohorts = await listCohorts(userId, round.course.courseId, {
    roundId: round.id,
  });

  // Exams available for sessions in this round: exams whose courseId matches
  // the round's course (PR2.11 — 1 round = 1 course).
  const availableExams = await prisma.exam.findMany({
    where: { courseId: round.course.courseId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      courseId: true,
    },
  });
  const availableExamOptions = availableExams.map((e) => ({
    id: e.id,
    title: e.title,
    courseId: e.courseId,
    courseTitle: round.course.courseTitle,
  }));

  // Results tab: per-session stats (candidate counts + attempt aggregates).
  let sessionSummaries: SessionSummary[] = [];
  if (activeTab === "results") {
    sessionSummaries = await Promise.all(
      sessions.map(async (s) => {
        const exam = availableExams.find((e) => e.id === s.examId);
        // Candidate count for this session (via rooms).
        const totalCandidates = await prisma.examCandidate.count({
          where: { room: { sessionId: s.id } },
        });
        // Attempt aggregates.
        const attempts = await prisma.examAttempt.findMany({
          where: {
            examId: s.examId,
            status: { in: ["submitted", "auto_submitted", "graded"] },
            candidate: { room: { sessionId: s.id } },
          },
          select: { status: true, scorePct: true, passed: true },
        });
        const submitted = attempts.length;
        const graded = attempts.filter((a) => a.status === "graded").length;
        const passCount = attempts.filter((a) => a.passed === true).length;
        const scorePcts = attempts.flatMap((a) => (a.scorePct !== null ? [a.scorePct] : []));
        const avgScorePct =
          scorePcts.length > 0
            ? scorePcts.reduce((x, y) => x + y, 0) / scorePcts.length
            : null;
        return {
          id: s.id,
          code: s.code ?? "",
          title: s.title ?? "(Chưa đặt tên)",
          examId: s.examId,
          examTitle: exam?.title ?? s.examId,
          totalCandidates,
          submitted,
          graded,
          avgScorePct,
          passCount,
        } satisfies SessionSummary;
      }),
    );
  }

  return (
    <main>
      <Link
        href="/instructor/exam-rounds"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Danh sách đợt thi
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{round.title}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[round.status]}`}
            >
              {STATUS_LABEL[round.status]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
            <span className="font-mono">{round.code}</span>
            <span>·</span>
            <span>
              {formatDate(round.opensAt)} → {formatDate(round.closesAt)}
            </span>
            <span>·</span>
            <span>{round.sessionCount} ca thi</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />{round.course.courseTitle}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <RoundTabs roundId={round.id} active={activeTab} />
      </div>

      <div className="mt-6">
        {activeTab === "overview" && (
          <OverviewPanel round={round} canEdit={canEdit} />
        )}
        {activeTab === "sessions" && (
          <SessionsPanel
            roundId={round.id}
            sessions={sessions}
            course={round.course}
            availableExams={availableExamOptions}
            canEdit={canEdit}
          />
        )}
        {activeTab === "cohorts" && (
          <CohortsPanel
            roundId={round.id}
            courseId={round.course.courseId}
            cohorts={cohorts}
            sessions={sessions.map((s) => ({
              id: s.id,
              code: s.code,
              title: s.title,
            }))}
            canEdit={canEdit}
          />
        )}
        {activeTab === "admins" && (
          <AdminsPanel
            roundId={round.id}
            admins={round.admins}
            canEdit={canEdit}
            currentUserId={userId}
          />
        )}
        {activeTab === "results" && (
          <ResultsPanel roundId={round.id} sessions={sessionSummaries} />
        )}
      </div>
    </main>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
