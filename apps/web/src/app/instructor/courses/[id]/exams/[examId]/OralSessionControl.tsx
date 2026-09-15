"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Check, Copy } from "lucide-react";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-emerald-300 bg-white" style={{ width: 140, height: 140 }} />
    ),
  },
);

interface Props {
  examId: string;
  examStatus: string;
  /** Có ca vấn đáp thủ công nào đang mở cho đề này không (server đã tính sẵn). */
  sessionOpen: boolean;
  /** Mã tham gia cho SV đăng nhập, bỏ qua Enrollment. Null khi chưa từng mở ca. */
  joinCode: string | null;
  /** Thời lượng mặc định của đề (Exam.durationMin) — dùng khi ca chưa từng
   * có override riêng. */
  examDurationMin: number;
  /** Thời lượng riêng cho ca hiện tại (phút), null = dùng examDurationMin. */
  durationOverrideMin: number | null;
  /** Số lượt đã thi — chỉ để hiện dòng trạng thái, không ảnh hưởng logic mở/đóng. */
  attemptCount: number;
}

/**
 * A6.5 (rewrite) — điều khiển buổi vấn đáp trong tab "Tổ chức thi" của trang
 * quản lý đề (trước đây nằm rải trong header — xem ExamTabs.tsx). Một nút
 * Mở/Đóng; khi mở, kèm mã tham gia RIÊNG của vấn đáp (/oral/CODE — xem
 * joinOralSessionByCode) cho SV đã đăng nhập vào thẳng, không cần ghi danh
 * khoá học. KHÁC mã dự thi ẩn danh của thi viết: mã này chỉ nhận User đã
 * đăng nhập, không tạo ExamCandidate.
 */
export default function OralSessionControl({
  examId,
  examStatus,
  sessionOpen,
  joinCode,
  examDurationMin,
  durationOverrideMin,
  attemptCount,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const activeDurationMin = durationOverrideMin ?? examDurationMin;
  const [durationInput, setDurationInput] = useState(String(activeDurationMin));

  async function call(method: "POST" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setDetails(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-session`), {
      method,
      ...(body
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data?.error === "string" ? data.error : "Không thực hiện được.");
      if (Array.isArray(data?.details?.errors)) setDetails(data.details.errors);
      return;
    }
    router.refresh();
  }

  if (examStatus === "archived") return null;

  const joinUrl = joinCode ? shareUrl(`/oral/${joinCode}`) : null;
  const parsedDuration = Number.parseInt(durationInput, 10);
  const durationValid =
    Number.isInteger(parsedDuration) && parsedDuration > 0 && parsedDuration <= 24 * 60;
  const durationDirty = durationValid && parsedDuration !== activeDurationMin;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${sessionOpen ? "bg-emerald-600" : "bg-slate-300"}`}
        />
        <span
          className={`text-sm font-medium ${sessionOpen ? "text-emerald-800" : "text-faint"}`}
        >
          {sessionOpen
            ? `Đang mở${attemptCount > 0 ? ` · ${attemptCount} lượt đã thi` : ""}`
            : attemptCount > 0
              ? `Đã đóng buổi · ${attemptCount} lượt đã thi`
              : "Chưa mở buổi"}
        </span>
      </div>

      <div>
        <label htmlFor={`oral-duration-${examId}`} className="block text-sm font-medium">
          Thời lượng mỗi lượt thi
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              id={`oral-duration-${examId}`}
              type="number"
              min={1}
              max={24 * 60}
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              className="w-20 rounded border border-default px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-faint">phút</span>
          </div>
          {sessionOpen ? (
            <>
              {durationDirty && (
                <button
                  type="button"
                  onClick={() => call("POST", { durationOverrideMin: parsedDuration })}
                  disabled={busy}
                  className="rounded border border-default px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy ? "Đang lưu…" : "Lưu thời lượng"}
                </button>
              )}
              <button
                type="button"
                onClick={() => call("DELETE")}
                disabled={busy}
                className="rounded border border-default px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? "Đang đóng…" : "Đóng buổi"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                call("POST", { durationOverrideMin: durationValid ? parsedDuration : undefined })
              }
              disabled={busy || !durationValid}
              className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy
                ? "Đang mở…"
                : attemptCount > 0
                  ? "Mở lại buổi vấn đáp"
                  : "Mở buổi vấn đáp"}
            </button>
          )}
        </div>
        {!sessionOpen && attemptCount > 0 && (
          <p className="mt-1 text-caption text-faint">
            Mở lại nếu còn học viên chưa thi kịp — mã tham gia cũ vẫn dùng lại
            được. Xem điểm ở nút &quot;Chấm bài&quot; trên đầu trang.
          </p>
        )}
      </div>

      {sessionOpen && joinCode && (
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-token pt-5">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 pl-3 pr-1.5 py-1">
            <span className="text-xs font-medium text-emerald-800">Mã tham gia</span>
            <span className="font-mono text-sm font-semibold tracking-widest text-emerald-900">
              {joinCode}
            </span>
            <button
              type="button"
              onClick={async () => {
                if (await copyText(joinUrl!)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="rounded-full p-1 text-emerald-700 hover:bg-emerald-200"
              aria-label="Sao chép link tham gia"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="rounded-lg border border-default bg-white p-1.5">
            <QRCode value={joinUrl!} size={96} level="M" />
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-md rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-medium">Không thực hiện được: {error}</p>
          {details && details.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
