"use client";

import { useEffect, useState } from "react";

export default function CreatedBanner({
  fallback,
  hasContent,
  kind = "written",
}: {
  fallback: boolean;
  hasContent: boolean;
  kind?: "written" | "oral";
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
      <div>
        <p className="font-medium text-emerald-800">✓ Đề thi đã được tạo thành công!</p>
        {fallback && (
          <p className="mt-0.5 text-xs text-emerald-700">
            Không đủ dữ liệu lớp học để ước tính năng lực, đã dùng profile{" "}
            <strong>Đánh giá toàn diện</strong> thay thế.
          </p>
        )}
        <p className="mt-0.5 text-xs text-emerald-600">
          {kind === "oral"
            ? "Đề vấn đáp chưa có tài liệu nào — nộp tài liệu (đề cương, danh sách chủ đề…) ở tab Tài liệu bên dưới, rồi publish."
            : hasContent
              ? "Hệ thống đã tự chọn sẵn câu hỏi bên dưới — xem lại, sửa nếu cần, rồi publish."
              : "Đề chưa có câu hỏi nào — thêm câu hỏi bên dưới (từ ngân hàng hoặc tự soạn), rồi publish."}
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 text-emerald-600 hover:text-emerald-800"
        aria-label="Đóng"
      >
        ✕
      </button>
    </div>
  );
}
