"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import type { AcademicTermLike } from "@feedbackme/shared-types";
import WorkspaceCalendar, { type CalendarAssignment } from "./calendar/WorkspaceCalendar";

interface CalendarData {
  todayKey: string;
  organizationName: string | null;
  terms: AcademicTermLike[];
  assignments: CalendarAssignment[];
}

/**
 * Nút lịch ở thanh đầu trang giảng viên, đặt cạnh chuông thông báo. Bấm mở lịch tuần (đổi được sang tháng) ngay
 * dưới nút, ở bất kỳ trang nào. Dữ liệu chỉ tải lần đầu bấm mở: thanh đầu trang dựng ở mọi trang nên không để truy
 * vấn lịch đi kèm mỗi lần.
 */
export default function HeaderCalendar() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CalendarData | null>(null);
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    fetch(apiUrl("/api/instructor/calendar"))
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as CalendarData | null;
        if (!res.ok || !body) throw new Error("calendar");
        setData(body);
      })
      .catch(() => {
        requested.current = false;
        setFailed(true);
      });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setOpen((v) => !v);
        }}
        aria-label="Lịch"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--text-muted))] transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
      >
        <CalendarDays size={18} aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-x-4 top-[4.5rem] z-50 rounded-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] border border-token bg-[rgb(var(--surface))] p-1 shadow-2xl [&>section]:border-0 [&>section]:shadow-none">
          {data ? (
            <WorkspaceCalendar
              todayKey={data.todayKey}
              organizationName={data.organizationName}
              terms={data.terms}
              assignments={data.assignments}
              defaultView="week"
            />
          ) : failed ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Chưa tải được lịch. Thầy/cô thử lại sau ít phút.</p>
          ) : (
            <div className="h-40 animate-pulse rounded-xl bg-[rgb(var(--surface-muted))]" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
