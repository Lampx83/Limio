"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";

/**
 * Shown while the BullMQ auto-grade worker (or recovery cron fallback) is
 * still processing the attempt. Client-side reload every 4s — more reliable
 * than <meta http-equiv="refresh"> which some browsers ignore in <body>.
 * Stops after 20 retries (~80s) so a permanently-stuck job doesn't loop
 * forever; manual refresh button as escape hatch.
 */
export default function PendingPage({ examTitle }: { examTitle?: string }) {
  const router = useRouter();
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 20;

  useEffect(() => {
    if (retries >= MAX_RETRIES) return;
    const t = setTimeout(() => {
      setRetries((n) => n + 1);
      router.refresh();
    }, 4000);
    return () => clearTimeout(t);
  }, [retries, router]);

  const stuck = retries >= MAX_RETRIES;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10 text-center">
      <Clock
        className={`mx-auto h-16 w-16 text-amber-500 ${stuck ? "" : "animate-pulse"}`}
      />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">
        Đã nộp bài — đang chấm
      </h1>
      {examTitle && <p className="mt-1 text-sm text-faint">{examTitle}</p>}
      <p className="mt-3 text-sm text-slate-600">
        {stuck
          ? "Hệ thống vẫn đang chấm — vui lòng đợi thêm hoặc liên hệ giảng viên."
          : "Hệ thống đang chấm bài. Trang sẽ tự làm mới sau vài giây để hiển thị kết quả."}
      </p>
      {!stuck && (
        <p className="mt-2 text-[11px] text-faint">
          Lần kiểm tra: {retries + 1}/{MAX_RETRIES}
        </p>
      )}
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-4 inline-block rounded bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
      >
        Làm mới ngay
      </button>
      <Link
        href="/"
        className="mt-3 inline-block rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
