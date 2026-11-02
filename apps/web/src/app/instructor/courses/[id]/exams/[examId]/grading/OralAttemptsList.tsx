"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DeleteOralAttemptButton from "@/components/exam/DeleteOralAttemptButton";
import { StatusBadge } from "@/components/ui";
import { apiUrl } from "@/lib/apiUrl";

export interface OralAttemptRow {
  id: string;
  studentLabel: string;
  email: string | null;
  submittedAtLabel: string | null;
  graded: boolean;
  aiSuggestedScore: number | null;
  instructorScore: number | null;
}

/** Lấy tên file server đặt, ưu tiên bản UTF-8 để giữ dấu tiếng Việt. */
function filenameFromResponse(res: Response): string {
  const header = res.headers.get("content-disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? "van-dap.docx";
}

/** Danh sách lượt vấn đáp đã kết thúc, tick chọn người rồi xuất Word. */
export default function OralAttemptsList({
  examId,
  gradingPath,
  attempts,
}: {
  examId: string;
  gradingPath: string;
  attempts: OralAttemptRow[];
}) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tính lại từ danh sách hiện tại: lượt vừa bị xoá không còn được tính là đã chọn.
  const selectedIds = attempts.filter((a) => ticked.has(a.id)).map((a) => a.id);
  const count = selectedIds.length;
  const allSelected = count === attempts.length;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = count > 0 && !allSelected;
  }, [count, allSelected]);

  function toggle(id: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/oral-export/docx-batch`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(count > 0 ? { attemptIds: selectedIds } : {}),
      });
      if (!res.ok) {
        setError(
          res.status === 404
            ? "Không còn lượt thi nào để xuất. Vui lòng tải lại trang."
            : "Không xuất được file. Vui lòng thử lại.",
        );
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromResponse(res);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không xuất được file. Vui lòng kiểm tra kết nối rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  let exportLabel: string;
  if (count > 1) exportLabel = `Xuất ${count} file Word (.zip)`;
  else if (count === 1 || attempts.length === 1) exportLabel = "Xuất Word";
  else exportLabel = "Xuất tất cả file Word (.zip)";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-white px-4 py-2">
        <label className="flex min-h-[32px] cursor-pointer items-center gap-3 text-sm">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={() => setTicked(allSelected ? new Set() : new Set(attempts.map((a) => a.id)))}
            className="h-4 w-4"
          />
          Chọn tất cả
          <span className="text-caption text-faint">
            Đã chọn {count}/{attempts.length}
          </span>
        </label>
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="rounded border border-default px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Đang tạo file…" : exportLabel}
        </button>
      </div>
      {error && (
        <p role="alert" className="banner-danger mt-2 text-sm">
          {error}
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {attempts.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-default bg-white p-4 hover:border-brand-400"
          >
            <input
              type="checkbox"
              checked={ticked.has(a.id)}
              onChange={() => toggle(a.id)}
              aria-label={`Chọn ${a.studentLabel}`}
              className="h-4 w-4 shrink-0"
            />
            {/* Điện thoại: chiếm hết hàng để email không đè lên nhãn trạng thái ở hàng dưới. */}
            <Link
              href={`${gradingPath}/${a.id}`}
              className="min-w-0 flex-1 basis-[calc(100%-1.75rem)] sm:basis-0"
            >
              <p className="text-sm font-medium">{a.studentLabel}</p>
              <p className="break-words text-caption text-faint">
                {a.email}
                {a.submittedAtLabel && ` · Nộp ${a.submittedAtLabel}`}
              </p>
            </Link>
            <div className="flex items-center gap-2 pl-7 sm:pl-0">
              {a.aiSuggestedScore !== null && !a.graded && (
                <span className="text-caption text-faint">AI gợi ý: {a.aiSuggestedScore}</span>
              )}
              {a.graded ? (
                <StatusBadge tone="success">Đã chấm — {a.instructorScore}/100</StatusBadge>
              ) : (
                <StatusBadge tone="warning">Chờ chấm</StatusBadge>
              )}
              <DeleteOralAttemptButton attemptId={a.id} studentLabel={a.studentLabel} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
