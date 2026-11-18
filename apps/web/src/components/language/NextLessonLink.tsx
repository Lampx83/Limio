"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PRACTICE_COMPLETE_EVENT } from "@/lib/practiceTabMeta";

/**
 * Nút "Tiếp" của thanh đáy (docs/tieu-chi/limio-language-ux-dieu-huong-bai.md, H3–H4): hai dòng (dòng trên là việc hoặc tên chủ đề kế, dòng dưới là tên bài).
 * `quiet`: bài có Bài luyện chưa kiểm hết → nút viền (phụ); kiểm xong thì thành nút đặc ngay khi khu bài luyện báo (không cần tải lại trang).
 */
export default function NextLessonLink({ href, headline, headlineShort, sub, title, quiet: initialQuiet }: { href: string; headline: string; /** Bản ngắn của dòng trên cho màn hẹp (dưới sm), vd "Tiếp". */ headlineShort?: string; sub?: string; title?: string; quiet: boolean }) {
  const [quiet, setQuiet] = useState(initialQuiet);
  useEffect(() => {
    setQuiet(initialQuiet);
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<{ done?: boolean }>).detail;
      if (d && typeof d.done === "boolean") setQuiet(!d.done);
    };
    window.addEventListener(PRACTICE_COMPLETE_EVENT, onDone);
    return () => window.removeEventListener(PRACTICE_COMPLETE_EVENT, onDone);
  }, [initialQuiet]);
  return (
    <Link
      href={href}
      title={title}
      data-tone={quiet ? "quiet" : "primary"}
      className={`btn btn-sm min-w-0 max-w-[9.5rem] flex-col items-end gap-0 py-1 text-right leading-tight sm:max-w-[16rem] ${
        quiet ? "border-2 border-brand-600 bg-[rgb(var(--surface))] text-brand-800 hover:bg-brand-50" : "bg-brand-600 text-white shadow-sm hover:bg-brand-700"
      }`}
    >
      <span className="whitespace-nowrap font-semibold">
        {headlineShort ? (
          <>
            <span className="sm:hidden">{headlineShort}</span>
            <span className="hidden sm:inline">{headline}</span>
          </>
        ) : (
          headline
        )}{" "}
        →
      </span>
      {sub && <small className={`block w-full truncate text-[0.7rem] font-normal ${quiet ? "text-muted" : "opacity-90"}`}>{sub}</small>}
    </Link>
  );
}
