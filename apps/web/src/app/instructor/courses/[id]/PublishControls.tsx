"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";

export default function PublishControls({
  courseId,
  status,
  personalizationEnabled,
  forSale,
}: {
  courseId: string;
  status: string;
  personalizationEnabled: boolean;
  /** Khoá có đơn giá, gói đang bán hoặc mã chưa thu hồi (getPersonalizationReadiness). */
  forSale: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);

  async function publish() {
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/courses/${courseId}/publish`), { method: "POST" });
    } catch {
      setBusy(false);
      setError(lmsErrorMessage("network_error"));
      return false;
    }
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return true;
    }
    const d = await res.json().catch(() => ({}));
    setError(lmsErrorMessage(d.error ?? "publish_failed", res.status));
    return false;
  }

  // AC1 tự học cá nhân hoá — khoá bán mà tắt cá nhân hoá thì người học không có lộ trình và phản hồi riêng, và
  // khoá vẫn chạy như LMS thường nên không ai tự thấy mình thiếu gì. Cảnh báo MỀM: nút "Publish không bật" vẫn
  // xuất bản được; cờ chỉ đổi khi người dùng chọn "Bật cá nhân hoá rồi publish".
  function onPublishClick() {
    if (!personalizationEnabled && forSale) {
      setWarning(true);
      return;
    }
    void publish();
  }

  async function enableThenPublish() {
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/instructor/courses/${courseId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizationEnabled: true }),
      });
    } catch {
      setBusy(false);
      setError(lmsErrorMessage("network_error"));
      return;
    }
    if (!res.ok) {
      setBusy(false);
      const d = await res.json().catch(() => ({}));
      setError(lmsErrorMessage(d.error ?? "publish_failed", res.status));
      return;
    }
    setWarning(false);
    await publish();
  }

  async function publishWithoutEnabling() {
    setWarning(false);
    await publish();
  }

  if (status === "archived") {
    return <span className="chip">Đã archived</span>;
  }

  // Khoá đã publish: nút Archive nằm ở "Hành động khóa" (tab Tổng quan) — hành
  // động không hoàn tác thì không đặt ngay trên đầu trang.
  if (status === "published") return null;

  // Không khoá nút vì thiếu chủ đề: publishCourse tự gắn chủ đề cho các bài còn
  // thiếu trước khi kiểm tra (xem courses.ts).
  return (
    <div className="relative flex items-center gap-2">
      {error && (
        <span className="max-w-xs text-xs text-danger-600" role="alert">
          {error}
        </span>
      )}
      <button
        onClick={onPublishClick}
        disabled={busy}
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-success-600 px-3 py-1.5 font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Publishing..." : "Publish"}
      </button>
      {warning && (
        <div
          role="alertdialog"
          aria-label="Khoá chưa bật cá nhân hoá"
          className="card absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm shadow-lg"
        >
          <p>
            Khoá này chưa bật cá nhân hoá: người học sẽ không có lộ trình và phản hồi riêng, chỉ học như một khoá
            thường.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={enableThenPublish}
              disabled={busy}
              className="btn btn-primary btn-sm"
            >
              Bật cá nhân hoá rồi Publish
            </button>
            <button
              onClick={publishWithoutEnabling}
              disabled={busy}
              className="btn btn-secondary btn-sm"
            >
              Publish không bật
            </button>
            <button
              onClick={() => setWarning(false)}
              disabled={busy}
              className="btn btn-ghost btn-sm"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
