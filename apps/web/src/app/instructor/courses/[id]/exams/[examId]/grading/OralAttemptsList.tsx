"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlySuggested, setOnlySuggested] = useState(false);
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = onlySuggested ? attempts.filter((a) => a.aiSuggestedScore !== null) : attempts;
  // Tính lại từ danh sách hiện tại: lượt vừa bị xoá không còn được tính là đã chọn.
  const selectedIds = rows.filter((a) => ticked.has(a.id)).map((a) => a.id);
  const count = selectedIds.length;
  const allSelected = rows.length > 0 && count === rows.length;
  // Chỉ lượt đã có đề xuất AI và chưa chốt mới chốt theo đề xuất được.
  const appliable = rows.filter((a) => ticked.has(a.id) && a.aiSuggestedScore !== null && !a.graded);
  const withSuggestion = attempts.filter((a) => a.aiSuggestedScore !== null).length;

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

  async function onApply() {
    const n = appliable.length;
    if (n === 0) return;
    const ok = window.confirm(
      `Chốt theo đề xuất AI cho ${n} lượt?\n\nHệ thống sẽ GHI ĐIỂM THẬT đúng bằng điểm AI đề xuất và gửi nhận xét tóm tắt của AI làm ghi chú mà sinh viên sẽ đọc được. Thầy/cô nên xem lại đề xuất trước khi chốt.`,
    );
    if (!ok) return;
    setApplying(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/oral-ai-grade/apply`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptIds: appliable.map((a) => a.id) }),
      });
      const d = (await res.json().catch(() => ({}))) as { applied?: string[]; skipped?: unknown[] };
      if (!res.ok) {
        setError("Không chốt được. Vui lòng thử lại.");
        return;
      }
      const skipped = d.skipped?.length ?? 0;
      setNotice(`Đã chốt ${d.applied?.length ?? 0} lượt theo đề xuất AI${skipped > 0 ? `, bỏ qua ${skipped} lượt (đã chốt hoặc chưa có đề xuất)` : ""}.`);
      setTicked(new Set());
      router.refresh();
    } catch {
      setError("Mất kết nối tới máy chủ. Vui lòng thử lại.");
    } finally {
      setApplying(false);
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
            onChange={() => setTicked(allSelected ? new Set() : new Set(rows.map((a) => a.id)))}
            className="h-4 w-4"
          />
          Chọn tất cả
          <span className="text-caption text-faint">
            Đã chọn {count}/{rows.length}
          </span>
        </label>
        {withSuggestion > 0 && (
          <label className="flex min-h-[32px] cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={onlySuggested}
              onChange={(e) => setOnlySuggested(e.target.checked)}
              className="h-4 w-4"
            />
            Chỉ lượt có đề xuất AI
          </label>
        )}
        {appliable.length > 0 && (
          <button
            type="button"
            onClick={onApply}
            disabled={applying}
            className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {applying ? "Đang chốt…" : `Chốt theo đề xuất AI cho ${appliable.length} lượt`}
          </button>
        )}
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
      {notice && (
        <p role="status" className="banner-success mt-2 text-sm">
          {notice}
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {rows.map((a) => (
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
