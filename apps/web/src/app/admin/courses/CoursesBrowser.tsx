"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice, isFree } from "@/lib/formatPrice";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  publicAccess: boolean;
  isSample: boolean;
  isLearnerSample: boolean;
  enrollMode: string;
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

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

/** Công tắc bật/tắt kèm nhãn; hiện rõ "đang bật" thay vì ô tick với chữ "Không". */
function SampleSwitch({
  label,
  checked,
  disabled,
  title,
  ariaLabel,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  title: string;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-[rgb(var(--border))]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span className={checked ? "font-medium text-[rgb(var(--text))]" : "text-muted"}>{label}</span>
    </button>
  );
}

export default function CoursesBrowser() {
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [savingSample, setSavingSample] = useState<string | null>(null);

  async function toggleSample(c: CourseRow, next: boolean) {
    setSampleError(null);
    setSavingSample(c.id);
    try {
      const r = await fetch(apiUrl(`/api/admin/courses/${c.id}/sample`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSample: next }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setSampleError(
          d.error === "sample_requires_public"
            ? `"${c.title}" cần đã publish và bật đọc công khai thì mới làm khoá mẫu được.`
            : "Không lưu được, thử lại sau.",
        );
        return;
      }
      setData((d) =>
        d ? { ...d, courses: d.courses.map((x) => (x.id === c.id ? { ...x, isSample: next } : x)) } : d,
      );
    } finally {
      setSavingSample(null);
    }
  }

  // Khoá mẫu cho học viên: "Học thử" ghi danh thật nên khoá phải published + tự ghi danh + miễn phí.
  async function toggleLearnerSample(c: CourseRow, next: boolean) {
    setSampleError(null);
    setSavingSample(c.id);
    try {
      const r = await fetch(apiUrl(`/api/admin/courses/${c.id}/learner-sample`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setSampleError(
          d.error === "learner_sample_requires_open_free"
            ? `"${c.title}" cần đã publish, cho học viên tự ghi danh và miễn phí thì mới làm khoá mẫu cho học viên được.`
            : "Không lưu được, thử lại sau.",
        );
        return;
      }
      setData((d) =>
        d ? { ...d, courses: d.courses.map((x) => (x.id === c.id ? { ...x, isLearnerSample: next } : x)) } : d,
      );
    } finally {
      setSavingSample(null);
    }
  }

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

      {sampleError && (
        <p role="alert" className="banner-danger mb-3 rounded-lg px-3 py-2 text-sm">
          {sampleError}
        </p>
      )}

      <p className="mb-2 text-xs text-muted">
        <span className="font-medium text-[rgb(var(--text))]">Khoá mẫu</span> là khoá hiện sẵn cho người
        mới xem thử khi họ chưa có khoá nào. Công tắc mờ nghĩa là khoá chưa đủ điều kiện, rê chuột vào để
        biết còn thiếu gì.
      </p>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Khoá học</th>
              <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-2.5 text-left font-medium">Giá &amp; gói bán</th>
              <th className="px-4 py-2.5 text-left font-medium">Dùng làm khoá mẫu</th>
              <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
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
            {data?.courses.map((c) => {
              const busy = savingSample === c.id;
              // Giảng viên mới không ghi danh nên chỉ xem được khoá công khai. Đang là mẫu thì luôn cho
              // tắt, dù khoá đã đổi sang riêng tư.
              const teacherEligible = c.status === "published" && c.publicAccess;
              // "Học thử" ghi danh thật nên khoá phải published + tự ghi danh + miễn phí. Đang là mẫu thì
              // luôn cho tắt, dù khoá đã đổi sang có phí hay chỉ-link-mời.
              const learnerEligible = c.status === "published" && c.enrollMode === "open" && isFree(c.priceCents);
              return (
                <tr key={c.id} className="hover:bg-base-50">
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-faint">{c.slug}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[c.status] ?? "neutral"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </StatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium tabular-nums">
                      {isFree(c.priceCents) ? "Miễn phí" : formatPrice(c.priceCents!, c.currency)}
                    </p>
                    <p className={`text-xs ${c.activeAccessPlanCount === 0 ? "text-faint" : "text-muted"}`}>
                      {c.activeAccessPlanCount === 0
                        ? "Chưa có gói bán"
                        : `${c.activeAccessPlanCount} gói đang bán`}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="space-y-1.5">
                      <SampleSwitch
                        label="Cho giảng viên"
                        checked={c.isSample}
                        disabled={busy || (!c.isSample && !teacherEligible)}
                        title={
                          c.isSample || teacherEligible
                            ? "Hiện cho giảng viên chưa có khoá nào xem thử"
                            : "Cần publish và bật đọc công khai trước"
                        }
                        ariaLabel={`Khoá mẫu cho giảng viên: ${c.title}`}
                        onChange={(next) => void toggleSample(c, next)}
                      />
                      <SampleSwitch
                        label="Cho học viên"
                        checked={c.isLearnerSample}
                        disabled={busy || (!c.isLearnerSample && !learnerEligible)}
                        title={
                          c.isLearnerSample || learnerEligible
                            ? "Hiện ở thẻ “Thử học ngay” cho học viên chưa có khoá nào; nhiều khoá bật thì hiện khoá bật gần nhất"
                            : "Cần publish, cho tự ghi danh và miễn phí trước"
                        }
                        ariaLabel={`Khoá mẫu cho học viên: ${c.title}`}
                        onChange={(next) => void toggleLearnerSample(c, next)}
                      />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Link
                        href={`/admin/courses/${c.id}/access-plans`}
                        className="btn-secondary btn-sm"
                        prefetch={false}
                      >
                        Quản lý gói bán
                      </Link>
                      <Link
                        href={`/admin/courses/${c.id}/narrations`}
                        className="btn-ghost btn-sm"
                        prefetch={false}
                      >
                        Giọng đọc
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
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
