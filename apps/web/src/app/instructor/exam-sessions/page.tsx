import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { Calendar, Clock, DoorOpen, Users } from "lucide-react";
import { formatVN } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/**
 * P1 Proctor Console — hub for users who are proctor / grader of one or more
 * ExamRooms across courses. Lists assigned rooms grouped by exam, with quick
 * links to live monitor (proctor) and grading inbox (grader).
 *
 * Instructors who happen to also be proctor of their own rooms see them here
 * too; they continue to have full access via the regular instructor pages.
 */
export default async function ExamSessionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/exam-sessions`);
  }
  const userId = session.user.id;

  const [proctorRooms, graderRows] = await Promise.all([
    prisma.examRoom.findMany({
      where: { proctorUserId: userId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            courseId: true,
            openAt: true,
            closeAt: true,
            durationMin: true,
            course: { select: { title: true } },
          },
        },
        _count: { select: { candidates: true } },
      },
    }),
    prisma.examRoomGrader.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            exam: {
              select: {
                id: true,
                title: true,
                courseId: true,
                openAt: true,
                closeAt: true,
                durationMin: true,
                course: { select: { title: true } },
              },
            },
            _count: { select: { candidates: true } },
          },
        },
      },
    }),
  ]);

  type Row = {
    roomId: string;
    examId: string;
    courseId: string;
    examTitle: string;
    courseTitle: string;
    roomName: string;
    locationNote: string | null;
    openAt: Date;
    closeAt: Date;
    durationMin: number;
    candidateCount: number;
    role: "proctor" | "grader";
  };

  const now = Date.now();
  const rows: Row[] = [];
  for (const r of proctorRooms) {
    rows.push({
      roomId: r.id,
      examId: r.examId,
      courseId: r.exam.courseId,
      examTitle: r.exam.title,
      courseTitle: r.exam.course.title,
      roomName: r.name,
      locationNote: r.locationNote,
      openAt: r.exam.openAt,
      closeAt: r.exam.closeAt,
      durationMin: r.exam.durationMin,
      candidateCount: r._count.candidates,
      role: "proctor",
    });
  }
  for (const g of graderRows) {
    rows.push({
      roomId: g.roomId,
      examId: g.room.examId,
      courseId: g.room.exam.courseId,
      examTitle: g.room.exam.title,
      courseTitle: g.room.exam.course.title,
      roomName: g.room.name,
      locationNote: g.room.locationNote,
      openAt: g.room.exam.openAt,
      closeAt: g.room.exam.closeAt,
      durationMin: g.room.exam.durationMin,
      candidateCount: g.room._count.candidates,
      role: "grader",
    });
  }

  // Sort: live first (now in window), then upcoming nearest, then closed (latest first).
  function bucket(o: Date, c: Date): "live" | "upcoming" | "closed" {
    if (now < o.getTime()) return "upcoming";
    if (now > c.getTime()) return "closed";
    return "live";
  }
  const order = { live: 0, upcoming: 1, closed: 2 };
  rows.sort((a, b) => {
    const ba = bucket(a.openAt, a.closeAt);
    const bb = bucket(b.openAt, b.closeAt);
    if (ba !== bb) return order[ba] - order[bb];
    if (ba === "upcoming") return a.openAt.getTime() - b.openAt.getTime();
    if (ba === "closed") return b.closeAt.getTime() - a.closeAt.getTime();
    return a.openAt.getTime() - b.openAt.getTime();
  });

  if (rows.length === 0) {
    return (
      <main>
        <h1 className="h-display text-3xl font-bold">Ca thi trực tiếp</h1>
        <p className="mt-2 text-muted">
          Hub theo dõi các phòng thi bạn được phân công làm giám thị hoặc người chấm.
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-default bg-slate-50 p-8 text-center text-sm text-faint">
          Bạn chưa được phân công làm giám thị hoặc người chấm cho phòng thi nào.
        </div>
      </main>
    );
  }

  const fmt = (d: Date) =>
    formatVN(d, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <main>
      <h1 className="h-display text-3xl font-bold sm:text-4xl">
        Ca thi trực tiếp
      </h1>
      <p className="mt-2 text-muted">
        {rows.length} phòng bạn được phân công. Live = đang trong cửa sổ thi;
        Sắp tới = chưa mở; Đã đóng = đã hết giờ.
      </p>

      <ul className="mt-8 space-y-3">
        {rows.map((r) => {
          const b = bucket(r.openAt, r.closeAt);
          const tone =
            b === "live"
              ? "border-emerald-300 bg-emerald-50"
              : b === "upcoming"
                ? "border-blue-200 bg-blue-50/40"
                : "border-default bg-slate-50";
          const tagText =
            b === "live" ? "🔴 Live" : b === "upcoming" ? "Sắp tới" : "Đã đóng";
          const tagTone =
            b === "live"
              ? "bg-emerald-200 text-emerald-900"
              : b === "upcoming"
                ? "bg-blue-200 text-blue-900"
                : "bg-slate-200 text-slate-700";
          return (
            <li
              key={`${r.roomId}-${r.role}`}
              className={`rounded-xl border p-4 ${tone}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{r.examTitle}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagTone}`}
                    >
                      {tagText}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
                      {r.role === "proctor" ? "Giám thị" : "Người chấm"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-faint">
                    {r.courseTitle}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {r.role === "proctor" && (
                    <Link
                      href={`/instructor/courses/${r.courseId}/exams/${r.examId}/live`}
                      className="rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                      prefetch={false}
                    >
                      Mở Live monitor
                    </Link>
                  )}
                  {r.role === "grader" && (
                    <Link
                      href={`/instructor/courses/${r.courseId}/exams/${r.examId}/grading`}
                      className="rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                    >
                      Chấm bài
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-700 sm:grid-cols-4">
                <div className="inline-flex items-center gap-1.5">
                  <DoorOpen size={14} className="text-faint" />
                  <span className="font-medium">{r.roomName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Users size={14} className="text-faint" />
                  <span>{r.candidateCount} thí sinh</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="text-faint" />
                  <span>
                    {fmt(r.openAt)} → {fmt(r.closeAt)}
                  </span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Clock size={14} className="text-faint" />
                  <span>{r.durationMin} phút</span>
                </div>
              </div>
              {r.locationNote && (
                <p className="mt-2 text-xs text-faint">📍 {r.locationNote}</p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
