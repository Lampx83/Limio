/**
 * Thân trang Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md), dùng chung cho `/bao-cao` (mọi người được cấp quyền xem)
 * và `/org-admin/bao-cao` (khu quản trị nhà xuất bản, chỉ khoá của tổ chức đang chọn). Số liệu đi qua `core-lms/src/reports`.
 */
import Link from "next/link";
import { listReportCourses, recordReportViewed } from "@feedbackme/core-lms";
import EmptyState from "@/components/ui/EmptyState";
import { parseReportRange } from "@/lib/reportApi";
import ReportClient from "@/app/bao-cao/ReportClient";

const RANGES = [
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Từ đầu" },
] as const;

export default async function PublisherReportView({
  userId,
  basePath,
  searchParams,
  organizationId,
  extraQuery = "",
  kicker = true,
}: {
  userId: string;
  basePath: string;
  searchParams: { course?: string; range?: string };
  /** Chỉ báo cáo các khoá của tổ chức này (khu quản trị); bỏ trống = mọi khoá user được xem. */
  organizationId?: string;
  /** Tham số giữ nguyên khi chuyển khoá hay khoảng thời gian, dạng `&truong=...`. */
  extraQuery?: string;
  /** Dòng nhỏ "Báo cáo nhà xuất bản" phía trên tên khoá; khu quản trị đã có tiêu đề trang nên tắt đi. */
  kicker?: boolean;
}) {
  const courses = await listReportCourses(userId, undefined, organizationId);
  if (courses.length === 0) {
    return (
      <EmptyState
        title="Chưa có khoá nào để báo cáo"
        description="Báo cáo hiện cho các khoá thuộc tổ chức mà bạn quản trị hoặc được cấp quyền xem, và các khoá có bán mà bạn là giảng viên chủ khoá. Nếu khoá của nhà xuất bản chưa hiện, hãy nhờ quản trị viên gắn khoá vào tổ chức."
      />
    );
  }

  const selected = courses.find((c) => c.id === searchParams.course) ?? courses[0]!;
  const range = parseReportRange(searchParams.range);
  const rangeKey = String(range);
  // Ghi sự kiện mở trang không bao giờ được làm hỏng trang.
  await recordReportViewed(userId, selected.id).catch(() => undefined);

  const href = (course: string, r: string) => `${basePath}?course=${encodeURIComponent(course)}&range=${r}${extraQuery}`;

  return (
    <>
      <div className="mb-6">
        {kicker && <p className="text-meta">Báo cáo nhà xuất bản</p>}
        <h2 className="text-h1 mt-1">{selected.title}</h2>
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
    </>
  );
}
