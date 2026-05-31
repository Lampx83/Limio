import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ExamError,
  getExamRoom,
  listExamCandidatesInRoom,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PrintAutoFire, { PrintButton } from "./PrintAutoFire";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function RoomCandidatesPrintPage({
  params,
}: {
  params: { id: string; sessionId: string; roomId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-rounds/${params.id}/sessions/${params.sessionId}/rooms/${params.roomId}/print`,
    );
  const userId = session.user.id;

  let room;
  try {
    room = await getExamRoom(userId, params.roomId);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }
  if (room.roundId !== params.id || room.sessionId !== params.sessionId)
    notFound();

  const candidates = await listExamCandidatesInRoom(userId, params.roomId);

  return (
    <>
      <PrintAutoFire />
      <main className="text-slate-900 print:">
        <Link
          href={`/instructor/exam-rounds/${params.id}/sessions/${params.sessionId}/rooms/${params.roomId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline print:hidden"
        >
          ← Quay lại phòng thi
        </Link>
        <header className="border-b border-slate-300 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">
                {room.name}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  · STT {room.orderIndex}
                </span>
              </h1>
              <div className="mt-1 text-sm">
                <div>
                  <strong>Đề thi:</strong> {room.examTitle}{" "}
                  <span className="text-slate-500">({room.courseTitle})</span>
                </div>
                <div>
                  <strong>Ca thi:</strong>{" "}
                  {room.sessionTitle ?? room.sessionCode ?? "Ca thi"} ·{" "}
                  {formatDate(room.sessionOpensAt)} →{" "}
                  {formatDate(room.sessionClosesAt)}
                </div>
                <div>
                  <strong>Giám thị:</strong> {room.proctorName}
                </div>
                {room.locationNote && (
                  <div>
                    <strong>Địa điểm:</strong> {room.locationNote}
                  </div>
                )}
              </div>
            </div>
            <PrintButton />
          </div>
        </header>

        <p className="mt-4 text-xs text-slate-500 print:hidden">
          Phát mỗi sinh viên 1 dòng. Sinh viên vào URL <code>/exam/{`{mã thi}`}</code>
          {" "}để bắt đầu (vd /exam/{candidates[0]?.accessCode ?? "ABCD1234"}).
        </p>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400 text-left">
              <th className="w-10 py-2 pr-2">STT</th>
              <th className="py-2 pr-2">Họ và tên</th>
              <th className="py-2 pr-2">MSSV</th>
              <th className="py-2 pr-2">Email</th>
              <th className="py-2 pr-2">Mã thi</th>
              <th className="w-32 py-2">Chữ ký</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, idx) => (
              <tr key={c.id} className="border-b border-slate-200">
                <td className="py-2 pr-2 text-slate-500">{idx + 1}</td>
                <td className="py-2 pr-2 font-medium">{c.displayName}</td>
                <td className="py-2 pr-2">{c.mssv ?? ""}</td>
                <td className="py-2 pr-2 text-xs text-slate-600">
                  {c.email ?? ""}
                </td>
                <td className="py-2 pr-2 font-mono text-base font-bold">
                  {c.accessCode ?? "—"}
                </td>
                <td className="py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <footer className="mt-8 text-xs text-slate-500">
          Tổng: {candidates.length} thí sinh · In ngày{" "}
          {formatDateTime(new Date())}
        </footer>
      </main>
    </>
  );
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}
