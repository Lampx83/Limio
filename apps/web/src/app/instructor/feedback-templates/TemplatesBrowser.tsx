"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { TemplateRatingStats } from "@feedbackme/core-feedback";

interface TemplatesBrowserProps {
  stats: TemplateRatingStats[];
  total: number;
  page: number;
  pageCount: number;
  currentSort?: string;
  currentOrder?: string;
  currentStatus?: string;
  currentSearch?: string;
}

export default function TemplatesBrowser({
  stats,
  total,
  page,
  pageCount,
  currentSort = "netScore",
  currentOrder = "asc",
  currentStatus = "all",
  currentSearch = "",
}: TemplatesBrowserProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);

  const handleFilterChange = (status: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("status", status);
    params.set("page", "0");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams);
    const currentSortVal = params.get("sortBy");
    const currentOrderVal = params.get("sortOrder") ?? "asc";

    if (currentSortVal === column) {
      params.set("sortOrder", currentOrderVal === "asc" ? "desc" : "asc");
    } else {
      params.set("sortBy", column);
      params.set("sortOrder", "asc");
    }
    params.set("page", "0");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.set("page", "0");
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  const SortableHeader = ({
    label,
    column,
  }: {
    label: string;
    column: string;
  }) => {
    const isActive = currentSort === column;
    const isAsc = currentOrder === "asc";

    return (
      <button
        onClick={() => handleSort(column)}
        disabled={isPending}
        className="flex items-center gap-1 hover:text-brand-600 disabled:opacity-50"
      >
        {label}
        {isActive && (
          <span className="ml-1">
            {isAsc ? (
              <ChevronUp size={14} className="text-brand-600" />
            ) : (
              <ChevronDown size={14} className="text-brand-600" />
            )}
          </span>
        )}
      </button>
    );
  };

  const needsFixCount = stats.filter((s) => s.netScore < 0).length;
  const goodCount = stats.filter((s) => s.netScore > 0).length;
  const notRatedCount = stats.filter((s) => s.totalRated === 0).length;

  return (
    <>
      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Tổng templates" value={total} tone="brand" />
        <StatCard
          label="Cần sửa"
          value={needsFixCount}
          tone="accent"
          subtitle="(Net < 0)"
        />
        <StatCard label="Tốt" value={goodCount} tone="success" subtitle="(Net > 0)" />
        <StatCard
          label="Chưa rate"
          value={notRatedCount}
          tone="brand"
          subtitle="(0 ratings)"
        />
      </div>

      {/* Search & Filters */}
      <div className="mt-6 space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Tìm kiếm
          </label>
          <input
            type="search"
            placeholder="Nhập text để tìm kiếm template..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isPending}
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Lọc theo trạng thái
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "Tất cả", count: total },
              { value: "needsFix", label: "Cần sửa", count: needsFixCount },
              { value: "good", label: "Tốt", count: goodCount },
              { value: "notRated", label: "Chưa rate", count: notRatedCount },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => handleFilterChange(filter.value)}
                disabled={isPending}
                className={`btn btn-sm ${
                  currentStatus === filter.value ? "btn-primary" : "btn-secondary"
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {stats.length > 0 ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">
                  <SortableHeader label="Scope" column="scope" />
                </th>
                <th className="px-4 py-3">
                  <SortableHeader label="Body (snippet)" column="body" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader label="Đã gửi" column="delivered" />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader label="Đã rate" column="rated" />
                </th>
                <th className="px-4 py-3 text-right">👍</th>
                <th className="px-4 py-3 text-right">👎</th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader label="Net" column="netScore" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {stats.map((s) => (
                <tr
                  key={s.templateId}
                  className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="chip">{s.scope}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="line-clamp-2 max-w-md text-sm">{s.body}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums align-top">
                    {s.totalDelivered}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-faint align-top">
                    {s.totalRated}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-success-600 align-top">
                    {s.thumbsUp}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger-600 align-top">
                    {s.thumbsDown}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold align-top ${
                      s.netScore < 0
                        ? "text-danger-600"
                        : s.netScore > 0
                          ? "text-success-600"
                          : "text-faint"
                    }`}
                  >
                    {s.netScore > 0 ? "+" : ""}
                    {s.netScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-token p-12 text-center">
          <p className="text-muted">
            Không có template nào phù hợp với bộ lọc này.
          </p>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-muted">
            Trang {page + 1} / {pageCount} · Tổng {total} templates
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 0 || isPending}
              className="btn btn-secondary btn-sm"
            >
              ← Trước
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount - 1 || isPending}
              className="btn btn-secondary btn-sm"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: "brand" | "success" | "accent";
  subtitle?: string;
}

function StatCard({ label, value, tone = "brand", subtitle }: StatCardProps) {
  const toneClass = {
    brand: "text-brand-600",
    success: "text-success-600",
    accent: "text-accent-600",
  }[tone];

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className={`h-display text-2xl font-bold tabular-nums ${toneClass}`}>
          {value}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted sm:text-sm">{label}</div>
      {subtitle && <div className="mt-0.5 text-xs text-faint">{subtitle}</div>}
    </div>
  );
}
