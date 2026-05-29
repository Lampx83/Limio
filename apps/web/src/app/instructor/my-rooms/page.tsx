import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, Eye, MapPin, Target } from "lucide-react";
import { listMyProctorRooms } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type Status = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<Status, string> = {
  draft: "Đợi giờ",
  open: "Đang diễn ra",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-amber-100 text-amber-800",
};

export default async function MyRoomsPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/my-rooms");
  const userId = session.user.id;

  const rooms = await listMyProctorRooms(userId);
  const now = Date.now();

  return (
    <main>
      <Link
        href="/instructor/dashboard"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="mt-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Eye className="h-6 w-6 shrink-0 text-amber-600" /> Giám sát phòng thi</h1>
        <p className="mt-1 text-sm text-faint">
          {rooms.length} phòng thi được phân công cho bạn. Click 1 phòng để
          điểm danh và monitor.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          Bạn chưa được phân công làm giám thị phòng nào.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rooms.map((r) => {
            const opensAt = new Date(r.opensAt).getTime();
            const closesAt = new Date(r.closesAt).getTime();
            const isFuture = opensAt > now;
            const isLive = opensAt <= now && now < closesAt;
            const detailHref = `/instructor/exam-rounds/${r.roundId}/sessions/${r.sessionId}/rooms/${r.id}`;
            const projHref = `/proctor/rooms/${r.id}/projection`;
            return (
              <li
                key={r.id}
                className="rounded-lg border border-default bg-white p-4 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={detailHref}
                        className="text-base font-semibold hover:text-blue-700"
                      >
                        {r.name}
                      </Link>
                      <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600">
                        STT {r.orderIndex}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[r.sessionStatus]}`}
                      >
                        {STATUS_LABEL[r.sessionStatus]}
                      </span>
                      {isLive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          ĐANG DIỄN RA
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-faint">
                      <BookOpen className="inline h-3 w-3 align-text-bottom text-slate-400" /> {r.examTitle}{" "}
                      <span className="text-slate-400">({r.courseTitle})</span>
                    </div>
                    <div className="mt-0.5 text-xs text-faint">
                      <Target className="inline h-3 w-3 align-text-bottom text-slate-400" /> Đợt:{" "}
                      <Link
                        href={`/instructor/exam-rounds/${r.roundId}`}
                        className="hover:underline"
                      >
                        {r.roundTitle}
                      </Link>{" "}
                      · <CalendarDays className="inline h-3 w-3 align-text-bottom text-slate-400" /> {r.sessionTitle ?? "Ca thi"}
                    </div>
                    <div className="mt-0.5 text-xs text-faint">
                      ⏰ {formatDate(r.opensAt)} → {formatDate(r.closesAt)}
                      {isFuture && (
                        <span className="ml-2 text-blue-600">
                          (bắt đầu sau {formatRel(opensAt - now)})
                        </span>
                      )}
                    </div>
                    {r.locationNote && (
                      <div className="mt-0.5 text-xs text-faint">
                        <MapPin className="inline h-3 w-3 align-text-bottom text-slate-400" /> {r.locationNote}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="text-right text-xs">
                      <div className="font-medium">
                        {r.arrivedCount}/{r.candidateCount} có mặt
                      </div>
                      <div className="text-faint">thí sinh điểm danh</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={detailHref}
                        className="rounded border border-default px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Điểm danh & monitor
                      </Link>
                      <Link
                        href={projHref}
                        target="_blank"
                        className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                      >
                        Chiếu mã thi
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}

function formatRel(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ ${m % 60} phút`;
  const d = Math.floor(h / 24);
  return `${d} ngày`;
}
