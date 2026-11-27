import { CourseAuthzError, getOrgBoard, getOrgClassTimeline } from "@feedbackme/core-lms";
import EmptyState from "@/components/ui/EmptyState";
import { isDayKey, resolveWeek, shiftDay, todayVN, weekStart } from "@/lib/weekRange";
import CenterBoard from "./CenterBoard";
import type { BoardMode } from "./boardModel";

/**
 * Máy chủ của Bảng điều phối (CENTER M): đọc tham số `che_do` (ngay | tuan | ky) và `ngay` (YYYY-MM-DD), tải đúng khoảng một lần rồi giao cho
 * trình duyệt vẽ. Dùng chung cho `/org-admin/dieu-phoi` (quản trị trường) và `/instructor/dieu-phoi` (chủ khoá).
 */
export default async function CenterBoardView({
  userId,
  organizationId,
  orgName,
  basePath,
  orgParam,
  searchParams,
}: {
  userId: string;
  organizationId: string;
  orgName: string;
  basePath: string;
  /** Mã trường cần giữ trên mọi liên kết khi người xem chọn được nhiều trường (`?truong=`). */
  orgParam?: string;
  searchParams: { che_do?: string; ngay?: string; chu_y?: string };
}) {
  const mode: BoardMode = searchParams.che_do === "tuan" ? "tuan" : searchParams.che_do === "ky" ? "ky" : "ngay";
  const now = new Date();
  const today = todayVN(now);
  const anchor = isDayKey(searchParams.ngay) ? searchParams.ngay : today;

  let from: string;
  let to: string;
  let step: number;
  if (mode === "ngay") {
    from = to = anchor;
    step = 1;
  } else if (mode === "tuan") {
    const w = resolveWeek(anchor, now);
    from = w.from;
    to = w.to;
    step = 7;
  } else {
    from = shiftDay(weekStart(anchor), -14);
    to = shiftDay(from, 104);
    step = 56;
  }
  const extraQuery = orgParam ? `&truong=${encodeURIComponent(orgParam)}` : "";
  const href = (m: BoardMode, day: string) => `${basePath}?che_do=${m}${day === today ? "" : `&ngay=${day}`}${extraQuery}`;

  try {
    const [board, timeline] =
      mode === "ky"
        ? [null, await getOrgClassTimeline(userId, organizationId, { from, to }, now)]
        : [await getOrgBoard(userId, organizationId, { from, to }, now), null];
    return (
      <CenterBoard
        mode={mode}
        anchor={anchor}
        from={from}
        to={to}
        prevHref={href(mode, shiftDay(anchor, -step))}
        nextHref={href(mode, shiftDay(anchor, step))}
        todayHref={href(mode, today)}
        basePath={basePath}
        extraQuery={extraQuery}
        initialFlag={["no_teacher", "no_checkin", "no_attendance", "clash"].includes(searchParams.chu_y ?? "") ? searchParams.chu_y : undefined}
        modeHrefs={{ ngay: href("ngay", anchor), tuan: href("tuan", anchor), ky: href("ky", anchor) }}
        nowIso={now.toISOString()}
        orgName={orgName}
        board={board}
        timeline={timeline}
      />
    );
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return <EmptyState title="Không có quyền" description="Bảng điều phối dành cho quản trị trường và chủ khoá của trường này." />;
    }
    throw e;
  }
}
