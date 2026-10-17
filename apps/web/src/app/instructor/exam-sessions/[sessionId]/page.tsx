import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Printer, Radio, Tag } from "lucide-react";
import {
  ExamError,
  canEditSession,
  getExamSession,
  listExamRoomsForSession,
  liveCountsByRoom,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import SessionOverviewPanel from "./SessionOverviewPanel";
import SessionRoomsPanel from "./SessionRoomsPanel";
import SessionCandidatesPanel from "./SessionCandidatesPanel";
import SessionTabs from "./SessionTabs";
import LobbyCounter from "./LobbyCounter";
import ExamReadinessWarning from "./ExamReadinessWarning";
import ExamAccessModeCard from "./ExamAccessModeCard";
import SessionResultsPanel, { type CandidateResult } from "./SessionResultsPanel";
import { parseSessionTab } from "./session-tabs-helpers";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type SessionStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<SessionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-amber-100 text-amber-800",
};

export default async function ExamSessionDetailPage({
  params,
  searchParams,
}: {
  params: { sessionId: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-sessions/${params.sessionId}`,
    );
  const userId = session.user.id;
  const activeTab = parseSessionTab(searchParams.tab);

  let detail;
  try {
    detail = await getExamSession(userId, params.sessionId);
  } catch (e) {
    if (e instanceof ExamError && e.code === "schedule_not_found") notFound();
    if (e instanceof ExamError && e.code === "forbidden")
      return (
        <main>
          <h1 className="text-xl font-semibold">Không có quyền</h1>
          <p className="mt-2 text-sm text-faint">
            Bạn không có quyền xem ca thi này.
          </p>
          <Link
            href="/instructor/organize/formal"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Kỳ thi chính thức
          </Link>
        </main>
      );
    throw e;
  }

  // Ca có thể thuộc một đợt (kỳ thi cũ) hoặc đứng một mình (tạo thẳng từ đề).
  // Quyền theo đợt nếu có, ngược lại theo đề chứa ca.
  const canEdit = await canEditSession(userId, {
    roundId: detail.roundId,
    examId: detail.examId,
  });
  const roomsRaw = await listExamRoomsForSession(userId, params.sessionId);

  // Số liệu giám sát cấp phòng — một truy vấn gộp, không phải nghe luồng sự
  // kiện. Xem live-counts.ts về vì sao cấp ca/đợt chỉ nên đếm.
  const roomCounts = await liveCountsByRoom(params.sessionId);
  const rooms = roomsRaw.map((r) => ({
    ...r,
    inProgress: roomCounts.get(r.id)?.inProgress ?? 0,
    submitted: roomCounts.get(r.id)?.submitted ?? 0,
  }));

  // Đề cùng khoá để cho phép đổi đề của ca thi trong form edit.
  // Đề độc lập (không thuộc khoá): chỉ có chính đề của ca để chọn.
  const availableExams = await prisma.exam.findMany({
    where: detail.courseId ? { courseId: detail.courseId } : { id: detail.examId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  // Results tab: per-candidate attempt data for this session.
  // FIX: previously filtered by `roomId IN [rooms of session]` which dropped
  // candidates with NULL roomId — common in open_code (free) sessions where
  // the candidate claims a code without picking/having a room (see
  // code-access.ts: "Ca thi chưa có phòng → roomId=null"). sessionId is the
  // canonical link from candidate to session (always set), so query by that
  // and treat roomId as a display-only column with a "— chưa gán —" fallback.
  let candidateResults: CandidateResult[] = [];
  if (activeTab === "results") {
    const candidates = await prisma.examCandidate.findMany({
      where: { sessionId: params.sessionId },
      orderBy: [{ room: { name: "asc" } }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        accessCode: true,
        roomId: true,
        room: { select: { name: true } },
        attempts: {
          orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            status: true,
            score: true,
            scorePct: true,
            passed: true,
            submittedAt: true,
          },
        },
      },
    });
    candidateResults = candidates.map((c) => {
      const attempt = c.attempts[0] ?? null;
      const status =
        attempt === null
          ? "none"
          : (attempt.status as CandidateResult["attemptStatus"]);
      return {
        id: c.id,
        attemptId: attempt?.id ?? null,
        displayName: c.displayName,
        accessCode: c.accessCode ?? "",
        roomId: c.roomId ?? "",
        roomName: c.room?.name ?? "— chưa gán phòng —",
        attemptStatus: status,
        score: attempt?.score ?? null,
        scorePct: attempt?.scorePct ?? null,
        passed: attempt?.passed ?? null,
        submittedAt: attempt?.submittedAt?.toISOString() ?? null,
      } satisfies CandidateResult;
    });
  }

  return (
    <main>
      <Link
        href={
          detail.roundId
            ? `/instructor/exam-rounds/${detail.roundId}?tab=sessions`
            : "/instructor/organize/formal"
        }
        className="text-sm text-blue-600 hover:underline"
      >
        ← {detail.roundTitle ?? "Kỳ thi chính thức"}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">
              {detail.title ?? "(Ca thi chưa đặt tên)"}
            </h1>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_TONE[detail.status]}`}
            >
              {STATUS_LABEL[detail.status]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
            {detail.code && <span className="font-mono">{detail.code}</span>}
            {detail.code && <span>·</span>}
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />{detail.examTitle}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />{detail.courseTitle}</span>
            <span>·</span>
            <span>
              {formatDate(detail.opensAt)} → {detail.closesAt ? formatDate(detail.closesAt) : "đóng thủ công"}
            </span>
            <span>·</span>
            <span>{detail.roomCount} phòng</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {detail.status !== "closed" && detail.status !== "archived" && (
            <LobbyCounter sessionId={detail.id} />
          )}
          {detail.roomCount > 0 && (
            <Link
              href={`/instructor/exam-sessions/${detail.id}/print-room-codes`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4 text-slate-500" aria-hidden /> In phiếu mã
            </Link>
          )}
          {detail.examStatus === "published" && (
            <Link
              href={`/instructor/courses/${detail.courseId ?? "none"}/exams/${detail.examId}/live?sessionId=${detail.id}`}
              className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              <Radio className="h-4 w-4 text-red-500" /> Live monitor
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SessionTabs sessionId={detail.id} active={activeTab} />
      </div>

      <div className="mt-6 space-y-4">
        <ExamAccessModeCard
          sessionId={detail.id}
          examId={detail.examId}
          accessMode={detail.examAccessMode}
          openCode={detail.examOpenCode}
          assignedCodeSource={detail.examAssignedCodeSource}
          baseUrl={(() => {
            // Prefer NEXTAUTH_URL (deploy-time config — always the canonical
            // public origin with the right scheme). Fall back to derived from
            // request headers, defaulting proto to "https" because production
            // always terminates TLS at the reverse proxy — the old "http"
            // default printed http://limio.vn/thi for instructors when the
            // proxy didn't forward x-forwarded-proto.
            const envUrl = process.env.NEXTAUTH_URL;
            if (envUrl) return envUrl.replace(/\/$/, "");
            const h = headers();
            const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
            const proto = h.get("x-forwarded-proto") ?? "https";
            return host ? `${proto}://${host}` : "";
          })()}
          canEdit={canEdit}
          roomsHref={
            activeTab === "rooms"
              ? null
              : `/instructor/exam-sessions/${detail.id}?tab=rooms`
          }
        />
        <ExamReadinessWarning
          courseId={detail.courseId}
          examId={detail.examId}
          examAccessMode={detail.examAccessMode}
          examStatus={detail.examStatus}
        />
        {activeTab === "overview" && (
          <SessionOverviewPanel
            detail={{
              ...detail,
              courseId: detail.courseId,
              courseTitle: detail.courseTitle ?? "(Không tên)",
            }}
            canEdit={canEdit}
            availableExams={availableExams}
          />
        )}
        {activeTab === "rooms" && (
          <SessionCandidatesPanel
            sessionId={detail.id}
            accessMode={detail.examAccessMode}
            canEdit={canEdit}
          />
        )}
        {activeTab === "rooms" && (
          <SessionRoomsPanel
            sessionId={detail.id}
            rooms={rooms}
            canEdit={canEdit}
          />
        )}
        {activeTab === "results" && (
          <SessionResultsPanel
            roundId={detail.roundId}
            examId={detail.examId}
            sessionId={detail.id}
            candidates={candidateResults}
          />
        )}
      </div>
    </main>
  );
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}
