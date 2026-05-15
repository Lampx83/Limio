import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  ExamError,
  getExamRoom,
  listExamCandidatesInRoom,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RoomProjectionPage({
  params,
}: {
  params: { roomId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/proctor/rooms/${params.roomId}/projection`);
  const userId = session.user.id;

  let room;
  try {
    room = await getExamRoom(userId, params.roomId);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }

  const candidates = await listExamCandidatesInRoom(userId, params.roomId);

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}/exam/`;

  return (
    <div className="min-h-screen bg-white px-8 py-6 text-slate-900">
      <Link
        href={`/instructor/exam-rounds/${room.roundId}/sessions/${room.sessionId}/rooms/${params.roomId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline print:hidden"
      >
        ← Quay lại phòng thi
      </Link>
      <header className="mt-2 border-b-2 border-slate-300 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-4xl font-bold">{room.name}</h1>
          <div className="text-right text-lg text-slate-600">
            <div className="font-semibold text-slate-800">{room.examTitle}</div>
            <div className="text-base">{room.courseTitle}</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-3 text-lg text-slate-600">
          {room.locationNote && <span>📍 {room.locationNote}</span>}
          <span>·</span>
          <span>Giám thị: {room.proctorName}</span>
        </div>
      </header>

      <section className="mt-6 rounded-lg border-2 border-blue-300 bg-blue-50 p-5 text-center">
        <div className="text-lg font-medium text-slate-700">
          📲 Sinh viên vào URL
        </div>
        <div className="mt-2 break-all font-mono text-3xl font-bold text-blue-700">
          {baseUrl}<span className="underline decoration-dotted">[mã thi]</span>
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Vd: <span className="font-mono">{baseUrl}{candidates[0]?.accessCode ?? "ABCD1234"}</span>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">
          Danh sách thí sinh ({candidates.length})
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {candidates.map((c, idx) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 rounded border border-slate-300 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-base text-slate-400">{idx + 1}.</span>
                  <span className="truncate text-xl font-semibold">
                    {c.displayName}
                  </span>
                </div>
                {c.mssv && (
                  <div className="text-sm text-slate-500">MSSV: {c.mssv}</div>
                )}
              </div>
              <div className="shrink-0 rounded bg-slate-900 px-3 py-1.5 font-mono text-2xl font-bold tracking-wider text-amber-300">
                {c.accessCode ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-sm text-slate-400">
        Đóng tab này khi đã phát xong mã. F11 để toàn màn hình.
      </footer>
    </div>
  );
}
