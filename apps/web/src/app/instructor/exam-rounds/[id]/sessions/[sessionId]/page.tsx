import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  ExamError,
  canEditExamRound,
  getExamSession,
  listExamRoomsForSession,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SessionOverviewPanel from "./SessionOverviewPanel";
import SessionRoomsPanel from "./SessionRoomsPanel";
import SessionTabs from "./SessionTabs";
import ExamReadinessWarning from "./ExamReadinessWarning";
import ExamAccessModeCard from "./ExamAccessModeCard";
import { parseSessionTab } from "./session-tabs-helpers";

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
  params: { id: string; sessionId: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-rounds/${params.id}/sessions/${params.sessionId}`,
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
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-xl font-semibold">Không có quyền</h1>
          <p className="mt-2 text-sm text-faint">
            Bạn không có quyền xem ca thi này.
          </p>
          <Link
            href={`/instructor/exam-rounds/${params.id}`}
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Quay lại đợt thi
          </Link>
        </main>
      );
    throw e;
  }

  // Validate that the session belongs to the round in the URL — guard against
  // hand-edited URLs pointing to a session of another round.
  if (detail.roundId !== params.id) notFound();

  const canEdit = await canEditExamRound(userId, detail.roundId);
  const rooms = await listExamRoomsForSession(userId, params.sessionId);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href={`/instructor/exam-rounds/${detail.roundId}?tab=sessions`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {detail.roundTitle}
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
            <span>📘 {detail.examTitle}</span>
            <span>·</span>
            <span>🏷️ {detail.courseTitle}</span>
            <span>·</span>
            <span>
              {formatDate(detail.opensAt)} → {formatDate(detail.closesAt)}
            </span>
            <span>·</span>
            <span>{detail.roomCount} phòng</span>
          </div>
        </div>
        {detail.examStatus === "published" && (
          <Link
            href={`/instructor/courses/${detail.courseId}/exams/${detail.examId}/live?sessionId=${detail.id}`}
            className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100"
          >
            🔴 Live monitor
          </Link>
        )}
      </div>

      <div className="mt-6">
        <SessionTabs
          roundId={detail.roundId}
          sessionId={detail.id}
          active={activeTab}
        />
      </div>

      <div className="mt-6 space-y-4">
        <ExamAccessModeCard
          examId={detail.examId}
          accessMode={detail.examAccessMode}
          openCode={detail.examOpenCode}
          assignedCodeSource={detail.examAssignedCodeSource}
          baseUrl={(() => {
            const h = headers();
            const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
            const proto = h.get("x-forwarded-proto") ?? "http";
            return host ? `${proto}://${host}` : "";
          })()}
          canEdit={canEdit}
        />
        <ExamReadinessWarning
          courseId={detail.courseId}
          examId={detail.examId}
          examAccessMode={detail.examAccessMode}
          examStatus={detail.examStatus}
        />
        {activeTab === "overview" && (
          <SessionOverviewPanel detail={detail} canEdit={canEdit} />
        )}
        {activeTab === "rooms" && (
          <SessionRoomsPanel
            sessionId={detail.id}
            rooms={rooms}
            canEdit={canEdit}
          />
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
