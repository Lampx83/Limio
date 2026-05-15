"use client";

import { useEffect, useState } from "react";

export default function CreatedBanner({ fallback }: { fallback: boolean }) {
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
          Kiểm tra lại cấu hình, sau đó publish để học sinh có thể làm bài.
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
