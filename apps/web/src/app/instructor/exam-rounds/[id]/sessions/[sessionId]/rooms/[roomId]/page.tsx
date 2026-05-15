import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Eye, MapPin, Monitor, Printer, Tag } from "lucide-react";
import {
  ExamError,
  canEditExamRound,
  getExamRoom,
  listExamCandidatesInRoom,
  listExamRoomsForSession,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import RoomCandidatesPanel from "./RoomCandidatesPanel";
import ExamReadinessWarning from "../../ExamReadinessWarning";

export const dynamic = "force-dynamic";

export default async function ExamRoomDetailPage({
  params,
}: {
  params: { id: string; sessionId: string; roomId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-rounds/${params.id}/sessions/${params.sessionId}/rooms/${params.roomId}`,
    );
  const userId = session.user.id;

  let room;
  try {
    room = await getExamRoom(userId, params.roomId);
  } catch (e) {
    if (e instanceof ExamError && e.code === "validation_failed") notFound();
    if (e instanceof ExamError && e.code === "forbidden")
      return (
        <main className="mx-auto max-w-3xl px-6 py-10">
          <h1 className="text-xl font-semibold">Không có quyền</h1>
          <p className="mt-2 text-sm text-faint">
            Bạn không có quyền xem phòng thi này.
          </p>
        </main>
      );
    throw e;
  }

  // Guard against hand-edited URLs that don't match the room's actual session/round.
  if (room.roundId !== params.id || room.sessionId !== params.sessionId)
    notFound();

  const [candidates, siblingRooms] = await Promise.all([
    listExamCandidatesInRoom(userId, params.roomId),
    listExamRoomsForSession(userId, params.sessionId),
  ]);
  const otherRooms = siblingRooms
    .filter((r) => r.id !== params.roomId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      orderIndex: r.orderIndex,
      candidateCount: r.candidateCount,
    }));
  const canEdit = await canEditExamRound(userId, room.roundId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/instructor/exam-rounds/${room.roundId}/sessions/${room.sessionId}?tab=rooms`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← {room.sessionTitle ?? "Ca thi"}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600">
              STT {room.orderIndex}
            </span>
            <h1 className="text-2xl font-bold">{room.name}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-faint">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />{room.examTitle}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />{room.courseTitle}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5 shrink-0 text-slate-400" /> Giám thị: {room.proctorName}</span>
            {room.locationNote && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />{room.locationNote}</span>
              </>
            )}
          </div>
        </div>
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/proctor/rooms/${room.id}/projection`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-100"
            >
              <Monitor className="h-4 w-4" /> Chiếu mã thi
            </Link>
            <Link
              href={`/instructor/exam-rounds/${room.roundId}/sessions/${room.sessionId}/rooms/${room.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> In danh sách mã thi
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <ExamReadinessWarning
          courseId={room.courseId}
          examId={room.examId}
          examAccessMode={room.examAccessMode}
          examStatus={room.examStatus}
        />
        <RoomCandidatesPanel
          roomId={room.id}
          candidates={candidates}
          canEdit={canEdit}
          otherRooms={otherRooms}
        />
      </div>
    </main>
  );
}
