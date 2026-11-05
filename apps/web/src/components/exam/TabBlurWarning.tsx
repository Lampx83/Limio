"use client";

import { useEffect, useRef, useState } from "react";
import { oralUiText, type OralUiLang } from "@/lib/oralUiText";

/**
 * Shows a warning overlay each time the learner returns to the tab after
 * losing focus. Increments a counter; instructor sees the same count via
 * ExamIncident rows.
 *
 * Rời dưới GRACE_MS không tính: bấm "Vào toàn màn hình" trong FullscreenGate tự nó gây ra
 * một nhịp `visibilitychange: hidden→visible` gần như tức thời trên nhiều trình duyệt.
 *
 * Thời gian rời trang tính theo đồng hồ thật, không dựa vào bộ đếm: điện thoại có thể tạm
 * dừng bộ đếm khi trang chạy nền, và lúc quay lại bộ đếm chưa chạy không có nghĩa là vừa rời
 * rất ngắn. Bộ đếm chỉ để ghi nhận khi thí sinh chưa quay lại.
 */
export default function TabBlurWarning({
  onBlur,
  lang = "vi",
}: {
  onBlur: () => void;
  /** Ngôn ngữ giao diện; mặc định tiếng Việt. */
  lang?: OralUiLang;
}) {
  const t = oralUiText(lang).tabBlur;
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(false);
  // Giữ callback trong ref: phòng thi truyền một hàm MỚI mỗi lần dựng lại, mà phòng vấn đáp dựng lại rất
  // dày (chữ AI hiện dần). Để `onBlur` trong dependency thì bộ lắng nghe bị gỡ/gắn lại liên tục và bộ đếm
  // bị huỷ giữa chừng. Đây là điểm yếu thật, nhưng CHƯA chứng minh là nguyên nhân của một lượt thi
  // từng ghi 1.058 sự cố trong chưa đến 1 phút — việc gộp sự cố phía máy chủ (INCIDENT_DEDUPE_WINDOW_MS)
  // mới là lớp chặn chắc chắn.
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  useEffect(() => {
    const GRACE_MS = 1_000;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let hiddenAt: number | null = null;
    let reported = false;

    const report = () => {
      if (reported) return;
      reported = true;
      onBlurRef.current();
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (hiddenAt !== null) return;
        hiddenAt = Date.now();
        reported = false;
        pending = setTimeout(() => {
          pending = null;
          report();
        }, GRACE_MS);
      } else if (document.visibilityState === "visible") {
        if (hiddenAt === null) return;
        const awayMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (pending) {
          clearTimeout(pending);
          pending = null;
        }
        if (awayMs < GRACE_MS) return;
        report();
        setCount((c) => c + 1);
        setShow(true);
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
        <h2 className="mb-2 text-lg font-semibold text-red-700">{t.title}</h2>
        <p className="mb-4 text-sm">{t.body(count)}</p>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {t.button}
        </button>
      </div>
    </div>
  );
}
