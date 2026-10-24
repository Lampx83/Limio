import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AttendanceError, CourseAuthzError, getMeetingAttendance } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatTime, formatVN } from "@/lib/datetime";
import AttendanceClient from "./AttendanceClient";

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
      <AttendanceClient meetingId={m.id} initial={view} />
    </main>
  );
}
