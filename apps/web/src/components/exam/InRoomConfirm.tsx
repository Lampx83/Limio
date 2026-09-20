"use client";

import { useEffect, useRef } from "react";

/**
 * Hộp xác nhận NGAY TRONG TRANG cho phòng thi.
 *
 * Phòng vấn đáp ép toàn màn hình (FullscreenGate). `window.confirm()` của trình duyệt làm rớt khỏi toàn màn
 * hình ngay khi mở — và trên một số trình duyệt còn trả về false luôn khi đang chuyển chế độ — nên bấm
 * "Kết thúc" thì bị đá ra, cổng toàn màn hình hiện lên đòi quay lại, phải bấm 2–3 lần mới kết thúc được.
 * Hộp này là một phần tử trong cây DOM của phòng thi nên toàn màn hình vẫn nguyên, không có cuộc đua nào.
 */
export default function InRoomConfirm({
  title,
  message,
  confirmLabel,
  cancelLabel = "Quay lại",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Hành động không hoàn tác được (kết thúc buổi) — nút xác nhận đổi sang màu cảnh báo. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Tiêu điểm vào nút AN TOÀN (Quay lại) — Enter lỡ tay không kết thúc buổi thi ngoài ý muốn.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="in-room-confirm-title"
        aria-describedby="in-room-confirm-message"
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="in-room-confirm-title" className="text-base font-semibold">
          {title}
        </h2>
        <p id="in-room-confirm-message" className="mt-2 text-sm text-faint">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded border border-default px-4 py-2 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 ${
              danger
                ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                : "bg-lime-600 hover:bg-lime-700 focus-visible:ring-lime-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
