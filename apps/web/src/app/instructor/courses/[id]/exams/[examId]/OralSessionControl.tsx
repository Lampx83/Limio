"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Check, Copy, QrCode } from "lucide-react";
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
}

/**
 * A6.5 (rewrite) — điều khiển buổi vấn đáp ngay trên trang quản lý đề, thay
 * cho bước "Tổ chức thi" riêng (đã bỏ — xem openOralExamSession trong
 * oral-attempts.ts). Một nút Mở/Đóng; khi mở, kèm mã tham gia RIÊNG của vấn
 * đáp (/oral/CODE — xem joinOralSessionByCode) cho SV đã đăng nhập vào thẳng,
 * không cần ghi danh khoá học. KHÁC mã dự thi ẩn danh của thi viết: mã này
 * chỉ nhận User đã đăng nhập, không tạo ExamCandidate.
 */
export default function OralSessionControl({ examId, examStatus, sessionOpen, joinCode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    setDetails(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-session`), { method });
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

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {sessionOpen ? (
          <>
            {joinCode && (
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
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  aria-expanded={showQr}
                  className={`rounded-full p-1 text-emerald-700 hover:bg-emerald-200 ${showQr ? "bg-emerald-200" : ""}`}
                  aria-label={showQr ? "Ẩn mã QR" : "Hiện mã QR"}
                >
                  <QrCode className="h-3.5 w-3.5" />
                </button>
              </div>
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
            onClick={() => call("POST")}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Đang mở…" : "Mở buổi vấn đáp"}
          </button>
        )}
      </div>

      {showQr && joinUrl && (
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-lg border border-emerald-300 bg-white p-2">
            <QRCode value={joinUrl} size={140} level="M" />
          </div>
          <p className="max-w-[220px] text-right text-caption text-faint">
            SV đăng nhập trước, quét mã rồi vào thẳng — không cần ghi danh khoá
            học.
          </p>
        </div>
      )}

      {error && (
        <div className="max-w-md rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-medium">Không mở được: {error}</p>
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
