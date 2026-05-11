"use client";

import { useEffect, useState } from "react";

/**
 * Shows a warning overlay each time the learner returns to the tab after
 * losing focus. Increments a counter; instructor sees the same count via
 * ExamIncident rows.
 */
export default function TabBlurWarning({
  onBlur,
}: {
  onBlur: () => void;
}) {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let wasHidden = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        onBlur();
      } else if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        setCount((c) => c + 1);
        setShow(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [onBlur]);

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
