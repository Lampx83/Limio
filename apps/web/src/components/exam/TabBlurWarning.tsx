"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows a warning overlay each time the learner returns to the tab after
 * losing focus. Increments a counter; instructor sees the same count via
 * ExamIncident rows.
 *
 * Chờ GRACE_MS rồi mới tính là rời tab, cùng khuôn với `fullscreen_exit` ở
 * ExamPlayer (xem comment ở đó). Bấm "Vào toàn màn hình" trong FullscreenGate
 * tự nó gây ra một nhịp `visibilitychange: hidden→visible` gần như tức thời
 * trên nhiều trình duyệt (macOS đưa fullscreen sang Space riêng) — ghi ngay
 * thì HỌC SINH VỪA BẤM NÚT VÀO THI ĐÃ BỊ GẮN CỜ "rời tab" cho chính thao tác
 * bắt buộc để bắt đầu. Không debounce y hệt lỗi mà fullscreen_exit từng có.
 */
export default function TabBlurWarning({
  onBlur,
}: {
  onBlur: () => void;
}) {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(false);
  // Giữ callback trong ref: phòng thi truyền một hàm MỚI mỗi lần dựng lại, mà phòng vấn đáp dựng lại rất
  // dày (chữ AI hiện dần). Để `onBlur` trong dependency thì bộ lắng nghe bị gỡ/gắn lại liên tục và bộ đếm
  // 5 giây bị huỷ giữa chừng. Đây là điểm yếu thật, nhưng CHƯA chứng minh là nguyên nhân của một lượt thi
  // từng ghi 1.058 sự cố trong chưa đến 1 phút — việc gộp sự cố phía máy chủ (INCIDENT_DEDUPE_WINDOW_MS)
  // mới là lớp chặn chắc chắn.
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  useEffect(() => {
    const GRACE_MS = 5_000;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let leftForReal = false;

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (pending) return;
        pending = setTimeout(() => {
          pending = null;
          leftForReal = true;
          onBlurRef.current();
        }, GRACE_MS);
      } else if (document.visibilityState === "visible") {
        if (pending) {
          // Quay lại trong GRACE — chớp hình do fullscreen/thông báo hệ điều
          // hành, không phải rời tab. Không ghi sự cố, không cảnh báo.
          clearTimeout(pending);
          pending = null;
          return;
        }
        if (leftForReal) {
          leftForReal = false;
          setCount((c) => c + 1);
          setShow(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (pending) clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="max-w-md rounded-lg border border-red-300 bg-white p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-red-700">
          Cảnh báo: Bạn đã rời tab
        </h2>
        <p className="mb-4 text-sm">
          Hệ thống đã ghi nhận{" "}
          <span className="font-semibold">{count}</span> lần bạn chuyển sang
          tab khác trong khi làm bài. Giảng viên có thể xem lại các sự kiện
          này khi chấm bài.
        </p>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Tôi đã hiểu, tiếp tục làm bài
        </button>
      </div>
    </div>
  );
}
