"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { humanizePublishDetail, humanizePublishError } from "@/lib/examPublishErrors";

interface Props {
  examId: string;
  status: string;
  /** Khung giờ của đề — publish dựng sẵn một ca thi lấy khung này làm giá trị đầu. */
  openAt?: string;
  closeAt?: string;
}

export default function PublishBar({ examId, status, openAt, closeAt }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  async function publish() {
    // Publish không hoàn tác được từ giao diện và dựng sẵn một ca thi mở theo
    // khung giờ của đề, nên nói rõ trước khi bấm thay vì để giảng viên bất ngờ.
    const window_ =
      openAt && closeAt
        ? `\n\nHệ thống sẽ dựng sẵn một ca thi mở từ ${formatDateTime(openAt)} đến ${formatDateTime(closeAt)}; học viên đã ghi danh khoá học có thể vào thi trong khung giờ này. Bạn chỉnh giờ, chia ca, xếp phòng ở mục Tổ chức thi.`
        : "";
    if (
      !window.confirm(
        "Publish đề này?\n\nSau khi có người làm bài, thời lượng, cách chấm và các cài đặt khác của đề sẽ bị khoá; chỉ còn sửa được tiêu đề, mô tả và giờ đóng." +
          window_,
      )
    )
      return;
    setBusy(true);
    setError(null);
    setDetails(null);
    try {
      const res = await fetch(apiUrl(`/api/exams/${examId}/publish`), {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(humanizePublishError(typeof data?.error === "string" ? data.error : "publish_failed"));
        if (Array.isArray(data?.details?.errors)) {
          setDetails((data.details.errors as string[]).map(humanizePublishDetail));
        }
        return;
      }
      setJustPublished(true);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button
            type="button"
            onClick={publish}
            disabled={busy}
            className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Đang publish…" : "Publish"}
          </button>
        )}
      </div>
      {justPublished && (
        <div
          role="status"
          className="max-w-md rounded border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900"
        >
          <p className="font-medium">Đã publish đề.</p>
          <p className="mt-0.5">
            Bước tiếp theo:{" "}
            <Link
              href={`/instructor/organize?examId=${examId}`}
              className="font-semibold underline"
            >
              Tổ chức thi →
            </Link>{" "}
            (chọn hình thức, giờ mở, ai được vào).
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="max-w-md rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <p className="font-medium">{error}</p>
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
