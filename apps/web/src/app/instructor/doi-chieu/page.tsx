import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyCheckIns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getInstructorCenterAccess } from "@/lib/centerAccess";
import { formatVN, formatTime } from "@/lib/datetime";
import { resolveWeek } from "@/lib/weekRange";
import CheckInFlags from "@/components/CheckInFlags";
import WeekNav from "@/components/WeekNav";
import EmptyState from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

/** Đối chiếu lịch dạy của chính mình (CENTER C5.7): các buổi được xếp, giờ vào/ra và ai đã dạy. */
export default async function DoiChieuPage({ searchParams }: { searchParams: { tuan?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/doi-chieu");
  if (!(await getInstructorCenterAccess(session.user.id))) redirect("/instructor/dashboard");

  const week = resolveWeek(searchParams.tuan);
  const rows = await listMyCheckIns(session.user.id, { from: week.from, to: week.to });

  return (
    <main>
      <Link href="/instructor/lich-day" className="text-sm font-medium text-lime-700 hover:underline dark:text-lime-400">
        ← Lịch dạy
      </Link>
      <h1 className="mt-3 text-h1">Đối chiếu lịch dạy của tôi</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Các buổi thầy/cô được xếp trong tuần, giờ bắt đầu và kết thúc thực tế. Trang này chỉ để đối chiếu với lịch và xếp dạy bù khi có
        buổi lệch; chỉ thầy/cô và quản trị trường xem được.
      </p>
      <div className="mt-4">
        <WeekNav week={week} basePath="/instructor/doi-chieu" />
      </div>
      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Tuần này chưa có buổi nào" description="Các buổi thầy/cô được xếp dạy sẽ hiện ở đây." />
        </div>
      ) : (
        <ul className="mt-6 max-w-3xl divide-y divide-[rgb(var(--border))] card">
          {rows.map((r) => (
            <li key={r.meetingId} className="p-4">
              <Link
                href={`/instructor/courses/${r.courseId}/sections/${r.sectionId}/meetings/${r.meetingId}`}
                className="font-medium hover:underline"
              >
                {r.courseTitle} · {r.sectionName}
                {r.seq ? ` · Buổi ${r.seq}` : ""}
              </Link>
              <p className="mt-0.5 text-sm text-muted">
                {formatVN(r.startsAt, { weekday: "long", day: "2-digit", month: "2-digit" })} · {formatTime(r.startsAt)}–{formatTime(r.endsAt)}
                {r.actualTeacher && r.actualTeacher.id !== session.user.id ? ` · ${r.actualTeacher.name} dạy` : ""}
              </p>
              <div className="mt-2">
                <CheckInFlags row={r} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
