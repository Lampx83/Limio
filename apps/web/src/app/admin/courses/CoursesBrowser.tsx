"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice, isFree } from "@/lib/formatPrice";

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  activeAccessPlanCount: number;
}

interface CoursesResponse {
  courses: CourseRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

export default function CoursesBrowser() {
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(page));
    params.set("limit", "25");
    fetch(apiUrl(`/api/admin/courses?${params}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CoursesResponse | null) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, page]);

  return (
    <>
      <div className="card mb-4">
        <label htmlFor="courses-search" className="label">
          Tìm theo tên / slug
        </label>
        <input
          id="courses-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          className="input mt-1"
          placeholder="vd: Tiếng Trung, thiet-ke-ui-ux"
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Khoá học</th>
              <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-2 text-left font-medium">Giá vĩnh viễn</th>
              <th className="px-4 py-2 text-left font-medium">Gói bán</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !data && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {data?.courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Không có khoá học nào khớp.
                </td>
              </tr>
            )}
            {data?.courses.map((c) => (
              <tr key={c.id} className="hover:bg-base-50">
                <td className="px-4 py-2.5">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="truncate text-xs text-faint">{c.slug}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="chip">{STATUS_LABEL[c.status] ?? c.status}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted tabular-nums">
                  {isFree(c.priceCents) ? "Miễn phí" : formatPrice(c.priceCents!, c.currency)}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {c.activeAccessPlanCount === 0 ? (
                    <span className="text-faint">Chưa có gói</span>
                  ) : (
                    `${c.activeAccessPlanCount} gói đang bán`
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/courses/${c.id}/access-plans`}
                    className="btn-secondary btn-sm"
                    prefetch={false}
                  >
                    Quản lý gói bán
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            Trang {data.page + 1} / {data.pageCount} · {data.total} khoá học
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-ghost btn-sm"
            >
              ← Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pageCount - 1 || loading}
              className="btn-ghost btn-sm"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
