import { redirect } from "next/navigation";
import { listLearnerMeetings, listMyAttendance, getMyAttendanceSummary, addDays } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ScheduleWeek, { todayKey, weekStartOf } from "@/components/ScheduleWeek";

export const dynamic = "force-dynamic";

export default async function LichHocPage({ searchParams }: { searchParams: { tuan?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/lich-hoc");

  const given = searchParams.tuan && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tuan) ? searchParams.tuan : null;
  const weekStart = weekStartOf(given ?? todayKey());
  const range = { from: weekStart, to: addDays(weekStart, 6) };
  const [meetings, myRows, summaries] = await Promise.all([
    listLearnerMeetings(session.user.id, range),
    listMyAttendance(session.user.id, range),
    getMyAttendanceSummary(session.user.id),
  ]);
  const statusByMeeting = new Map(myRows.map((r) => [r.meetingId, r.status]));
  const withStatus = meetings.map((m) => ({ ...m, myStatus: statusByMeeting.get(m.id) ?? null }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Lịch học</h1>
      <p className="mt-1 text-sm text-muted">Các buổi học của những lớp bạn đang tham gia.</p>
      {summaries.length > 0 && (
        <section className="mt-5" aria-label="Chuyên cần của bạn">
          <h2 className="text-h4">Chuyên cần của bạn</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {summaries.map((s) => {
              const total = s.present + s.late + s.absent + s.excused;
              return (
                <li key={s.sectionId}>
                  <span className="font-medium text-[rgb(var(--text))]">{s.sectionName}</span>: có mặt {s.present + s.late}/{total} buổi
                  {s.late > 0 ? ` (trong đó ${s.late} buổi đi muộn)` : ""}
                  {s.absent > 0 ? `, vắng ${s.absent}` : ""}
                  {s.excused > 0 ? `, vắng có phép ${s.excused}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="mt-6">
        <ScheduleWeek weekStart={weekStart} meetings={withStatus} basePath="/me/lich-hoc" />
      </div>
    </main>
  );
}
