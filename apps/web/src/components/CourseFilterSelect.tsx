"use client";

import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

/**
 * Bộ lọc khoá dạng dropdown (Forum Q&A, tab "Cần chấm" của Assignment) — nhiều khoá thì một hàng chip dài
 * chiếm chỗ và phải cuộn ngang. Mỗi lựa chọn mang sẵn href (đã ghép đúng bộ
 * lọc trạng thái hiện tại), chọn là điều hướng.
 */
export default function CourseFilterSelect({
  options,
  value,
}: {
  options: Array<{ value: string; label: string; href: string }>;
  value: string;
}) {
  const router = useRouter();
  return (
    <label className="relative flex w-full items-center sm:inline-flex sm:w-auto">
      <span className="sr-only">Lọc theo khoá học</span>
      <BookOpen
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
        aria-hidden
      />
      <select
        value={value}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (o) router.push(o.href);
        }}
        className="select !h-9 w-full !py-0 pl-9 text-sm font-medium sm:min-w-[14rem]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
