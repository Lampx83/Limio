import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AttendanceError, CourseAuthzError, getMeetingAttendance, getMeetingCheckIn } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { formatTime, formatVN } from "@/lib/datetime";
import AttendanceClient from "./AttendanceClient";
import MeetingCloseCard from "./MeetingCloseCard";
import TeacherCheckInCard from "./TeacherCheckInCard";

export const dynamic = "force-dynamic";

export default async function MeetingAttendancePage({
  params,
}: {
  params: { id: string; sectionId: string; meetingId: string };
}) {
  const session = await auth();
  const here = `/instructor/courses/${params.id}/sections/${params.sectionId}/meetings/${params.meetingId}`;
  if (!session?.user?.id) redirect(`/signin?callbackUrl=${here}`);

  let view;
  try {
    view = await getMeetingAttendance(session.user.id, params.meetingId);
  } catch (e) {
    if (e instanceof AttendanceError && e.code === "meeting_not_found") notFound();
    if (e instanceof CourseAuthzError) {
      if (e.code === "not_found") notFound();
      // Không được điểm danh buổi này (vd. buổi của giảng viên khác): về trang lớp, nơi họ vẫn xem được lịch.
      redirect(`/instructor/courses/${params.id}/sections/${params.sectionId}`);
    }
    throw e;
  }
  if (view.meeting.courseId !== params.id || view.meeting.sectionId !== params.sectionId) notFound();

  const m = view.meeting;
  const [row, deliveries, checkIn] = await Promise.all([
    prisma.classMeeting.findUnique({
      where: { id: m.id },
      select: { startsAt: true, closedAt: true, section: { select: { autoSendSummary: true } } },
    }),
    prisma.meetingSummaryDelivery.groupBy({ by: ["status"], where: { meetingId: m.id }, _count: true }),
    getMeetingCheckIn(session.user.id, m.id).catch(() => null),
  ]);
  const count = (...st: string[]) => deliveries.filter((d) => st.includes(d.status)).reduce((n, d) => n + d._count, 0);
  return (
    <main>
      <Link
        href={`/instructor/courses/${params.id}/sections/${params.sectionId}`}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← {m.sectionName}
      </Link>
      <h1 className="mt-3 text-h2">Điểm danh{m.seq ? ` · Buổi ${m.seq}` : ""}</h1>
      <p className="mt-1 text-sm text-muted">
        {formatVN(m.startsAt, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} · {formatTime(m.startsAt)}–
        {formatTime(m.endsAt)}
        {m.room ? ` · Phòng ${m.room}` : ""}
      </p>
      {checkIn && <TeacherCheckInCard initial={checkIn} />}
      {row && (
        <MeetingCloseCard
          meetingId={m.id}
          sectionId={params.sectionId}
          courseId={params.id}
          initial={{
            startsAt: row.startsAt.toISOString(),
            closedAt: row.closedAt ? row.closedAt.toISOString() : null,
            cancelled: m.status === "cancelled",
            autoSend: row.section.autoSendSummary,
            summary: { sent: count("sent"), failed: count("failed"), skipped: count("skipped_optout", "skipped_no_email") },
          }}
        />
      )}
      <AttendanceClient meetingId={m.id} initial={view} />
    </main>
  );
}
