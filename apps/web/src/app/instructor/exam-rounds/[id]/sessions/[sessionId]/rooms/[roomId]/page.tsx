import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, Eye, KeyRound, MapPin, Monitor, Printer, Star, Tag } from "lucide-react";
import SetDefaultRoomButton from "./SetDefaultRoomButton";
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
        <main>
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
    <main>
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
            {room.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800" title="Thí sinh không nhập mã phòng sẽ tự gán vào đây">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Phòng mặc định
              </span>
            )}
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
          {room.accessCode && room.examAccessMode === "open_code" && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm">
              <KeyRound className="h-4 w-4 shrink-0 text-blue-700" />
              <span className="text-blue-900">Mã phòng cho thí sinh:</span>
              <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold tracking-widest text-blue-900">{room.accessCode}</code>
              <span className="text-xs text-blue-700">Thí sinh nhập mã này khi join để được tự gán vào phòng</span>
            </div>
          )}
          {canEdit && !room.isDefault && (
            <div className="mt-2">
              <SetDefaultRoomButton roomId={room.id} />
            </div>
          )}
        </div>
        {candidates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {room.examAccessMode === "assigned_code" && (
              <>
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
              </>
            )}
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
          examAccessMode={room.examAccessMode}
        />
      </div>
    </main>
  );
}
