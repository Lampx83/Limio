import Link from "next/link";
import { addDays, listTeacherMeetings, type MeetingItem } from "@feedbackme/core-lms";
import { formatTime, toDayKey, formatVN } from "@/lib/datetime";
import MeetingsCalendar from "@/components/calendar/MeetingsCalendar";

/**
 * Trang chủ của giảng viên trung tâm (chỉ dạy): "Hôm nay tôi dạy" + 7 ngày tới, mỗi buổi kèm giáo án, liên kết mở
 * bài và nút điểm danh. Không có lối tắt soạn (tạo slide, đề thi, khoá học). CENTER mục H.
 */
export default async function CenterTeacherHome({ userId, displayName }: { userId: string; displayName: string | null }) {
  const now = new Date();
  const today = toDayKey(now);
  const meetings = (await listTeacherMeetings(userId, { from: today, to: addDays(today, 7) })).filter((m) => m.status !== "cancelled");
  const todays = meetings.filter((m) => toDayKey(m.startsAt) === today);
  const upcoming = meetings.filter((m) => toDayKey(m.startsAt) !== today);

  return (
    <main>
      <h1 className="text-h1">Hôm nay tôi dạy</h1>
      <p className="mt-1 text-sm text-muted">
        {displayName ? `Chào ${displayName}. ` : ""}Các buổi được xếp cho thầy/cô; lịch, bài học và thi cử do chủ trung tâm sắp sẵn.
      </p>

      <section className="mt-6" aria-labelledby="hom-nay">
        <h2 id="hom-nay" className="text-h3">
          Hôm nay
        </h2>
        {todays.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Hôm nay thầy/cô không có buổi nào.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {todays.map((m) => (
              <MeetingCard key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8" aria-labelledby="sap-toi">
          <h2 id="sap-toi" className="text-h3">
            7 ngày tới
          </h2>
          <ul className="mt-3 space-y-3">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} m={m} showDay />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8" aria-labelledby="lich-cua-toi">
        <h2 id="lich-cua-toi" className="text-h3">
          Lịch dạy của tôi
        </h2>
        <div className="mt-3 max-w-3xl">
          <MeetingsCalendar userId={userId} audience="instructor" />
        </div>
      </section>
    </main>
  );
}

function MeetingCard({ m, showDay = false }: { m: MeetingItem; showDay?: boolean }) {
  const classUrl = `/instructor/courses/${m.courseId}/sections/${m.sectionId}`;
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-meta">
            {showDay && `${formatVN(m.startsAt, { weekday: "long", day: "2-digit", month: "2-digit" })} · `}
            {formatTime(m.startsAt)}–{formatTime(m.endsAt)}
            {m.room ? ` · Phòng ${m.room}` : ""}
          </p>
          <p className="mt-0.5 text-h4">{m.plan?.title ?? (m.seq ? `Buổi ${m.seq}` : "Buổi dạy bù")}</p>
          <Link href={classUrl} className="text-sm text-lime-700 hover:underline dark:text-lime-400">
            {m.sectionName}
          </Link>
        </div>
        <Link href={`${classUrl}/meetings/${m.id}`} className="btn-primary btn-sm">
          Điểm danh
        </Link>
      </div>
      {m.plan && m.plan.lessons.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-medium">Bài của buổi:</span>{" "}
          {m.plan.lessons.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ", "}
              <Link href={`/learn/${m.plan!.courseSlug}/lessons/${l.id}`} className="underline underline-offset-2 hover:text-[rgb(var(--text))]">
                {l.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
