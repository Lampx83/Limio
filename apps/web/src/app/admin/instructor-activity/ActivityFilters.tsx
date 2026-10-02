"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

export type InstructorOption = { id: string; label: string; count: number };

const RANGES = [
  { id: "7", label: "7 ngày qua" },
  { id: "30", label: "30 ngày qua" },
  { id: "all", label: "Tất cả thời gian" },
];

/**
 * Thanh lọc: giảng viên · nhóm hành động · khoảng thời gian. Đổi là áp dụng
 * ngay (không có nút "Lọc"); trang đọc lại searchParams ở server.
 */
export default function ActivityFilters({
  instructors,
  categories,
  defaultRange,
}: {
  instructors: InstructorOption[];
  categories: { id: string; label: string }[];
  defaultRange: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const instructor = sp.get("instructor") ?? "";
  const cat = sp.get("cat") ?? "";
  const range = sp.get("range") ?? defaultRange;
  const isFiltered = Boolean(instructor || cat || range !== defaultRange);

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("limit"); // đổi bộ lọc thì quay về trang đầu
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  const active = instructors.filter((i) => i.count > 0);
  const idle = instructors.filter((i) => i.count === 0);
  const selectCls =
    "input h-9 w-full py-0 text-sm sm:w-auto sm:min-w-[11rem]";

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${pending ? "opacity-60" : ""}`}
      aria-busy={pending}
    >
      <select
        value={instructor}
        onChange={(e) => set("instructor", e.target.value)}
        className={`${selectCls} sm:max-w-[16rem]`}
        aria-label="Lọc theo giảng viên"
      >
        <option value="">Tất cả giảng viên</option>
        {active.length > 0 && (
          <optgroup label="Có hoạt động">
            {active.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label} ({i.count})
              </option>
            ))}
          </optgroup>
        )}
        {idle.length > 0 && (
          <optgroup label="Chưa có hoạt động">
            {idle.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <select
        value={cat}
        onChange={(e) => set("cat", e.target.value)}
        className={selectCls}
        aria-label="Lọc theo nhóm hành động"
      >
        <option value="">Mọi loại hành động</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={range}
        onChange={(e) => set("range", e.target.value === defaultRange ? "" : e.target.value)}
        className={selectCls}
        aria-label="Lọc theo khoảng thời gian"
      >
        {RANGES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>

      {isFiltered && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname))}
          className="btn-ghost btn-sm inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <X size={14} aria-hidden /> Xoá lọc
        </button>
      )}
    </div>
  );
}
