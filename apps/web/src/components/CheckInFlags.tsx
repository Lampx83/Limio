import type { CheckInRow } from "@feedbackme/core-lms";
import { CHECKIN_FLAG_CLASS, CHECKIN_FLAG_LABEL, CHECKIN_STATE_LABEL, checkInDetail } from "@/lib/checkInLabels";

/** Các nhãn đối chiếu của một buổi (đúng giờ, trễ, dạy thay…), dùng chung cho trang giáo viên và trang quản trị. */
export default function CheckInFlags({ row }: { row: Pick<CheckInRow, "state" | "flags" | "minutesAfterStart" | "minutesBeforeEnd" | "attendanceMissing" | "editedByAdmin"> }) {
  const detail = checkInDetail(row);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {row.flags.length === 0 ? (
        <span className="chip">{CHECKIN_STATE_LABEL[row.state]}</span>
      ) : (
        row.flags.map((f) => (
          <span key={f} className={CHECKIN_FLAG_CLASS[f]}>
            {CHECKIN_FLAG_LABEL[f]}
          </span>
        ))
      )}
      {row.attendanceMissing && <span className="chip-warning">Chưa điểm danh</span>}
      {row.editedByAdmin && <span className="chip">Quản trị bổ sung</span>}
      {detail && <span className="text-caption text-muted">{detail}</span>}
    </div>
  );
}
