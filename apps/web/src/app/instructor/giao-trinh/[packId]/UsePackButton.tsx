"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

const ERRORS: Record<string, string> = {
  not_published: "Giáo trình này đã được gỡ khỏi thư viện.",
  forbidden: "Chỉ giảng viên mới dùng được giáo trình.",
};

export default function UsePackButton({ packId }: { packId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const use = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/packs/${packId}/use`), { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { courseId?: string; error?: string };
      if (!r.ok || !j.courseId) {
        setError(ERRORS[j.error ?? ""] ?? "Chưa sao chép được giáo trình. Thử lại sau.");
        return;
      }
      router.push(`/instructor/courses/${j.courseId}`);
    } catch {
      setError("Chưa sao chép được vì mạng không ổn định. Thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-primary" disabled={busy} onClick={use}>
        {busy ? "Đang sao chép…" : "Dùng giáo trình này"}
      </button>
      <p className="mt-2 max-w-xl text-caption text-muted">
        Limio sao toàn bộ giáo trình thành một khoá nháp của thầy/cô. Thầy/cô xem lại nội dung, bấm Publish, rồi vào tab “Lớp học” để
        tạo lớp và đặt lịch dạy; mỗi buổi học sẽ tự hiện giáo án tương ứng.
      </p>
      {error && <div className="banner-danger mt-3 text-sm">{error}</div>}
    </div>
  );
}
