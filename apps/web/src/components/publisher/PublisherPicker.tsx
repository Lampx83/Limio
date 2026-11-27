import Link from "next/link";
import type { PublisherCourseRow, PublisherOrgRow } from "@feedbackme/core-lms";

/** Chọn nhà xuất bản (khi quản trị nhiều nơi) và khoá của nhà đó, bằng các nút liên kết giữ trạng thái trên địa chỉ. */
export default function PublisherPicker({
  basePath,
  orgs,
  org,
  courses,
  course,
}: {
  basePath: string;
  orgs: PublisherOrgRow[];
  org: PublisherOrgRow;
  courses: PublisherCourseRow[];
  course: PublisherCourseRow | null;
}) {
  const multi = orgs.length > 1;
  const q = (truong: string, khoa?: string) => `${basePath}?truong=${truong}${khoa ? `&khoa=${khoa}` : ""}`;
  return (
    <div className="space-y-3">
      {multi && (
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn nhà xuất bản">
          <span className="text-muted">Nhà xuất bản</span>
          {orgs.map((o) => (
            <Link key={o.id} href={q(o.id)} aria-current={o.id === org.id ? "page" : undefined} className={`btn-pill ${o.id === org.id ? "!bg-brand-500 !text-white" : ""}`}>
              {o.name}
            </Link>
          ))}
        </nav>
      )}
      {courses.length > 1 && (
        <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Chọn khoá">
          <span className="text-muted">Khoá</span>
          {courses.map((c) => (
            <Link key={c.id} href={q(org.id, c.id)} aria-current={c.id === course?.id ? "page" : undefined} className={c.id === course?.id ? "chip-brand" : "chip"}>
              {c.title}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
