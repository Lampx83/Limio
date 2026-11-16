/**
 * Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md). Trang chỉ đọc: phát hành, doanh thu,
 * người học (ẩn danh), học liệu. Ai được xem: xem core-lms/src/reports/access.ts.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { listReportCourses, recordReportViewed } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import { parseReportRange } from "@/lib/reportApi";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Báo cáo nhà xuất bản" };

const RANGES = [
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Từ đầu" },
] as const;

export default async function PublisherReportPage({
  searchParams,
}: {
  searchParams: { course?: string; range?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/bao-cao");
  const userId = session.user.id;

  const courses = await listReportCourses(userId);
  if (courses.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          title="Chưa có khoá nào để báo cáo"
          description="Báo cáo hiện cho các khoá thuộc tổ chức mà bạn quản trị hoặc được cấp quyền xem, và các khoá có bán mà bạn là giảng viên chủ khoá. Nếu khoá của nhà xuất bản chưa hiện, hãy nhờ quản trị viên gắn khoá vào tổ chức."
        />
      </main>
    );
  }

  const selected = courses.find((c) => c.id === searchParams.course) ?? courses[0]!;
  const range = parseReportRange(searchParams.range);
  const rangeKey = String(range);
  // Ghi sự kiện mở trang không bao giờ được làm hỏng trang.
  await recordReportViewed(userId, selected.id).catch(() => undefined);

  const href = (course: string, r: string) => `/bao-cao?course=${encodeURIComponent(course)}&range=${r}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <div className="mb-6">
        <p className="text-meta">Báo cáo nhà xuất bản</p>
        <h1 className="text-h1 mt-1">{selected.title}</h1>
        <p className="text-meta mt-1">
          {selected.organizationName ? `Tổ chức: ${selected.organizationName}. ` : ""}
          Số liệu tổng hợp, không có danh tính người học. Nhóm dưới 10 người không hiện tỉ lệ.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {courses.length > 1 ? (
          <nav aria-label="Chọn khoá" className="flex flex-wrap gap-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={href(c.id, rangeKey)}
                className={c.id === selected.id ? "chip-brand" : "chip"}
                aria-current={c.id === selected.id ? "page" : undefined}
              >
                {c.title}
              </Link>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <nav aria-label="Khoảng thời gian" className="flex gap-1 rounded-lg border border-token p-1">
          {RANGES.map((r) => (
            <Link
              key={r.value}
              href={href(selected.id, r.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-sm ${rangeKey === r.value ? "bg-brand-600 text-white" : "text-muted hover:bg-gray-100 dark:hover:bg-white/5"}`}
              aria-current={rangeKey === r.value ? "true" : undefined}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <ReportClient courseId={selected.id} range={rangeKey} />
    </main>
  );
}
