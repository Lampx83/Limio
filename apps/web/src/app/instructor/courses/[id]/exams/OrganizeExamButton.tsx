"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";

export default function OrganizeExamButton({
  examId,
  isDraft,
}: {
  examId: string;
  isDraft: boolean;
}) {
  const [showHint, setShowHint] = useState(false);

  if (!isDraft) {
    return (
      <Link
        href={`/instructor/exam-rounds?examId=${examId}`}
        className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Tổ chức thi
      </Link>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowHint(true)}
        className="inline-flex items-center gap-1.5 rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500"
      >
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" /> Tổ chức thi
      </button>
      {showHint && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 shadow-md">
          Bạn cần publish đề mới tổ chức thi được.
          <button
            type="button"
            onClick={() => setShowHint(false)}
            className="ml-1.5 font-medium underline"
          >
            Đã hiểu
          </button>
        </div>
      )}
    </div>
  );
}
