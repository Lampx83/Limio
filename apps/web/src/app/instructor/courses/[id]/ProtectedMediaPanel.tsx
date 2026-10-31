"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Bật / tắt "Học liệu có bản quyền" (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md, AC1). Chỉ chủ khoá và admin
 * thấy. Nói thẳng giới hạn ở đây để giảng viên / nhà xuất bản không hứa quá với người mua.
 */
export default function ProtectedMediaPanel({
  courseId,
  initialEnabled,
  initialFiles,
}: {
  courseId: string;
  initialEnabled: boolean;
  initialFiles: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [files, setFiles] = useState(initialFiles);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/protected-media`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        setErr(res.status === 403 ? "Chỉ chủ khoá học mới đổi được cài đặt này." : "Không lưu được. Vui lòng thử lại.");
        return;
      }
      const data = (await res.json()) as { enabled: boolean; files: number };
      setEnabled(data.enabled);
      setFiles(data.files);
    } catch {
      setErr("Chưa kết nối được tới Limio. Hãy kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Học liệu có bản quyền</h2>
        <p className="mt-0.5 text-xs text-muted">
          Bật thì file trong bài (PDF, ảnh, video, âm thanh, file đính kèm) chỉ mở được với người đã ghi danh khoá
          còn hiệu lực và người dạy khoá này. Người chưa mua, hoặc người nhận được đường dẫn từ bạn bè, sẽ không
          tải được. Bài đặt là &quot;xem thử&quot; vẫn mở cho mọi người.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Học liệu có bản quyền"
          disabled={busy}
          onClick={() => void toggle(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-brand-600" : "bg-base-300"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
        <span className="text-sm">{enabled ? "Đang bật" : "Đang tắt"}</span>
        {enabled && <span className="text-xs text-muted">Đang bảo vệ {files} file</span>}
      </div>

      {enabled && (
        <p className="mt-2 text-xs text-muted">
          Lưu ý: cách này chặn việc chia sẻ đường dẫn và người chưa mua. Người đã mua vẫn có thể tự lưu file về
          máy, và Limio chưa chống chụp màn hình hay gắn tên người xem lên tài liệu.
        </p>
      )}
      {err && <p className="mt-2 text-xs text-danger-600">{err}</p>}
    </div>
  );
}
