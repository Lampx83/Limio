import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourseAuthzError, MeetingNoteError, listMeetingNotes } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatTime, formatVN } from "@/lib/datetime";
import { noteDto } from "@/lib/classNotes";
import NotesClient, { type NotesView } from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function MeetingNotesPage({ params }: { params: { id: string; sectionId: string; meetingId: string } }) {
  const session = await auth();
  const here = `/instructor/courses/${params.id}/sections/${params.sectionId}/meetings/${params.meetingId}/notes`;
  if (!session?.user?.id) redirect(`/signin?callbackUrl=${here}`);

  const meetingPage = `/instructor/courses/${params.id}/sections/${params.sectionId}/meetings/${params.meetingId}`;
  let view;
  try {
    view = await listMeetingNotes(session.user.id, params.meetingId);
  } catch (e) {
    if (e instanceof MeetingNoteError) {
      if (e.code === "meeting_not_found") notFound();
      // Chưa kết thúc buổi thì chưa có nhận xét: về trang điểm danh, nơi có nút "Kết thúc buổi".
      if (e.code === "not_closed") redirect(meetingPage);
    }
    if (e instanceof CourseAuthzError) {
      if (e.code === "not_found") notFound();
      redirect(`/instructor/courses/${params.id}/sections/${params.sectionId}`);
    }
    throw e;
  }
  if (view.meeting.sectionId !== params.sectionId) notFound();

  const initial: NotesView = {
    ...view,
    rows: view.rows.map((r) => ({ ...r, note: r.note ? noteDto(r.note) : null, sentNotes: r.sentNotes.map(noteDto) })),
  } as unknown as NotesView;

  return (
    <main>
      <Link
        href={meetingPage}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← Điểm danh{view.meeting.seq ? ` · Buổi ${view.meeting.seq}` : ""}
      </Link>
      <h1 className="mt-3 text-h2">Nhận xét sau buổi{view.meeting.seq ? ` · Buổi ${view.meeting.seq}` : ""}</h1>
      <p className="mt-1 text-sm text-muted">
        {view.meeting.sectionName} · {formatVN(view.meeting.startsAt, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} ·{" "}
        {formatTime(view.meeting.startsAt)}
      </p>
      <NotesClient meetingId={params.meetingId} initial={initial} attendanceHref={meetingPage} />
    </main>
  );
}
