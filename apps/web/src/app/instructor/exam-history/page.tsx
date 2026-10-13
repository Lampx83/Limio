import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, FlaskConical, History, Zap, type LucideIcon } from "lucide-react";
import { listExamRuns, type ExamRun } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamRunsList from "../organize/ExamRunsList";
import { RUN_KIND, runKind } from "../organize/runKind";

export const dynamic = "force-dynamic";

/** Đủ rộng cho một học kỳ; mỗi lần thi tốn vài truy vấn đếm lượt nên không lấy vô hạn. */
const LIMIT = 100;

type Tab = "all" | "quick" | "field-test" | "formal";

// Icon mỗi tab tô đúng màu hình thức của nó — tab cũng là chú giải màu cho thẻ.
const TABS: { key: Tab; label: string; Icon: LucideIcon; iconClass?: string }[] = [
  { key: "all", label: "Tất cả", Icon: History },
  { key: "quick", label: RUN_KIND.quick.label, Icon: Zap, iconClass: RUN_KIND.quick.icon },
  {
    key: "field-test",
    label: RUN_KIND["field-test"].label,
    Icon: FlaskConical,
    iconClass: RUN_KIND["field-test"].icon,
  },
  { key: "formal", label: RUN_KIND.formal.label, Icon: CalendarCheck, iconClass: RUN_KIND.formal.icon },
];

function matches(tab: Tab, r: ExamRun): boolean {
  return tab === "all" || runKind(r) === tab;
}

/**
 * Lịch sử thi — mọi lần thi của giảng viên ở một chỗ, chia tab theo hình thức.
 *
 * Ba trang Tổ chức thi vẫn giữ lịch sử CÙNG DẠNG ngay dưới phần tạo mới (đúng
 * lúc đang tổ chức). Trang này cho câu hỏi khác: "tuần trước mình đã thi những
 * gì" — không cần nhớ lần đó tổ chức theo hình thức nào.
 *
 * Lấy một lần rồi lọc tại chỗ, để số trên các tab luôn khớp với danh sách.
 */
export default async function ExamHistoryPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/exam-history");

  const tab: Tab = TABS.some((t) => t.key === searchParams.type)
    ? (searchParams.type as Tab)
    : "all";

  const runs = await listExamRuns(session.user.id, { limit: LIMIT });
  const shown = runs.filter((r) => matches(tab, r));

  return (
    <main>
      <h1 className="text-2xl font-bold">Lịch sử thi</h1>
      <p className="mt-1 text-body text-faint">
        Mọi lần thi bạn đã tổ chức. Bấm “Kết quả” để xem chi tiết, hoặc “Tải” để lấy
        file điểm.
      </p>

      <nav
        role="tablist"
        aria-label="Lọc theo hình thức thi"
        className="mt-5 flex gap-1 overflow-x-auto border-b border-token"
      >
        {TABS.map(({ key, label, Icon, iconClass }) => {
          const isActive = key === tab;
          const count = runs.filter((r) => matches(key, r)).length;
          return (
            <Link
              key={key}
              role="tab"
              aria-selected={isActive}
              href={key === "all" ? "/instructor/exam-history" : `/instructor/exam-history?type=${key}`}
              scroll={false}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-lime-600 text-lime-700 dark:border-lime-400 dark:text-lime-300"
                  : "border-transparent text-muted hover:border-token hover:text-default"
              }`}
            >
              <Icon aria-hidden size={16} strokeWidth={1.75} className={iconClass} />
              <span>{label}</span>
              <span className="text-xs font-normal text-faint tabular-nums">{count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <ExamRunsList
          runs={shown}
          showRooms
          showKind={tab === "all"}
          emptyHint={
            runs.length === 0
              ? "Chưa có lần thi nào. Mở thi ở mục Tổ chức thi."
              : "Chưa có lần thi nào theo hình thức này."
          }
        />
      </div>

      {runs.length >= LIMIT && (
        <p className="mt-4 text-caption text-faint">
          Đang hiện {LIMIT} lần thi gần nhất.
        </p>
      )}

      {runs.length === 0 && (
        <p className="mt-4 text-sm">
          <Link href="/instructor/organize" className="underline">
            Tới Tổ chức thi →
          </Link>
        </p>
      )}
    </main>
  );
}
