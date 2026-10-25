import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Week } from "@/lib/weekRange";
import { formatDayKey } from "@/lib/datetime";

/** Chuyển tuần cho các trang đối chiếu lịch dạy: liên kết thường, trạng thái nằm trong ?tuan=YYYY-MM-DD. */
export default function WeekNav({ week, basePath }: { week: Week; basePath: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Chọn tuần">
      <Link href={`${basePath}?tuan=${week.prev}`} className="btn-pill" aria-label="Tuần trước">
        <ChevronLeft size={16} aria-hidden /> Tuần trước
      </Link>
      <span className="font-medium">
        {formatDayKey(week.from)} – {formatDayKey(week.to)}
      </span>
      <Link href={`${basePath}?tuan=${week.next}`} className="btn-pill" aria-label="Tuần sau">
        Tuần sau <ChevronRight size={16} aria-hidden />
      </Link>
      <Link href={basePath} className="btn-pill">
        Tuần này
      </Link>
    </nav>
  );
}
