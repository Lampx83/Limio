import Link from "next/link";
import { DoorOpen, Radio } from "lucide-react";

export interface RoomCell {
  id: string;
  name: string;
  proctorName: string | null;
  started: number;
  submitted: number;
  inProgress: number;
}

/**
 * Lưới PHÒNG THI của một ca — cấp giữa giữa "cả ca" và "từng thí sinh".
 *
 * Lưới thẻ từng người chỉ hợp với phòng (30–50). Một ca 200 người thì không
 * ai đọc nổi 200 thẻ, mà mỗi người xem lại phải nhận toàn bộ luồng sự kiện
 * của đề rồi tự lọc. Ở cấp này chỉ cần con số, và bấm vào phòng mới xuống
 * chi tiết.
 *
 * Số liệu là ảnh chụp lúc tải trang, không phải realtime — cấp này để nắm
 * tình hình chung, ai cần theo dõi sát thì vào phòng.
 */
export default function RoomGrid({
  courseId,
  examId,
  sessionId,
  rooms,
  reason,
}: {
  courseId: string;
  examId: string;
  sessionId: string;
  rooms: RoomCell[];
  /** Vì sao không hiện thẳng lưới thẻ. */
  reason: string;
}) {
  const tong = rooms.reduce(
    (s, r) => ({
      started: s.started + r.started,
      submitted: s.submitted + r.submitted,
      inProgress: s.inProgress + r.inProgress,
    }),
    { started: 0, submitted: 0, inProgress: 0 },
  );

  return (
    <div className="mt-6">
      <p className="banner-info px-3 py-2 text-sm">{reason}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <strong className="tabular-nums">{tong.inProgress}</strong> đang làm
        </span>
        <span>
          <strong className="tabular-nums">{tong.submitted}</strong> đã nộp
        </span>
        <span className="text-faint">
          {tong.started} lượt trong {rooms.length} phòng
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Link
            key={r.id}
            href={`/instructor/courses/${courseId}/exams/${examId}/live?sessionId=${sessionId}&roomId=${r.id}`}
            className="group rounded-lg border border-default bg-white p-3 transition-shadow hover:shadow-md"
            prefetch={false}
          >
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {r.name}
              </span>
              {r.inProgress > 0 && (
                <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse text-red-500" />
              )}
            </div>
            {r.proctorName && (
              <p className="mt-0.5 truncate text-caption text-faint">
                Giám thị: {r.proctorName}
              </p>
            )}
            <div className="mt-2 flex items-baseline gap-3 text-sm">
              <span className="tabular-nums">
                <strong>{r.inProgress}</strong>{" "}
                <span className="text-faint">đang làm</span>
              </span>
              <span className="tabular-nums text-faint">
                {r.submitted} đã nộp
              </span>
            </div>
          </Link>
        ))}
      </div>

      {rooms.length === 0 && (
        <p className="mt-4 text-sm text-faint">
          Ca này chưa có phòng thi nào có thí sinh.
        </p>
      )}
    </div>
  );
}
