"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import type { ExamRun } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

/**
 * Lịch sử các lần thi CÙNG MỘT DẠNG.
 *
 * Mỗi hình thức tổ chức có trang riêng, và lịch sử tách theo hình thức chứ
 * không gộp một chỗ: kỳ thi cuối kỳ cần thấy ca/phòng/giám thị, còn link nhanh
 * chỉ cần mã và số người nộp.
 */
export default function ExamRunsList({
  runs,
  emptyHint,
}: {
  runs: ExamRun[];
  emptyHint?: string;
}) {
  const open = runs.filter((r) => r.isOpen);
  const past = runs.filter((r) => !r.isOpen);

  if (runs.length === 0) {
    return (
      <p className="rounded-lg border border-default bg-white px-4 py-6 text-center text-sm text-faint">
        {emptyHint ?? "Chưa có lần thi nào."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đang mở <span className="font-normal text-faint">· {open.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {open.map((r) => (
              <Row key={r.sessionId} r={r} />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đã đóng <span className="font-normal text-faint">· {past.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <Row key={r.sessionId} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ r }: { r: ExamRun }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Lần thi dùng mã cấp riêng hoặc vào bằng tài khoản thì không có link chung
  // để phát cho cả lớp.
  const fullUrl =
    r.path && typeof window !== "undefined"
      ? `${window.location.origin}${r.path}`
      : (r.path ?? "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* trình duyệt chặn clipboard — mã vẫn hiện để đọc cho lớp */
    }
  };

  const toggle = async (open: boolean) => {
    if (
      !open &&
      !confirm(`Đóng buổi thi "${r.examTitle}"? Người đang làm vẫn làm hết giờ.`)
    )
      return;
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/exam-sessions/${r.sessionId}/open-state`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
        r.isOpen
          ? "border-emerald-300 bg-emerald-50"
          : "border-default bg-white"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`font-mono text-base font-semibold tracking-widest ${
            r.isOpen ? "text-emerald-900" : "text-faint"
          }`}
        >
          {r.code ??
            (r.accessMode === "assigned_code" ? "mã riêng" : "ghi danh")}
        </span>
        {r.isOpen && r.code && (
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
            aria-label={`Sao chép link buổi thi ${r.examTitle}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{r.examTitle}</span>
        <span className="block text-caption text-faint">
          {fmt(r.opensAt)} · {r.durationMin} phút · {r.submittedCount}/
          {r.startedCount} đã nộp
          {r.isOpen && !r.closesAt ? " · đóng khi bạn bấm" : ""}
          {r.closesAt ? ` · đóng ${fmt(r.closesAt)}` : ""}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <Link
          href={`/instructor/exam-runs/${r.sessionId}`}
          className="text-xs underline"
        >
          Kết quả
        </Link>
        <a
          href={apiUrl(
            `/api/exams/${r.examId}/results?sessionId=${r.sessionId}`,
          )}
          className="inline-flex items-center gap-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
          title="Tải kết quả thí sinh của lần thi này"
        >
          <Download className="h-3 w-3 shrink-0" />
          Tải
        </a>
        {r.timingMode === "manual" && (
          <button
            type="button"
            onClick={() => toggle(!r.isOpen)}
            disabled={busy}
            className="rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "…" : r.isOpen ? "Đóng" : "Mở lại"}
          </button>
        )}
      </span>
    </li>
  );
}
